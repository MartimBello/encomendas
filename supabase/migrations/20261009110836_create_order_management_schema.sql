create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create type public.app_role as enum ('admin', 'store', 'kitchen');
create type public.location_type as enum ('store', 'kitchen');
create type public.order_status as enum ('pending', 'accepted', 'rejected', 'cancelled');
create type public.order_event_type as enum (
  'created', 'revised', 'accepted', 'rejected', 'cancelled', 'cancellation_acknowledged'
);
create type public.notification_channel as enum ('email', 'push');
create type public.notification_kind as enum (
  'new_order', 'revised_order', 'order_accepted', 'order_updated_accepted',
  'order_rejected', 'order_cancelled', 'accepted_order_cancelled'
);
create type public.delivery_status as enum ('pending', 'processing', 'sent', 'failed', 'dead');

create sequence public.order_number_sequence start 1;

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  kind public.location_type not null,
  address text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index one_active_kitchen
  on public.locations ((kind)) where kind = 'kitchen' and active;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.app_role,
  location_id uuid references public.locations(id),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_location_matches_role check (
    (role = 'admin' and location_id is null)
    or (role in ('store', 'kitchen') and location_id is not null)
    or role is null
  )
);

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.product_categories(id),
  name text not null,
  description text not null default '',
  unit_label text not null default 'un.',
  minimum_quantity numeric(10,3) not null default 1 check (minimum_quantity > 0),
  quantity_step numeric(10,3) not null default 1 check (quantity_step > 0),
  requires_note boolean not null default false,
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(category_id, name)
);

