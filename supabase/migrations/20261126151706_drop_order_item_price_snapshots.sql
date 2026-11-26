create or replace function public.insert_revision_items(p_revision_id uuid, p_items jsonb)
returns void security definer set search_path = '' language sql as $$
  insert into public.order_items (
    revision_id, product_id, product_name, variation_name, unit_label, quantity,
    unit_weights, unit_weight_label, item_note, position
  )
  select
    p_revision_id,
    product.id,
    product.name,
    trim(coalesce(item ->> 'variation', '')),
    case when product.quantity_mode = 'selection' then '×' else product.unit_label end,
    (item ->> 'quantity')::numeric,
    public.item_unit_weights(item),
    case when product.quantity_mode = 'unit_weight' then product.unit_weight_label else '' end,
    trim(coalesce(item ->> 'note', '')),
    ordinality::integer - 1
  from jsonb_array_elements(p_items) with ordinality as payload(item, ordinality)
  join public.products product on product.id = (item ->> 'product_id')::uuid;
$$;

create or replace function public.insert_seasonal_revision_items(p_revision_id uuid, p_campaign_id uuid, p_items jsonb)
returns void security definer set search_path = '' language sql as $$
  insert into public.order_items (
    revision_id, product_id, seasonal_product_id, product_name, variation_name, unit_label,
    quantity, unit_weights, unit_weight_label, item_note, position
  )
  select
    p_revision_id,
    null,
    product.id,
    product.name,
    trim(coalesce(item ->> 'variation', '')),
    case when product.quantity_mode = 'selection' then '×' else product.unit_label end,
    (item ->> 'quantity')::numeric,
    public.item_unit_weights(item),
    case when product.quantity_mode = 'unit_weight' then product.unit_weight_label else '' end,
    trim(coalesce(item ->> 'note', '')),
    ordinality::integer - 1
  from jsonb_array_elements(p_items) with ordinality as payload(item, ordinality)
  join public.seasonal_products product
    on product.id = (item ->> 'product_id')::uuid and product.campaign_id = p_campaign_id;
$$;

alter table public.order_items
  drop column unit_price_cents,
  drop column estimated_total_cents;
