alter table public.seasonal_products
  add column stock_limit numeric(10,3)
  check (stock_limit is null or stock_limit > 0);

alter table public.order_items
  add column seasonal_product_id uuid references public.seasonal_products(id) on delete set null;

create index order_items_seasonal_product_idx
  on public.order_items(seasonal_product_id)
  where seasonal_product_id is not null;

update public.order_items item
set seasonal_product_id = product.id
from public.order_revisions revision
join public.orders order_record on order_record.id = revision.order_id
join public.seasonal_products product on product.campaign_id = order_record.campaign_id
where item.revision_id = revision.id
  and item.product_id is null
  and item.seasonal_product_id is null
  and item.product_name = product.name;

create or replace function public.assert_valid_seasonal_items(p_campaign_id uuid, p_items jsonb)
returns void security definer set search_path = '' language plpgsql as $$
declare invalid_count integer;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Adicione pelo menos um artigo.';
  end if;

  perform 1
  from public.seasonal_products product
  join (
    select distinct (item ->> 'product_id')::uuid as product_id
    from jsonb_array_elements(p_items) item
  ) requested on requested.product_id = product.id
  where product.campaign_id = p_campaign_id
  order by product.id
  for update of product;

  select count(*) into invalid_count
  from jsonb_array_elements(p_items) item
  left join public.seasonal_products product
    on product.id = (item ->> 'product_id')::uuid and product.campaign_id = p_campaign_id
  where product.id is null or not product.active
    or coalesce((item ->> 'quantity')::numeric, 0) < product.minimum_quantity
    or mod(
      (coalesce((item ->> 'quantity')::numeric, 0) * 1000)::bigint,
      (product.quantity_step * 1000)::bigint
    ) <> 0
    or (product.requires_note and length(trim(coalesce(item ->> 'note', ''))) = 0);

  if invalid_count > 0 or (
    select count(*) <> count(distinct item ->> 'product_id')
    from jsonb_array_elements(p_items) item
  ) then
    raise exception 'Um ou mais artigos sazonais são inválidos ou estão indisponíveis.';
  end if;

  with requested as (
    select
      (item ->> 'product_id')::uuid as product_id,
      sum((item ->> 'quantity')::numeric) as quantity
    from jsonb_array_elements(p_items) item
    group by (item ->> 'product_id')::uuid
  ), reserved as (
    select item.seasonal_product_id as product_id, sum(item.quantity) as quantity
    from public.order_items item
    join public.order_revisions revision on revision.id = item.revision_id
    join public.orders order_record
      on order_record.id = revision.order_id
      and order_record.current_revision_id = revision.id
    where item.seasonal_product_id is not null
      and order_record.status in ('pending', 'accepted')
    group by item.seasonal_product_id
  )
  select count(*) into invalid_count
  from requested
  join public.seasonal_products product on product.id = requested.product_id
  left join reserved on reserved.product_id = requested.product_id
  where product.stock_limit is not null
    and coalesce(reserved.quantity, 0) + requested.quantity > product.stock_limit;

  if invalid_count > 0 then
    raise exception 'Stock insuficiente para um ou mais artigos sazonais.';
  end if;
end;
$$;

create or replace function public.insert_seasonal_revision_items(p_revision_id uuid, p_campaign_id uuid, p_items jsonb)
returns void security definer set search_path = '' language sql as $$
  insert into public.order_items (
    revision_id, product_id, seasonal_product_id, product_name, unit_label,
    quantity, item_note, position
  )
  select
    p_revision_id,
    null,
    product.id,
    product.name,
    product.unit_label,
    (item ->> 'quantity')::numeric,
    trim(coalesce(item ->> 'note', '')),
    ordinality::integer - 1
  from jsonb_array_elements(p_items) with ordinality as payload(item, ordinality)
  join public.seasonal_products product
    on product.id = (item ->> 'product_id')::uuid and product.campaign_id = p_campaign_id;
$$;

