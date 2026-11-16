alter table public.order_revisions
  add column fulfillment_type text not null default 'pickup',
  add column delivery_address text,
  add constraint order_revisions_fulfillment_type_check
    check (fulfillment_type in ('pickup', 'delivery')),
  add constraint order_revisions_delivery_address_check
    check (
      (anonymized_at is not null and delivery_address is null)
      or (fulfillment_type = 'pickup' and delivery_address is null)
      or (fulfillment_type = 'delivery' and length(trim(delivery_address)) between 5 and 500)
    );

create or replace function public.assert_order_details(
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_pickup_store_id uuid,
  p_pickup_at timestamptz,
  p_general_notes text
)
returns void security definer set search_path = '' language plpgsql as $$
declare
  settings public.ordering_settings;
  local_pickup timestamp;
begin
  select * into settings from public.ordering_settings where id;
  if not exists (select 1 from public.locations where id = p_pickup_store_id and kind = 'store' and active) then
    raise exception 'Loja responsável inválida.';
  end if;
  if length(trim(coalesce(p_customer_name, ''))) < 2 then raise exception 'Nome obrigatório.'; end if;
  if length(trim(coalesce(p_customer_email, ''))) > 0
    and trim(p_customer_email) !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'Email inválido.';
  end if;
  if settings.phone_required and length(trim(coalesce(p_customer_phone, ''))) < 6 then raise exception 'Telefone obrigatório.'; end if;
  if settings.general_notes_required and length(trim(coalesce(p_general_notes, ''))) = 0 then raise exception 'Observações obrigatórias.'; end if;
  if p_pickup_at < now() + make_interval(mins => settings.minimum_lead_minutes)
     or p_pickup_at > now() + make_interval(days => settings.booking_horizon_days) then
    raise exception 'Horário fora do período permitido.';
  end if;

  local_pickup := p_pickup_at at time zone 'Europe/Lisbon';
  if not exists (
    select 1 from public.pickup_windows pickup_window
    where pickup_window.location_id = p_pickup_store_id and pickup_window.active
      and pickup_window.weekday = extract(dow from local_pickup)::integer
      and local_pickup::time >= pickup_window.opens_at and local_pickup::time < pickup_window.closes_at
      and mod(
        floor(extract(epoch from (local_pickup::time - pickup_window.opens_at)) / 60)::integer,
        30
      ) = 0
  ) then
    raise exception 'Escolha um horário disponível.';
  end if;
end;
$$;

create or replace function public.assert_fulfillment_details(
  p_fulfillment_type text,
  p_delivery_address text
)
returns void security definer set search_path = '' language plpgsql as $$
begin
  if p_fulfillment_type not in ('pickup', 'delivery') then
    raise exception 'Modalidade de receção inválida.';
  end if;
  if p_fulfillment_type = 'delivery'
    and length(trim(coalesce(p_delivery_address, ''))) not between 5 and 500 then
    raise exception 'Morada de entrega obrigatória.';
  end if;
end;
$$;

drop function if exists public.create_order(uuid,text,text,text,uuid,timestamptz,text,jsonb,uuid);
drop function if exists public.submit_order_revision(uuid,text,text,text,uuid,timestamptz,text,jsonb);
drop function if exists public.create_seasonal_order(uuid,uuid,text,text,text,uuid,timestamptz,text,jsonb,uuid);
drop function if exists public.submit_seasonal_order_revision(uuid,text,text,text,uuid,timestamptz,text,jsonb);

