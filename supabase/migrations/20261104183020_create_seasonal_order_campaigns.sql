create table public.seasonal_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null default '',
  ordering_opens_at timestamptz not null,
  ordering_closes_at timestamptz not null,
  active boolean not null default false,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ordering_closes_at > ordering_opens_at)
);

create table public.seasonal_products (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.seasonal_campaigns(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 160),
  description text not null default '',
  unit_label text not null default 'un.' check (length(trim(unit_label)) between 1 and 20),
  minimum_quantity numeric(10,3) not null default 1 check (minimum_quantity > 0),
  quantity_step numeric(10,3) not null default 1 check (quantity_step > 0),
  requires_note boolean not null default false,
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, name)
);

create table public.seasonal_pickup_slots (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.seasonal_campaigns(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  pickup_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (campaign_id, location_id, pickup_at)
);

alter table public.orders
  add column campaign_id uuid references public.seasonal_campaigns(id);

create index seasonal_products_campaign_idx on public.seasonal_products(campaign_id, position);
create index seasonal_pickup_slots_campaign_idx on public.seasonal_pickup_slots(campaign_id, pickup_at);
create index orders_campaign_idx on public.orders(campaign_id, updated_at desc) where campaign_id is not null;

create trigger seasonal_campaigns_touch before update on public.seasonal_campaigns
for each row execute function public.touch_updated_at();
create trigger seasonal_products_touch before update on public.seasonal_products
for each row execute function public.touch_updated_at();

alter table public.seasonal_campaigns enable row level security;
alter table public.seasonal_products enable row level security;
alter table public.seasonal_pickup_slots enable row level security;

create policy seasonal_campaigns_read on public.seasonal_campaigns for select to authenticated
using (public.current_profile_role() = 'admin' or (active and public.current_profile_role() is not null));
create policy seasonal_campaigns_admin_all on public.seasonal_campaigns for all to authenticated
using (public.current_profile_role() = 'admin') with check (public.current_profile_role() = 'admin');

create policy seasonal_products_read on public.seasonal_products for select to authenticated
using (
  public.current_profile_role() = 'admin'
  or (active and exists (
    select 1 from public.seasonal_campaigns campaign
    where campaign.id = seasonal_products.campaign_id and campaign.active
  ))
);
create policy seasonal_products_admin_all on public.seasonal_products for all to authenticated
using (public.current_profile_role() = 'admin') with check (public.current_profile_role() = 'admin');

create policy seasonal_pickup_slots_read on public.seasonal_pickup_slots for select to authenticated
using (
  public.current_profile_role() = 'admin'
  or (active and exists (
    select 1 from public.seasonal_campaigns campaign
    where campaign.id = seasonal_pickup_slots.campaign_id and campaign.active
  ))
);
create policy seasonal_pickup_slots_admin_all on public.seasonal_pickup_slots for all to authenticated
using (public.current_profile_role() = 'admin') with check (public.current_profile_role() = 'admin');

grant select, insert, update, delete on public.seasonal_campaigns to authenticated;
grant select, insert, update, delete on public.seasonal_products to authenticated;
grant select, insert, update, delete on public.seasonal_pickup_slots to authenticated;

create or replace function public.assert_valid_seasonal_items(p_campaign_id uuid, p_items jsonb)
returns void security definer set search_path = '' language plpgsql as $$
declare invalid_count integer;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Adicione pelo menos um artigo.';
  end if;

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

  if invalid_count > 0 then
    raise exception 'Um ou mais artigos sazonais são inválidos ou estão indisponíveis.';
  end if;
end;
$$;

create or replace function public.insert_seasonal_revision_items(p_revision_id uuid, p_campaign_id uuid, p_items jsonb)
returns void security definer set search_path = '' language sql as $$
  insert into public.order_items (
    revision_id, product_id, product_name, unit_label, quantity, item_note, position
  )
  select
    p_revision_id,
    null,
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
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  actor_role := public.current_profile_role();
  if actor_role not in ('store', 'admin') then raise exception 'Sem permissão.'; end if;

  select * into selected_campaign from public.seasonal_campaigns where id = p_campaign_id;
  if selected_campaign.id is null or not selected_campaign.active then
    raise exception 'Campanha sazonal indisponível.';
  end if;
  if now() < selected_campaign.ordering_opens_at or now() > selected_campaign.ordering_closes_at then
    raise exception 'Esta campanha não está a aceitar encomendas.';
  end if;

  select * into selected_slot from public.seasonal_pickup_slots
  where id = p_pickup_slot_id and campaign_id = p_campaign_id and active;
  if selected_slot.id is null or selected_slot.pickup_at <= now() then
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

  select id into result_id from public.orders where idempotency_key = p_idempotency_key;
  if result_id is not null then return result_id; end if;

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
    selected_slot.location_id, selected_slot.pickup_at, trim(coalesce(p_general_notes, '')), auth.uid()
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
grant execute on function public.create_seasonal_order(uuid,uuid,text,text,text,uuid,text,jsonb,uuid) to authenticated;

alter publication supabase_realtime add table public.seasonal_campaigns;
