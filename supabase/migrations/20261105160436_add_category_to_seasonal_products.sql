alter table public.seasonal_products
  add column category_id uuid references public.product_categories(id);

create index seasonal_products_category_idx
  on public.seasonal_products(campaign_id, category_id, position);