create function public.create_order(
  p_idempotency_key uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_pickup_store_id uuid,
  p_pickup_at timestamptz,
  p_general_notes text,
  p_items jsonb,
  p_fulfillment_type text,
  p_delivery_address text,
  p_ordering_store_id uuid default null
)
returns uuid security definer set search_path = '' language plpgsql as $$
declare
  actor_role public.app_role;
  source_store uuid;
  result_id uuid;
  revision_id uuid;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  actor_role := public.current_profile_role();
  if actor_role not in ('store', 'admin') then raise exception 'Sem permissão.'; end if;

  source_store := case when actor_role = 'store' then public.current_profile_location() else p_ordering_store_id end;
  if source_store is null then raise exception 'Loja de origem obrigatória.'; end if;
  if not exists (select 1 from public.locations where id = source_store and kind = 'store' and active) then
    raise exception 'Loja de origem inválida.';
  end if;
  perform public.assert_valid_items(p_items);
  perform public.assert_order_details(p_customer_name, p_customer_email, p_customer_phone, p_pickup_store_id, p_pickup_at, p_general_notes);
  perform public.assert_fulfillment_details(p_fulfillment_type, p_delivery_address);

  select id into result_id from public.orders where idempotency_key = p_idempotency_key;
  if result_id is not null then return result_id; end if;

  insert into public.orders (idempotency_key, ordering_store_id, pickup_store_id, created_by)
  values (p_idempotency_key, source_store, p_pickup_store_id, auth.uid())
  returning id into result_id;

  insert into public.order_revisions (
    order_id, version, customer_name, customer_email, customer_phone,
    pickup_store_id, pickup_at, fulfillment_type, delivery_address, general_notes, created_by
  ) values (
    result_id, 1, trim(p_customer_name), nullif(lower(trim(coalesce(p_customer_email, ''))), ''), nullif(trim(p_customer_phone), ''),
    p_pickup_store_id, p_pickup_at, p_fulfillment_type,
    case when p_fulfillment_type = 'delivery' then trim(p_delivery_address) else null end,
    trim(coalesce(p_general_notes, '')), auth.uid()
  ) returning id into revision_id;

  perform public.insert_revision_items(revision_id, p_items);
  update public.orders set current_revision_id = revision_id where id = result_id;
  insert into public.order_events(order_id, revision_version, event_type, actor_id, metadata)
    values (result_id, 1, 'created', auth.uid(), jsonb_build_object('fulfillment_type', p_fulfillment_type));
  insert into public.notification_outbox(order_id, revision_version, channel, kind)
    values (result_id, 1, 'push', 'new_order');
  return result_id;
end;
$$;

create function public.submit_order_revision(
  p_order_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_pickup_store_id uuid,
  p_pickup_at timestamptz,
  p_general_notes text,
  p_items jsonb,
  p_fulfillment_type text,
  p_delivery_address text
)
returns integer security definer set search_path = '' language plpgsql as $$
declare
  target public.orders;
  next_version integer;
  revision_id uuid;
begin
  select * into target from public.orders where id = p_order_id for update;
  if target.id is null then raise exception 'Encomenda não encontrada.'; end if;
  if public.current_profile_role() <> 'admin' and not (
    public.current_profile_role() = 'store' and target.ordering_store_id = public.current_profile_location()
  ) then raise exception 'Sem permissão.'; end if;
  if target.status = 'cancelled' then raise exception 'A encomenda está cancelada.'; end if;
  if target.campaign_id is not null then raise exception 'Use a edição própria da campanha sazonal.'; end if;
  perform public.assert_valid_items(p_items);
  perform public.assert_order_details(p_customer_name, p_customer_email, p_customer_phone, p_pickup_store_id, p_pickup_at, p_general_notes);
  perform public.assert_fulfillment_details(p_fulfillment_type, p_delivery_address);

  next_version := target.current_version + 1;
  insert into public.order_revisions (
    order_id, version, customer_name, customer_email, customer_phone,
    pickup_store_id, pickup_at, fulfillment_type, delivery_address, general_notes, created_by
  ) values (
    target.id, next_version, trim(p_customer_name), nullif(lower(trim(coalesce(p_customer_email, ''))), ''), nullif(trim(p_customer_phone), ''),
    p_pickup_store_id, p_pickup_at, p_fulfillment_type,
    case when p_fulfillment_type = 'delivery' then trim(p_delivery_address) else null end,
    trim(coalesce(p_general_notes, '')), auth.uid()
  ) returning id into revision_id;
  perform public.insert_revision_items(revision_id, p_items);

  update public.orders set
    current_version = next_version, current_revision_id = revision_id, pickup_store_id = p_pickup_store_id,
    status = 'pending', accepted_by = null, accepted_at = null, rejected_by = null,
    rejected_at = null, rejection_reason = null, updated_at = now()
  where id = target.id;
  insert into public.order_events(order_id, revision_version, event_type, actor_id, metadata)
    values (target.id, next_version, 'revised', auth.uid(), jsonb_build_object('fulfillment_type', p_fulfillment_type));
  insert into public.notification_outbox(order_id, revision_version, channel, kind)
    values (target.id, next_version, 'push', 'revised_order');
  return next_version;
end;
$$;