create table public.ordering_settings (
  id boolean primary key default true check (id),
  phone_required boolean not null default true,
  general_notes_required boolean not null default false,
  minimum_lead_minutes integer not null default 1440 check (minimum_lead_minutes >= 0),
  booking_horizon_days integer not null default 60 check (booking_horizon_days between 1 and 365),
  retention_months integer not null default 24 check (retention_months between 1 and 120),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.ordering_settings (id) values (true);

create table public.pickup_windows (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  slot_minutes integer not null default 30 check (slot_minutes between 5 and 240),
  active boolean not null default true,
  check (closes_at > opens_at),
  unique(location_id, weekday, opens_at, closes_at)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default (
    'ENC-' || to_char(current_date, 'YYYYMMDD') || '-' ||
    lpad(nextval('public.order_number_sequence')::text, 5, '0')
  ),
  idempotency_key uuid not null unique,
  ordering_store_id uuid not null references public.locations(id),
  pickup_store_id uuid not null references public.locations(id),
  status public.order_status not null default 'pending',
  current_version integer not null default 1 check (current_version > 0),
  current_revision_id uuid,
  accepted_revision_id uuid,
  created_by uuid not null references auth.users(id),
  accepted_by uuid references auth.users(id),
  rejected_by uuid references auth.users(id),
  cancelled_by uuid references auth.users(id),
  cancellation_acknowledged_by uuid references auth.users(id),
  accepted_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  cancellation_requires_ack boolean not null default false,
  cancellation_acknowledged_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_revisions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  version integer not null check (version > 0),
  customer_name text,
  customer_email text,
  customer_phone text,
  pickup_store_id uuid not null references public.locations(id),
  pickup_at timestamptz not null,
  general_notes text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  anonymized_at timestamptz,
  unique(order_id, version)
);

alter table public.orders
  add constraint orders_current_revision_fk foreign key (current_revision_id)
  references public.order_revisions(id),
  add constraint orders_accepted_revision_fk foreign key (accepted_revision_id)
  references public.order_revisions(id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.order_revisions(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text not null,
  unit_label text not null,
  quantity numeric(10,3) not null check (quantity > 0),
  item_note text not null default '',
  position integer not null default 0
);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  revision_version integer,
  event_type public.order_event_type not null,
  actor_id uuid references auth.users(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  revision_version integer,
  channel public.notification_channel not null,
  kind public.notification_kind not null,
  recipient text,
  status public.delivery_status not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique(order_id, revision_version, channel, kind)
);

create table public.notification_delivery_attempts (
  id bigint generated always as identity primary key,
  notification_id uuid not null references public.notification_outbox(id) on delete cascade,
  attempt_number integer not null,
  succeeded boolean not null,
  response_code integer,
  error_message text,
  created_at timestamptz not null default now()
);

create index orders_ordering_store_idx on public.orders(ordering_store_id, created_at desc);
create index orders_pickup_store_idx on public.orders(pickup_store_id, created_at desc);
create index orders_status_idx on public.orders(status, updated_at desc);
create index order_revisions_order_idx on public.order_revisions(order_id, version desc);
create index order_items_revision_idx on public.order_items(revision_id, position);
create index order_events_order_idx on public.order_events(order_id, created_at desc);
create index notification_outbox_pending_idx
  on public.notification_outbox(status, next_attempt_at) where status in ('pending', 'failed');

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger locations_touch before update on public.locations
for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();
create trigger categories_touch before update on public.product_categories
for each row execute function public.touch_updated_at();
create trigger products_touch before update on public.products
for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.ordering_settings
for each row execute function public.touch_updated_at();

create or replace function public.validate_profile_location()
returns trigger set search_path = '' language plpgsql as $$
declare selected_kind public.location_type; selected_active boolean;
begin
  if new.role in ('store', 'kitchen') then
    select kind, active into selected_kind, selected_active
    from public.locations where id = new.location_id;
    if selected_kind is null or not selected_active or selected_kind::text <> new.role::text then
      raise exception 'O local não é compatível com a função.';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_validate_location before insert or update of role, location_id, active on public.profiles
for each row execute function public.validate_profile_location();

create or replace function public.create_profile_for_user()
returns trigger security definer set search_path = '' language plpgsql as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger auth_user_profile after insert on auth.users
for each row execute function public.create_profile_for_user();

create or replace function public.current_profile_role()
returns public.app_role stable security definer set search_path = '' language sql as $$
  select role from public.profiles where id = auth.uid() and active;
$$;

create or replace function public.current_profile_location()
returns uuid stable security definer set search_path = '' language sql as $$
  select location_id from public.profiles where id = auth.uid() and active;
$$;

create or replace function public.can_read_order(target public.orders)
returns boolean stable security definer set search_path = '' language sql as $$
  select case public.current_profile_role()
    when 'admin' then true
    when 'kitchen' then true
    when 'store' then target.ordering_store_id = public.current_profile_location()
      or (target.pickup_store_id = public.current_profile_location() and target.status = 'accepted')
    else false
  end;
$$;

create or replace function public.assert_valid_items(p_items jsonb)
returns void security definer set search_path = '' language plpgsql as $$
declare invalid_count integer;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Adicione pelo menos um artigo.';
  end if;

  select count(*) into invalid_count
  from jsonb_array_elements(p_items) item
  left join public.products product on product.id = (item ->> 'product_id')::uuid
  where product.id is null or not product.active
    or coalesce((item ->> 'quantity')::numeric, 0) < product.minimum_quantity
    or mod(
      (coalesce((item ->> 'quantity')::numeric, 0) * 1000)::bigint,
      (product.quantity_step * 1000)::bigint
    ) <> 0
    or (product.requires_note and length(trim(coalesce(item ->> 'note', ''))) = 0);

  if invalid_count > 0 then
    raise exception 'Um ou mais artigos são inválidos ou estão indisponíveis.';
  end if;
end;
$$;

create or replace function public.insert_revision_items(p_revision_id uuid, p_items jsonb)
returns void security definer set search_path = '' language sql as $$
  insert into public.order_items (
    revision_id, product_id, product_name, unit_label, quantity, item_note, position
  )
  select
    p_revision_id,
    product.id,
    product.name,
    product.unit_label,
    (item ->> 'quantity')::numeric,
    trim(coalesce(item ->> 'note', '')),
    ordinality::integer - 1
  from jsonb_array_elements(p_items) with ordinality as payload(item, ordinality)
  join public.products product on product.id = (item ->> 'product_id')::uuid;
$$;

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
    raise exception 'Loja de levantamento inválida.';
  end if;
  if length(trim(coalesce(p_customer_name, ''))) < 2 then raise exception 'Nome obrigatório.'; end if;
  if trim(coalesce(p_customer_email, '')) !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then raise exception 'Email inválido.'; end if;
  if settings.phone_required and length(trim(coalesce(p_customer_phone, ''))) < 6 then raise exception 'Telefone obrigatório.'; end if;
  if settings.general_notes_required and length(trim(coalesce(p_general_notes, ''))) = 0 then raise exception 'Observações obrigatórias.'; end if;
  if p_pickup_at < now() + make_interval(mins => settings.minimum_lead_minutes)
     or p_pickup_at > now() + make_interval(days => settings.booking_horizon_days) then
    raise exception 'Horário de levantamento fora do período permitido.';
  end if;

  local_pickup := p_pickup_at at time zone 'Europe/Lisbon';
  if not exists (
    select 1 from public.pickup_windows pickup_window
    where pickup_window.location_id = p_pickup_store_id and pickup_window.active
      and pickup_window.weekday = extract(dow from local_pickup)::integer
      and local_pickup::time >= pickup_window.opens_at and local_pickup::time < pickup_window.closes_at
      and mod(
        floor(extract(epoch from (local_pickup::time - pickup_window.opens_at)) / 60)::integer,
        pickup_window.slot_minutes
      ) = 0
  ) then
    raise exception 'Escolha um horário de levantamento disponível.';
  end if;
end;
$$;

create or replace function public.create_order(
  p_idempotency_key uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_pickup_store_id uuid,
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
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  actor_role := public.current_profile_role();
  if actor_role not in ('store', 'admin') then raise exception 'Sem permissão.'; end if;

  select * into settings from public.ordering_settings where id;
  source_store := case when actor_role = 'store' then public.current_profile_location() else p_ordering_store_id end;
  if source_store is null then raise exception 'Loja de origem obrigatória.'; end if;
  if not exists (select 1 from public.locations where id = source_store and kind = 'store' and active) then
    raise exception 'Loja de origem inválida.';
  end if;
  if not exists (select 1 from public.locations where id = p_pickup_store_id and kind = 'store' and active) then
    raise exception 'Loja de levantamento inválida.';
  end if;
  if length(trim(coalesce(p_customer_name, ''))) < 2 then raise exception 'Nome obrigatório.'; end if;
  if trim(coalesce(p_customer_email, '')) !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then raise exception 'Email inválido.'; end if;
  if settings.phone_required and length(trim(coalesce(p_customer_phone, ''))) < 6 then raise exception 'Telefone obrigatório.'; end if;
  if settings.general_notes_required and length(trim(coalesce(p_general_notes, ''))) = 0 then raise exception 'Observações obrigatórias.'; end if;
  if p_pickup_at < now() + make_interval(mins => settings.minimum_lead_minutes)
     or p_pickup_at > now() + make_interval(days => settings.booking_horizon_days) then
    raise exception 'Horário de levantamento fora do período permitido.';
  end if;
  perform public.assert_valid_items(p_items);
  perform public.assert_order_details(p_customer_name, p_customer_email, p_customer_phone, p_pickup_store_id, p_pickup_at, p_general_notes);

  select id into result_id from public.orders where idempotency_key = p_idempotency_key;
  if result_id is not null then return result_id; end if;

  insert into public.orders (idempotency_key, ordering_store_id, pickup_store_id, created_by)
  values (p_idempotency_key, source_store, p_pickup_store_id, auth.uid())
  returning id into result_id;

  insert into public.order_revisions (
    order_id, version, customer_name, customer_email, customer_phone,
    pickup_store_id, pickup_at, general_notes, created_by
  ) values (
    result_id, 1, trim(p_customer_name), lower(trim(p_customer_email)), nullif(trim(p_customer_phone), ''),
    p_pickup_store_id, p_pickup_at, trim(coalesce(p_general_notes, '')), auth.uid()
  ) returning id into revision_id;

  perform public.insert_revision_items(revision_id, p_items);
  update public.orders set current_revision_id = revision_id where id = result_id;
  insert into public.order_events(order_id, revision_version, event_type, actor_id)
    values (result_id, 1, 'created', auth.uid());
  insert into public.notification_outbox(order_id, revision_version, channel, kind)
    values (result_id, 1, 'push', 'new_order');
  return result_id;
end;
$$;

create or replace function public.submit_order_revision(
  p_order_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_pickup_store_id uuid,
  p_pickup_at timestamptz,
  p_general_notes text,
  p_items jsonb
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
  perform public.assert_valid_items(p_items);
  perform public.assert_order_details(p_customer_name, p_customer_email, p_customer_phone, p_pickup_store_id, p_pickup_at, p_general_notes);
  if length(trim(coalesce(p_customer_name, ''))) < 2 or trim(coalesce(p_customer_email, '')) !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'Dados de cliente inválidos.';
  end if;

  next_version := target.current_version + 1;
  insert into public.order_revisions (
    order_id, version, customer_name, customer_email, customer_phone,
    pickup_store_id, pickup_at, general_notes, created_by
  ) values (
    target.id, next_version, trim(p_customer_name), lower(trim(p_customer_email)), nullif(trim(p_customer_phone), ''),
    p_pickup_store_id, p_pickup_at, trim(coalesce(p_general_notes, '')), auth.uid()
  ) returning id into revision_id;
  perform public.insert_revision_items(revision_id, p_items);

  update public.orders set
    current_version = next_version, current_revision_id = revision_id, pickup_store_id = p_pickup_store_id,
    status = 'pending', accepted_by = null, accepted_at = null, rejected_by = null,
    rejected_at = null, rejection_reason = null, updated_at = now()
  where id = target.id;
  insert into public.order_events(order_id, revision_version, event_type, actor_id)
    values (target.id, next_version, 'revised', auth.uid());
  insert into public.notification_outbox(order_id, revision_version, channel, kind)
    values (target.id, next_version, 'push', 'revised_order');
  return next_version;
end;
$$;

create or replace function public.accept_order(p_order_id uuid, p_expected_version integer)
returns void security definer set search_path = '' language plpgsql as $$
declare target public.orders; recipient text; notice_kind public.notification_kind;
begin
  if public.current_profile_role() not in ('kitchen', 'admin') then raise exception 'Sem permissão.'; end if;
  select * into target from public.orders where id = p_order_id for update;
  if target.status <> 'pending' or target.current_version <> p_expected_version then
    raise exception 'Esta versão já foi tratada ou alterada.';
  end if;
  update public.orders set status = 'accepted', accepted_by = auth.uid(), accepted_at = now(),
    accepted_revision_id = current_revision_id, updated_at = now() where id = target.id;
  insert into public.order_events(order_id, revision_version, event_type, actor_id)
    values (target.id, target.current_version, 'accepted', auth.uid());
  select customer_email into recipient from public.order_revisions where id = target.current_revision_id;
  notice_kind := case when target.current_version > 1 then 'order_updated_accepted' else 'order_accepted' end;
  insert into public.notification_outbox(order_id, revision_version, channel, kind, recipient)
    values (target.id, target.current_version, 'email', notice_kind, recipient);
end;
$$;

create or replace function public.reject_order(
  p_order_id uuid, p_expected_version integer, p_reason text default 'Sem disponibilidade'
)
returns void security definer set search_path = '' language plpgsql as $$
declare target public.orders; recipient text; clean_reason text;
begin
  if public.current_profile_role() not in ('kitchen', 'admin') then raise exception 'Sem permissão.'; end if;
  select * into target from public.orders where id = p_order_id for update;
  if target.status <> 'pending' or target.current_version <> p_expected_version then
    raise exception 'Esta versão já foi tratada ou alterada.';
  end if;
  clean_reason := coalesce(nullif(trim(p_reason), ''), 'Sem disponibilidade');
  update public.orders set status = 'rejected', rejected_by = auth.uid(), rejected_at = now(),
    rejection_reason = clean_reason, updated_at = now() where id = target.id;
  insert into public.order_events(order_id, revision_version, event_type, actor_id, metadata)
    values (target.id, target.current_version, 'rejected', auth.uid(), jsonb_build_object('reason', clean_reason));
  select customer_email into recipient from public.order_revisions where id = target.current_revision_id;
  insert into public.notification_outbox(order_id, revision_version, channel, kind, recipient)
    values (target.id, target.current_version, 'email', 'order_rejected', recipient);
end;
$$;

create or replace function public.cancel_order(p_order_id uuid)
returns void security definer set search_path = '' language plpgsql as $$
declare target public.orders; was_accepted boolean; recipient text;
begin
  select * into target from public.orders where id = p_order_id for update;
  if target.id is null then raise exception 'Encomenda não encontrada.'; end if;
  if public.current_profile_role() <> 'admin' and not (
    public.current_profile_role() = 'store' and target.ordering_store_id = public.current_profile_location()
  ) then raise exception 'Sem permissão.'; end if;
  if target.status = 'cancelled' then return; end if;
  was_accepted := target.status = 'accepted';
  update public.orders set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(),
    cancellation_requires_ack = was_accepted, cancellation_acknowledged_at = null,
    cancellation_acknowledged_by = null, updated_at = now() where id = target.id;
  insert into public.order_events(order_id, revision_version, event_type, actor_id, metadata)
    values (target.id, target.current_version, 'cancelled', auth.uid(), jsonb_build_object('was_accepted', was_accepted));
  select customer_email into recipient from public.order_revisions where id = target.current_revision_id;
  insert into public.notification_outbox(order_id, revision_version, channel, kind, recipient)
    values (target.id, target.current_version, 'email', 'order_cancelled', recipient);
  if was_accepted then
    insert into public.notification_outbox(order_id, revision_version, channel, kind)
      values (target.id, target.current_version, 'push', 'accepted_order_cancelled');
  end if;
end;
$$;

create or replace function public.acknowledge_cancellation(p_order_id uuid)
returns void security definer set search_path = '' language plpgsql as $$
declare target public.orders;
begin
  if public.current_profile_role() not in ('kitchen', 'admin') then raise exception 'Sem permissão.'; end if;
  select * into target from public.orders where id = p_order_id for update;
  if target.status <> 'cancelled' or not target.cancellation_requires_ack then
    raise exception 'Esta encomenda não tem um cancelamento por reconhecer.';
  end if;
  if target.cancellation_acknowledged_at is not null then return; end if;
  update public.orders set cancellation_acknowledged_at = now(),
    cancellation_acknowledged_by = auth.uid(), updated_at = now() where id = target.id;
  insert into public.order_events(order_id, revision_version, event_type, actor_id)
    values (target.id, target.current_version, 'cancellation_acknowledged', auth.uid());
end;
$$;

create or replace function public.anonymize_expired_orders()
returns integer security definer set search_path = '' language plpgsql as $$
declare affected integer;
begin
  update public.order_revisions revision set
    customer_name = 'Dados removidos', customer_email = null, customer_phone = null, anonymized_at = now()
  from public.orders orders, public.ordering_settings settings
  where revision.order_id = orders.id and settings.id
    and revision.anonymized_at is null
    and orders.created_at < now() - make_interval(months => settings.retention_months);
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.claim_notification_jobs(p_limit integer default 20)
returns setof public.notification_outbox
security definer set search_path = '' language plpgsql as $$
begin
  return query
  with selected as (
    select id from public.notification_outbox
    where status in ('pending', 'failed') and next_attempt_at <= now()
    order by created_at
    for update skip locked
    limit least(greatest(p_limit, 1), 100)
  )
  update public.notification_outbox jobs
  set status = 'processing', attempts = attempts + 1
  from selected
  where jobs.id = selected.id
  returning jobs.*;
end;
$$;

create or replace function public.prevent_revision_mutation()
returns trigger language plpgsql as $$
begin
  if current_user not in ('postgres', 'supabase_admin') then
    raise exception 'As revisões são imutáveis.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger revisions_immutable before update or delete on public.order_revisions
for each row execute function public.prevent_revision_mutation();
create trigger items_immutable before update or delete on public.order_items
for each row execute function public.prevent_revision_mutation();

alter table public.locations enable row level security;
alter table public.profiles enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.ordering_settings enable row level security;
alter table public.pickup_windows enable row level security;
alter table public.orders enable row level security;
alter table public.order_revisions enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.notification_delivery_attempts enable row level security;

create policy profiles_read on public.profiles for select to authenticated
using (id = auth.uid() or public.current_profile_role() = 'admin');
create policy profiles_admin_update on public.profiles for update to authenticated
using (public.current_profile_role() = 'admin') with check (public.current_profile_role() = 'admin');

create policy locations_read on public.locations for select to authenticated using (public.current_profile_role() is not null);
create policy locations_admin_all on public.locations for all to authenticated
using (public.current_profile_role() = 'admin') with check (public.current_profile_role() = 'admin');
create policy categories_read on public.product_categories for select to authenticated using (public.current_profile_role() is not null);
create policy categories_admin_all on public.product_categories for all to authenticated
using (public.current_profile_role() = 'admin') with check (public.current_profile_role() = 'admin');
create policy products_read on public.products for select to authenticated using (public.current_profile_role() is not null);
create policy products_admin_all on public.products for all to authenticated
using (public.current_profile_role() = 'admin') with check (public.current_profile_role() = 'admin');
create policy settings_read on public.ordering_settings for select to authenticated using (public.current_profile_role() is not null);
create policy settings_admin_update on public.ordering_settings for update to authenticated
using (public.current_profile_role() = 'admin') with check (public.current_profile_role() = 'admin');
create policy windows_read on public.pickup_windows for select to authenticated using (public.current_profile_role() is not null);
create policy windows_admin_all on public.pickup_windows for all to authenticated
using (public.current_profile_role() = 'admin') with check (public.current_profile_role() = 'admin');

create policy orders_read on public.orders for select to authenticated using (public.can_read_order(orders));
create policy revisions_read on public.order_revisions for select to authenticated
using (exists (select 1 from public.orders where orders.id = order_revisions.order_id and public.can_read_order(orders)));
create policy items_read on public.order_items for select to authenticated
using (exists (
  select 1 from public.order_revisions join public.orders on orders.id = order_revisions.order_id
  where order_revisions.id = order_items.revision_id and public.can_read_order(orders)
));
create policy events_read on public.order_events for select to authenticated
using (exists (select 1 from public.orders where orders.id = order_events.order_id and public.can_read_order(orders)));

create policy push_own_read on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy push_own_insert on public.push_subscriptions for insert to authenticated with check (
  user_id = auth.uid() and public.current_profile_role() in ('kitchen', 'admin')
);
create policy push_own_update on public.push_subscriptions for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_own_delete on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());
create policy outbox_admin_read on public.notification_outbox for select to authenticated
using (public.current_profile_role() = 'admin');
create policy attempts_admin_read on public.notification_delivery_attempts for select to authenticated
using (public.current_profile_role() = 'admin');

grant execute on function public.create_order(uuid,text,text,text,uuid,timestamptz,text,jsonb,uuid) to authenticated;
grant execute on function public.submit_order_revision(uuid,text,text,text,uuid,timestamptz,text,jsonb) to authenticated;
grant execute on function public.accept_order(uuid,integer) to authenticated;
grant execute on function public.reject_order(uuid,integer,text) to authenticated;
grant execute on function public.cancel_order(uuid) to authenticated;
grant execute on function public.acknowledge_cancellation(uuid) to authenticated;
revoke all on function public.anonymize_expired_orders() from public, anon, authenticated;
revoke all on function public.claim_notification_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_jobs(integer) to service_role;

select cron.schedule(
  'anonymize-expired-order-customer-data',
  '20 3 * * *',
  'select public.anonymize_expired_orders()'
);

alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_events;
