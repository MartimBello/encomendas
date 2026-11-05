alter table public.products
  add column variations text[] not null default '{}'
  check (cardinality(variations) <= 20);

alter table public.seasonal_products
  add column variations text[] not null default '{}'
  check (cardinality(variations) <= 20);

alter table public.order_items
  add column variation_name text not null default '';

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
    or (product.requires_note and length(trim(coalesce(item ->> 'note', ''))) = 0)
    or case
      when cardinality(product.variations) = 0
        then length(trim(coalesce(item ->> 'variation', ''))) > 0
      else not trim(coalesce(item ->> 'variation', '')) = any(product.variations)
    end;

  if invalid_count > 0 or (
    select count(*) <> count(distinct jsonb_build_array(item ->> 'product_id', trim(coalesce(item ->> 'variation', ''))))
    from jsonb_array_elements(p_items) item
  ) then
    raise exception 'Um ou mais artigos são inválidos ou estão indisponíveis.';
  end if;
end;
$$;

create or replace function public.insert_revision_items(p_revision_id uuid, p_items jsonb)
returns void security definer set search_path = '' language sql as $$
  insert into public.order_items (
    revision_id, product_id, product_name, variation_name, unit_label, quantity, item_note, position
  )
  select
    p_revision_id,
    product.id,
    product.name,
    trim(coalesce(item ->> 'variation', '')),
    product.unit_label,
    (item ->> 'quantity')::numeric,
    trim(coalesce(item ->> 'note', '')),
    ordinality::integer - 1
  from jsonb_array_elements(p_items) with ordinality as payload(item, ordinality)
  join public.products product on product.id = (item ->> 'product_id')::uuid;
$$;

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
    or (product.requires_note and length(trim(coalesce(item ->> 'note', ''))) = 0)
    or case
      when cardinality(product.variations) = 0
        then length(trim(coalesce(item ->> 'variation', ''))) > 0
      else not trim(coalesce(item ->> 'variation', '')) = any(product.variations)
    end;

  if invalid_count > 0 or (
    select count(*) <> count(distinct jsonb_build_array(item ->> 'product_id', trim(coalesce(item ->> 'variation', ''))))
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
    revision_id, product_id, seasonal_product_id, product_name, variation_name, unit_label,
    quantity, item_note, position
  )
  select
    p_revision_id,
    null,
    product.id,
    product.name,
    trim(coalesce(item ->> 'variation', '')),
    product.unit_label,
    (item ->> 'quantity')::numeric,
    trim(coalesce(item ->> 'note', '')),
    ordinality::integer - 1
  from jsonb_array_elements(p_items) with ordinality as payload(item, ordinality)
  join public.seasonal_products product
    on product.id = (item ->> 'product_id')::uuid and product.campaign_id = p_campaign_id;
$$;
