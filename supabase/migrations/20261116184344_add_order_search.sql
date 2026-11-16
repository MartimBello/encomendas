create or replace function public.search_orders(p_query text)
returns table(order_id uuid)
stable
security invoker
set search_path = ''
language sql
as $$
  select orders.id
  from public.orders
  join public.order_revisions revision on revision.id = orders.current_revision_id
  where length(trim(p_query)) > 0
    and (
      orders.order_number ilike '%' || trim(p_query) || '%'
      or coalesce(revision.customer_name, '') ilike '%' || trim(p_query) || '%'
    );
$$;

revoke all on function public.search_orders(text) from public, anon;
grant execute on function public.search_orders(text) to authenticated;
