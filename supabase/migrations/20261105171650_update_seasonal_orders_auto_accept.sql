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
  update public.orders set
    current_revision_id = revision_id,
    status = 'accepted',
    accepted_revision_id = revision_id,
    accepted_at = now(),
    accepted_by = null
  where id = result_id;
  insert into public.order_events(order_id, revision_version, event_type, actor_id, metadata)
    values
      (result_id, 1, 'created', auth.uid(), jsonb_build_object('campaign_id', p_campaign_id)),
      (result_id, 1, 'accepted', null, jsonb_build_object('campaign_id', p_campaign_id, 'automatic', true));
  insert into public.notification_outbox(order_id, revision_version, channel, kind, recipient)
    values (result_id, 1, 'email', 'order_accepted', lower(trim(p_customer_email)));
  return result_id;
end;
$$;