create function public.create_seasonal_order(
  p_idempotency_key uuid,
  p_campaign_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_pickup_slot_id uuid,
  p_pickup_at timestamptz,
  p_general_notes text,
  p_items jsonb,
  p_fulfillment_type text,
  p_delivery_address text,
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
  clean_email text;
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
    raise exception 'Escolha um horário disponível.';
  end if;
  if not exists (
    select 1 from public.locations
    where id = selected_slot.location_id and kind = 'store' and active
  ) then
    raise exception 'Loja responsável inválida.';
  end if;

  source_store := case when actor_role = 'store' then public.current_profile_location() else p_ordering_store_id end;
  if source_store is null then raise exception 'Loja de origem obrigatória.'; end if;
  if not exists (select 1 from public.locations where id = source_store and kind = 'store' and active) then
    raise exception 'Loja de origem inválida.';
  end if;

  select * into settings from public.ordering_settings where id;
  clean_email := nullif(lower(trim(coalesce(p_customer_email, ''))), '');
  if length(trim(coalesce(p_customer_name, ''))) < 2 then raise exception 'Nome obrigatório.'; end if;
  if clean_email is not null and clean_email !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then raise exception 'Email inválido.'; end if;
  if settings.phone_required and length(trim(coalesce(p_customer_phone, ''))) < 6 then raise exception 'Telefone obrigatório.'; end if;
  if settings.general_notes_required and length(trim(coalesce(p_general_notes, ''))) = 0 then raise exception 'Observações obrigatórias.'; end if;
  perform public.assert_fulfillment_details(p_fulfillment_type, p_delivery_address);
  perform public.assert_valid_seasonal_items(p_campaign_id, p_items);

  insert into public.orders (
    idempotency_key, campaign_id, ordering_store_id, pickup_store_id, created_by
  ) values (
    p_idempotency_key, p_campaign_id, source_store, selected_slot.location_id, auth.uid()
  ) returning id into result_id;

  insert into public.order_revisions (
    order_id, version, customer_name, customer_email, customer_phone,
    pickup_store_id, pickup_at, fulfillment_type, delivery_address, general_notes, created_by
  ) values (
    result_id, 1, trim(p_customer_name), clean_email, nullif(trim(p_customer_phone), ''),
    selected_slot.location_id, p_pickup_at, p_fulfillment_type,
    case when p_fulfillment_type = 'delivery' then trim(p_delivery_address) else null end,
    trim(coalesce(p_general_notes, '')), auth.uid()
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
      (result_id, 1, 'created', auth.uid(), jsonb_build_object('campaign_id', p_campaign_id, 'fulfillment_type', p_fulfillment_type)),
      (result_id, 1, 'accepted', null, jsonb_build_object('campaign_id', p_campaign_id, 'automatic', true, 'fulfillment_type', p_fulfillment_type));
  insert into public.notification_outbox(order_id, revision_version, channel, kind, recipient)
    values (result_id, 1, 'email', 'order_accepted', clean_email);
  return result_id;
end;
$$;

create function public.submit_seasonal_order_revision(
  p_order_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_pickup_slot_id uuid,
  p_pickup_at timestamptz,
  p_general_notes text,
  p_items jsonb,
  p_fulfillment_type text,
  p_delivery_address text
)
returns integer security definer set search_path = '' language plpgsql as $$
declare
  target public.orders;
  selected_slot public.seasonal_pickup_slots;
  settings public.ordering_settings;
  local_pickup timestamp;
  next_version integer;
  revision_id uuid;
  clean_email text;
begin
  select * into target from public.orders where id = p_order_id for update;
  if target.id is null then raise exception 'Encomenda não encontrada.'; end if;
  if target.campaign_id is null then raise exception 'A encomenda não pertence a uma campanha sazonal.'; end if;
  if public.current_profile_role() <> 'admin' and not (
    public.current_profile_role() = 'store' and target.ordering_store_id = public.current_profile_location()
  ) then raise exception 'Sem permissão.'; end if;
  if target.status = 'cancelled' then raise exception 'A encomenda está cancelada.'; end if;

  select * into selected_slot from public.seasonal_pickup_slots
  where id = p_pickup_slot_id and campaign_id = target.campaign_id and active;
  local_pickup := p_pickup_at at time zone 'Europe/Lisbon';
  if selected_slot.id is null or p_pickup_at <= now()
    or local_pickup::date <> selected_slot.pickup_date
    or local_pickup::time < selected_slot.opens_at
    or local_pickup::time >= selected_slot.closes_at
    or mod(
      floor(extract(epoch from (local_pickup::time - selected_slot.opens_at)) / 60)::integer,
      selected_slot.slot_minutes
    ) <> 0 then
    raise exception 'Escolha um horário disponível.';
  end if;
  if not exists (
    select 1 from public.locations
    where id = selected_slot.location_id and kind = 'store' and active
  ) then
    raise exception 'Loja responsável inválida.';
  end if;

  select * into settings from public.ordering_settings where id;
  clean_email := nullif(lower(trim(coalesce(p_customer_email, ''))), '');
  if length(trim(coalesce(p_customer_name, ''))) < 2 then raise exception 'Nome obrigatório.'; end if;
  if clean_email is not null and clean_email !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then raise exception 'Email inválido.'; end if;
  if settings.phone_required and length(trim(coalesce(p_customer_phone, ''))) < 6 then raise exception 'Telefone obrigatório.'; end if;
  if settings.general_notes_required and length(trim(coalesce(p_general_notes, ''))) = 0 then raise exception 'Observações obrigatórias.'; end if;
  perform public.assert_fulfillment_details(p_fulfillment_type, p_delivery_address);
  perform public.assert_valid_seasonal_revision_items(target.id, target.campaign_id, p_items);

  next_version := target.current_version + 1;
  insert into public.order_revisions (
    order_id, version, customer_name, customer_email, customer_phone,
    pickup_store_id, pickup_at, fulfillment_type, delivery_address, general_notes, created_by
  ) values (
    target.id, next_version, trim(p_customer_name), clean_email, nullif(trim(p_customer_phone), ''),
    selected_slot.location_id, p_pickup_at, p_fulfillment_type,
    case when p_fulfillment_type = 'delivery' then trim(p_delivery_address) else null end,
    trim(coalesce(p_general_notes, '')), auth.uid()
  ) returning id into revision_id;
  perform public.insert_seasonal_revision_items(revision_id, target.campaign_id, p_items);

  update public.orders set
    current_version = next_version,
    current_revision_id = revision_id,
    pickup_store_id = selected_slot.location_id,
    status = 'accepted',
    accepted_revision_id = revision_id,
    accepted_by = null,
    accepted_at = now(),
    rejected_by = null,
    rejected_at = null,
    rejection_reason = null,
    updated_at = now()
  where id = target.id;
  insert into public.order_events(order_id, revision_version, event_type, actor_id, metadata)
    values
      (target.id, next_version, 'revised', auth.uid(), jsonb_build_object('campaign_id', target.campaign_id, 'fulfillment_type', p_fulfillment_type)),
      (target.id, next_version, 'accepted', null, jsonb_build_object('campaign_id', target.campaign_id, 'automatic', true, 'fulfillment_type', p_fulfillment_type));
  insert into public.notification_outbox(order_id, revision_version, channel, kind, recipient)
    values (target.id, next_version, 'email', 'order_updated_accepted', clean_email);
  return next_version;
end;
$$;

create or replace function public.anonymize_expired_orders()
returns integer security definer set search_path = '' language plpgsql as $$
declare affected integer;
begin
  update public.order_revisions revision set
    customer_name = 'Dados removidos', customer_email = null, customer_phone = null,
    delivery_address = null, anonymized_at = now()
  from public.orders orders, public.ordering_settings settings
  where revision.order_id = orders.id and settings.id
    and revision.anonymized_at is null
    and orders.created_at < now() - make_interval(months => settings.retention_months);
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.assert_fulfillment_details(text,text) from public, anon, authenticated;
revoke all on function public.create_order(uuid,text,text,text,uuid,timestamptz,text,jsonb,text,text,uuid) from public, anon, authenticated;
revoke all on function public.submit_order_revision(uuid,text,text,text,uuid,timestamptz,text,jsonb,text,text) from public, anon, authenticated;
revoke all on function public.create_seasonal_order(uuid,uuid,text,text,text,uuid,timestamptz,text,jsonb,text,text,uuid) from public, anon, authenticated;
revoke all on function public.submit_seasonal_order_revision(uuid,text,text,text,uuid,timestamptz,text,jsonb,text,text) from public, anon, authenticated;

grant execute on function public.create_order(uuid,text,text,text,uuid,timestamptz,text,jsonb,text,text,uuid) to authenticated;
grant execute on function public.submit_order_revision(uuid,text,text,text,uuid,timestamptz,text,jsonb,text,text) to authenticated;
grant execute on function public.create_seasonal_order(uuid,uuid,text,text,text,uuid,timestamptz,text,jsonb,text,text,uuid) to authenticated;
grant execute on function public.submit_seasonal_order_revision(uuid,text,text,text,uuid,timestamptz,text,jsonb,text,text) to authenticated;
