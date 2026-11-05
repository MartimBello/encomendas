create or replace function public.prevent_seasonal_order_revision()
returns trigger set search_path = '' language plpgsql as $$
begin
  if new.version > 1 and exists (
    select 1 from public.orders where id = new.order_id and campaign_id is not null
  ) then
    raise exception 'As encomendas sazonais não podem usar o catálogo regular.';
  end if;
  return new;
end;
$$;

create trigger order_revisions_prevent_seasonal_revision
before insert on public.order_revisions
for each row execute function public.prevent_seasonal_order_revision();

revoke all on function public.prevent_seasonal_order_revision() from public, anon, authenticated;