create or replace function public.create_seasonal_order(
  p_idempotency_key uuid,
  p_campaign_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_pickup_slot_id uuid,
  p_pickup_at timestamptz,
  p_general_notes text,
  p_items jsonb,
  p_ordering_store_id uuid default null
)
returns uuid security definer set search_path = '' language plpgsql as $$
declare
  actor_role public.app_role;
  source_store uuid;
  result_id uuid;
  revision_id uuid;
  settings public.ordering_settings;
  selected_campaign public.seasonal_campaigns;
  selected_slot public.seasonal_pickup_slots;
  local_pickup timestamp;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  actor_role := public.current_profile_role();
  if actor_role not in ('store', 'admin') then raise exception 'Sem permissão.'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key::text, 0));
  select id into result_id from public.orders where idempotency_key = p_idempotency_key;
  if result_id is not null then return result_id; end if;

  select * into selected_campaign from public.seasonal_campaigns where id = p_campaign_id;
  if selected_campaign.id is null or not selected_campaign.active then
    raise exception 'Campanha sazonal indisponível.';
  end if;
  if now() < selected_campaign.ordering_opens_at or now() > selected_campaign.ordering_closes_at then
    raise exception 'Esta campanha não está a aceitar encomendas.';
  end if;

  select * into selected_slot from public.seasonal_pickup_slots
  where id = p_pickup_slot_id and campaign_id = p_campaign_id and active;
  local_pickup := p_pickup_at at time zone 'Europe/Lisbon';
  if selected_slot.id is null or p_pickup_at <= now()
    or local_pickup::date <> selected_slot.pickup_date
    or local_pickup::time < selected_slot.opens_at
    or local_pickup::time >= selected_slot.closes_at
    or mod(
      floor(extract(epoch from (local_pickup::time - selected_slot.opens_at)) / 60)::integer,
      selected_slot.slot_minutes
    ) <> 0 then
    raise exception 'Escolha um horário de levantamento disponível.';
  end if;
  if not exists (
    select 1 from public.locations
    where id = selected_slot.location_id and kind = 'store' and active
  ) then
    raise exception 'Loja de levantamento inválida.';
  end if;

  source_store := case when actor_role = 'store' then public.current_profile_location() else p_ordering_store_id end;
  if source_store is null then raise exception 'Loja de origem obrigatória.'; end if;
  if not exists (select 1 from public.locations where id = source_store and kind = 'store' and active) then
    raise exception 'Loja de origem inválida.';
  end if;

  select * into settings from public.ordering_settings where id;
  if length(trim(coalesce(p_customer_name, ''))) < 2 then raise exception 'Nome obrigatório.'; end if;
  if trim(coalesce(p_customer_email, '')) !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then raise exception 'Email inválido.'; end if;
  if settings.phone_required and length(trim(coalesce(p_customer_phone, ''))) < 6 then raise exception 'Telefone obrigatório.'; end if;
  if settings.general_notes_required and length(trim(coalesce(p_general_notes, ''))) = 0 then raise exception 'Observações obrigatórias.'; end if;
  perform public.assert_valid_seasonal_items(p_campaign_id, p_items);

  insert into public.orders (
    idempotency_key, campaign_id, ordering_store_id, pickup_store_id, created_by
  ) values (
    p_idempotency_key, p_campaign_id, source_store, selected_slot.location_id, auth.uid()
  ) returning id into result_id;

  insert into public.order_revisions (
    order_id, version, customer_name, customer_email, customer_phone,
    pickup_store_id, pickup_at, general_notes, created_by
  ) values (
    result_id, 1, trim(p_customer_name), lower(trim(p_customer_email)), nullif(trim(p_customer_phone), ''),
    selected_slot.location_id, p_pickup_at, trim(coalesce(p_general_notes, '')), auth.uid()
  ) returning id into revision_id;

  perform public.insert_seasonal_revision_items(revision_id, p_campaign_id, p_items);
  update public.orders set current_revision_id = revision_id where id = result_id;
  insert into public.order_events(order_id, revision_version, event_type, actor_id, metadata)
    values (result_id, 1, 'created', auth.uid(), jsonb_build_object('campaign_id', p_campaign_id));
  insert into public.notification_outbox(order_id, revision_version, channel, kind)
    values (result_id, 1, 'push', 'new_order');
  return result_id;
end;
$$;

revoke all on function public.assert_valid_seasonal_items(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.insert_seasonal_revision_items(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.create_seasonal_order(uuid,uuid,text,text,text,uuid,timestamptz,text,jsonb,uuid) to authenticated;
