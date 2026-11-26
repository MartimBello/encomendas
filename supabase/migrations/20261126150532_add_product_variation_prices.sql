create function public.valid_variation_prices(p_variations text[], p_prices jsonb)
returns boolean
immutable
language plpgsql
set search_path = ''
as $$
declare
  price record;
  numeric_price numeric;
begin
  if jsonb_typeof(p_prices) <> 'object' then
    return false;
  end if;

  for price in select key, value from jsonb_each(p_prices)
  loop
    if not price.key = any(p_variations) or jsonb_typeof(price.value) <> 'number' then
      return false;
    end if;

    numeric_price := (price.value #>> '{}')::numeric;
    if numeric_price < 0 or numeric_price > 100000000 or numeric_price <> trunc(numeric_price) then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

alter table public.products
  add column variation_prices jsonb not null default '{}'::jsonb,
  add constraint products_variation_prices_valid
    check (public.valid_variation_prices(variations, variation_prices));

alter table public.seasonal_products
  add column variation_prices jsonb not null default '{}'::jsonb,
  add constraint seasonal_products_variation_prices_valid
    check (public.valid_variation_prices(variations, variation_prices));
