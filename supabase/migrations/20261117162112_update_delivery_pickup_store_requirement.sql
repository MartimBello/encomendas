alter table public.orders alter column pickup_store_id drop not null;
alter table public.order_revisions alter column pickup_store_id drop not null;

alter table public.order_revisions disable trigger revisions_immutable;
update public.order_revisions
set pickup_store_id = null
where fulfillment_type = 'delivery';
alter table public.order_revisions enable trigger revisions_immutable;

update public.orders orders
set pickup_store_id = null
from public.order_revisions revision
where revision.id = orders.current_revision_id
  and revision.fulfillment_type = 'delivery';

alter table public.order_revisions
  add constraint order_revisions_pickup_store_requirement_check
  check (
    (fulfillment_type = 'pickup' and pickup_store_id is not null)
    or (fulfillment_type = 'delivery' and pickup_store_id is null)
  );

create or replace function public.normalize_revision_pickup_store()
returns trigger security definer set search_path = '' language plpgsql as $$
begin
  if new.fulfillment_type = 'delivery' then
    new.pickup_store_id := null;
  end if;
  return new;
end;
$$;

create trigger normalize_revision_pickup_store
before insert on public.order_revisions
for each row execute function public.normalize_revision_pickup_store();

create or replace function public.sync_order_pickup_store()
returns trigger security definer set search_path = '' language plpgsql as $$
declare
  revision_fulfillment_type text;
begin
  if new.current_revision_id is not null then
    select fulfillment_type into revision_fulfillment_type
    from public.order_revisions
    where id = new.current_revision_id;

    if revision_fulfillment_type = 'delivery' then
      new.pickup_store_id := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger sync_order_pickup_store
before update of current_revision_id, pickup_store_id on public.orders
for each row execute function public.sync_order_pickup_store();

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
  schedule_store_id uuid;
begin
  select * into settings from public.ordering_settings where id;
  schedule_store_id := coalesce(p_pickup_store_id, public.current_profile_location());
  if not exists (select 1 from public.locations where id = schedule_store_id and kind = 'store' and active) then
    raise exception 'Loja de receção inválida.';
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
    where pickup_window.location_id = schedule_store_id and pickup_window.active
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

revoke all on function public.normalize_revision_pickup_store() from public, anon, authenticated;
revoke all on function public.sync_order_pickup_store() from public, anon, authenticated;
