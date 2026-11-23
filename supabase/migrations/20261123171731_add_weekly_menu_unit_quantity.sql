alter table public.weekly_menu_order_items
  add column unit_quantity integer check (unit_quantity is null or unit_quantity > 0),
  add column not_required boolean not null default false;

alter table public.weekly_menu_order_items
  drop constraint weekly_menu_order_items_check;

alter table public.weekly_menu_order_items
  add constraint weekly_menu_order_items_quantity_mode_check check (
    (not not_required and pirex_quantity is null and unit_quantity is null and (box_p_quantity > 0 or box_m_quantity > 0))
    or (not not_required and pirex_quantity is not null and unit_quantity is null and box_p_quantity = 0 and box_m_quantity = 0)
    or (not not_required and pirex_quantity is null and unit_quantity is not null and box_p_quantity = 0 and box_m_quantity = 0)
    or (not_required and pirex_quantity is null and unit_quantity is null and box_p_quantity = 0 and box_m_quantity = 0)
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
    or not (
      (
        nullif(item ->> 'pirex_quantity', '') is null
        and nullif(item ->> 'unit_quantity', '') is null
        and not coalesce((item ->> 'not_required')::boolean, false)
        and (
          coalesce((item ->> 'box_p_quantity')::integer, 0) > 0
          or coalesce((item ->> 'box_m_quantity')::integer, 0) > 0
        )
      )
      or (
        nullif(item ->> 'pirex_quantity', '') is not null
        and (item ->> 'pirex_quantity')::integer > 0
        and nullif(item ->> 'unit_quantity', '') is null
        and not coalesce((item ->> 'not_required')::boolean, false)
        and coalesce((item ->> 'box_p_quantity')::integer, 0) = 0
        and coalesce((item ->> 'box_m_quantity')::integer, 0) = 0
      )
      or (
        nullif(item ->> 'pirex_quantity', '') is null
        and nullif(item ->> 'unit_quantity', '') is not null
        and (item ->> 'unit_quantity')::integer > 0
        and not coalesce((item ->> 'not_required')::boolean, false)
        and coalesce((item ->> 'box_p_quantity')::integer, 0) = 0
        and coalesce((item ->> 'box_m_quantity')::integer, 0) = 0
      )
      or (
        coalesce((item ->> 'not_required')::boolean, false)
        and nullif(item ->> 'pirex_quantity', '') is null
        and nullif(item ->> 'unit_quantity', '') is null
        and coalesce((item ->> 'box_p_quantity')::integer, 0) = 0
        and coalesce((item ->> 'box_m_quantity')::integer, 0) = 0
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
    box_p_quantity, box_m_quantity, pirex_quantity, unit_quantity, not_required, position
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
    nullif(item ->> 'unit_quantity', '')::integer,
    coalesce((item ->> 'not_required')::boolean, false),
    coalesce((item ->> 'position')::integer, 0)
  from jsonb_array_elements(p_items) with ordinality values_with_position(item, ordinal_position)
  order by ordinal_position;

  return target_order_id;
end;
$$;
