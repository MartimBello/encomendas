alter table public.products
  add column variation_prices_cents jsonb not null default '{}'::jsonb
  check (jsonb_typeof(variation_prices_cents) = 'object');

alter table public.seasonal_products
  add column variation_prices_cents jsonb not null default '{}'::jsonb
  check (jsonb_typeof(variation_prices_cents) = 'object');

update public.products product
set variation_prices_cents = (
  select jsonb_object_agg(variation, product.unit_price_cents)
  from unnest(product.variations) variation
)
where product.unit_price_cents is not null and cardinality(product.variations) > 0;

update public.seasonal_products product
set variation_prices_cents = (
  select jsonb_object_agg(variation, product.unit_price_cents)
  from unnest(product.variations) variation
)
where product.unit_price_cents is not null and cardinality(product.variations) > 0;

create or replace function public.insert_revision_items(p_revision_id uuid, p_items jsonb)
returns void security definer set search_path = '' language sql as $$
  insert into public.order_items (
    revision_id, product_id, product_name, variation_name, unit_label, quantity,
    unit_weights, unit_weight_label, item_note, position, unit_price_cents, estimated_total_cents
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
    ordinality::integer - 1,
    price.unit_price_cents,
    case when price.unit_price_cents is null then null else round(
      price.unit_price_cents * case
        when product.quantity_mode = 'unit_weight'
          then coalesce((select sum(value) from unnest(public.item_unit_weights(item)) as weights(value)), 0)
        else (item ->> 'quantity')::numeric
      end
    )::bigint end
  from jsonb_array_elements(p_items) with ordinality as payload(item, ordinality)
  join public.products product on product.id = (item ->> 'product_id')::uuid
  cross join lateral (
    select case when cardinality(product.variations) > 0
      then (product.variation_prices_cents ->> trim(coalesce(item ->> 'variation', '')))::integer
      else product.unit_price_cents
    end as unit_price_cents
  ) price;
$$;

create or replace function public.insert_seasonal_revision_items(p_revision_id uuid, p_campaign_id uuid, p_items jsonb)
returns void security definer set search_path = '' language sql as $$
  insert into public.order_items (
    revision_id, product_id, seasonal_product_id, product_name, variation_name, unit_label,
    quantity, unit_weights, unit_weight_label, item_note, position, unit_price_cents, estimated_total_cents
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
    ordinality::integer - 1,
    price.unit_price_cents,
    case when price.unit_price_cents is null then null else round(
      price.unit_price_cents * case
        when product.quantity_mode = 'unit_weight'
          then coalesce((select sum(value) from unnest(public.item_unit_weights(item)) as weights(value)), 0)
        else (item ->> 'quantity')::numeric
      end
    )::bigint end
  from jsonb_array_elements(p_items) with ordinality as payload(item, ordinality)
  join public.seasonal_products product
    on product.id = (item ->> 'product_id')::uuid and product.campaign_id = p_campaign_id
  cross join lateral (
    select case when cardinality(product.variations) > 0
      then (product.variation_prices_cents ->> trim(coalesce(item ->> 'variation', '')))::integer
      else product.unit_price_cents
    end as unit_price_cents
  ) price;
$$;
