create table public.weekly_menu_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.locations(id),
  reference_date date not null,
  menu_title text not null check (length(menu_title) between 1 and 200),
  source_updated_at timestamptz not null,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, reference_date)
);

create table public.weekly_menu_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.weekly_menu_orders(id) on delete cascade,
  day_key text not null check (length(day_key) between 1 and 80),
  day_label text not null check (length(day_label) between 1 and 120),
  category_key text not null check (length(category_key) between 1 and 80),
  category_label text not null check (length(category_label) between 1 and 120),
  dish_name text not null check (length(dish_name) between 1 and 200),
  box_p_quantity integer not null default 0 check (box_p_quantity >= 0),
  box_m_quantity integer not null default 0 check (box_m_quantity >= 0),
  pirex_quantity integer check (pirex_quantity is null or pirex_quantity > 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  check (
    (pirex_quantity is null and (box_p_quantity > 0 or box_m_quantity > 0))
    or (pirex_quantity is not null and box_p_quantity = 0 and box_m_quantity = 0)
  ),
  unique (order_id, day_key, category_key, dish_name)
);

create index weekly_menu_orders_store_week_idx
  on public.weekly_menu_orders(store_id, reference_date desc);
create index weekly_menu_order_items_order_position_idx
  on public.weekly_menu_order_items(order_id, position);

create trigger weekly_menu_orders_touch before update on public.weekly_menu_orders
for each row execute function public.touch_updated_at();

alter table public.weekly_menu_orders enable row level security;
alter table public.weekly_menu_order_items enable row level security;

create policy "weekly menu orders are visible by responsibility"
on public.weekly_menu_orders for select to authenticated
using (
  public.current_profile_role() in ('admin', 'kitchen')
  or (public.current_profile_role() = 'store' and store_id = public.current_profile_location())
);

create policy "weekly menu order items are visible by responsibility"
on public.weekly_menu_order_items for select to authenticated
using (
  exists (
    select 1 from public.weekly_menu_orders menu_order
    where menu_order.id = order_id
      and (
        public.current_profile_role() in ('admin', 'kitchen')
        or (public.current_profile_role() = 'store' and menu_order.store_id = public.current_profile_location())
      )
  )
);

create or replace function public.save_weekly_menu_order(
  p_reference_date date,
  p_menu_title text,
  p_source_updated_at timestamptz,
  p_items jsonb
)
returns uuid
security definer
set search_path = ''
language plpgsql
as $$
declare
  target_order_id uuid;
  target_store_id uuid;
  invalid_count integer;
begin
  if public.current_profile_role() <> 'store' then
    raise exception 'Apenas as lojas podem guardar encomendas da ementa.';
  end if;

  target_store_id := public.current_profile_location();
  if target_store_id is null then
    raise exception 'O utilizador não está associado a uma loja.';
  end if;

  if p_reference_date is null
    or length(trim(coalesce(p_menu_title, ''))) = 0
    or length(trim(p_menu_title)) > 200
    or p_source_updated_at is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) > 500 then
    raise exception 'Os dados da ementa são inválidos.';
  end if;

  select count(*) into invalid_count
  from jsonb_array_elements(p_items) item
  where length(trim(coalesce(item ->> 'day_key', ''))) = 0
    or length(trim(item ->> 'day_key')) > 80
    or length(trim(coalesce(item ->> 'day_label', ''))) = 0
    or length(trim(item ->> 'day_label')) > 120
    or length(trim(coalesce(item ->> 'category_key', ''))) = 0
    or length(trim(item ->> 'category_key')) > 80
    or length(trim(coalesce(item ->> 'category_label', ''))) = 0
    or length(trim(item ->> 'category_label')) > 120
    or length(trim(coalesce(item ->> 'dish_name', ''))) = 0
    or length(trim(item ->> 'dish_name')) > 200
    or coalesce((item ->> 'box_p_quantity')::integer, 0) < 0
    or coalesce((item ->> 'box_m_quantity')::integer, 0) < 0
    or (
      nullif(item ->> 'pirex_quantity', '') is null
      and coalesce((item ->> 'box_p_quantity')::integer, 0) = 0
      and coalesce((item ->> 'box_m_quantity')::integer, 0) = 0
    )
    or (
      nullif(item ->> 'pirex_quantity', '') is not null
      and (
        (item ->> 'pirex_quantity')::integer <= 0
        or coalesce((item ->> 'box_p_quantity')::integer, 0) <> 0
        or coalesce((item ->> 'box_m_quantity')::integer, 0) <> 0
      )
    );

  if invalid_count > 0 then
    raise exception 'Uma ou mais quantidades são inválidas.';
  end if;

  insert into public.weekly_menu_orders (
    store_id, reference_date, menu_title, source_updated_at, created_by, updated_by
  ) values (
    target_store_id, p_reference_date, trim(p_menu_title), p_source_updated_at, auth.uid(), auth.uid()
  )
  on conflict (store_id, reference_date) do update set
    menu_title = excluded.menu_title,
    source_updated_at = excluded.source_updated_at,
    updated_by = auth.uid()
  returning id into target_order_id;

  delete from public.weekly_menu_order_items where order_id = target_order_id;

  insert into public.weekly_menu_order_items (
    order_id, day_key, day_label, category_key, category_label, dish_name,
    box_p_quantity, box_m_quantity, pirex_quantity, position
  )
  select
    target_order_id,
    trim(item ->> 'day_key'),
    trim(item ->> 'day_label'),
    trim(item ->> 'category_key'),
    trim(item ->> 'category_label'),
    trim(item ->> 'dish_name'),
    coalesce((item ->> 'box_p_quantity')::integer, 0),
    coalesce((item ->> 'box_m_quantity')::integer, 0),
    nullif(item ->> 'pirex_quantity', '')::integer,
    coalesce((item ->> 'position')::integer, 0)
  from jsonb_array_elements(p_items) with ordinality values_with_position(item, ordinal_position)
  order by ordinal_position;

  return target_order_id;
end;
$$;

revoke all on function public.save_weekly_menu_order(date, text, timestamptz, jsonb) from public;
grant execute on function public.save_weekly_menu_order(date, text, timestamptz, jsonb) to authenticated;
