begin;
select plan(22);

select has_table('public', 'seasonal_campaigns', 'seasonal campaigns table exists');
select has_table('public', 'seasonal_products', 'seasonal products table exists');
select has_table('public', 'seasonal_pickup_slots', 'seasonal pickup slots table exists');
select has_column('public', 'orders', 'campaign_id', 'orders identify their seasonal campaign');
select has_column('public', 'seasonal_products', 'stock_limit', 'seasonal products can have a stock limit');
select has_column('public', 'order_items', 'seasonal_product_id', 'seasonal snapshots retain their stock identity');
select has_function('public', 'create_seasonal_order', array['uuid','uuid','text','text','text','uuid','timestamp with time zone','text','jsonb','uuid'], 'seasonal order RPC exists');

insert into public.seasonal_campaigns (id, name, slug, description, ordering_opens_at, ordering_closes_at, active)
values ('49000000-0000-4000-8000-000000000001', 'Natal teste', 'natal-teste', 'Menu de teste', now() - interval '1 day', now() + interval '1 day', true);
insert into public.seasonal_products (id, campaign_id, name, unit_label, minimum_quantity, quantity_step, stock_limit, requires_note)
values ('49100000-0000-4000-8000-000000000001', '49000000-0000-4000-8000-000000000001', 'Peru assado', 'kg', 2, 0.5, 3, true);
insert into public.seasonal_pickup_slots (id, campaign_id, location_id, pickup_date, opens_at, closes_at, slot_minutes)
values ('49200000-0000-4000-8000-000000000001', '49000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', (now() at time zone 'Europe/Lisbon')::date + 10, '09:00', '18:00', 30);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000a002","role":"authenticated"}';

select throws_ok(
  $$ select public.create_seasonal_order(
    '550e8400-e29b-41d4-a716-446655440201', '49000000-0000-4000-8000-000000000001',
    'Cliente Sazonal', 'sazonal@example.pt', '912345678', '49200000-0000-4000-8000-000000000001', (((now() at time zone 'Europe/Lisbon')::date + 10) + time '10:00') at time zone 'Europe/Lisbon', '',
    '[{"product_id":"49100000-0000-4000-8000-000000000001","quantity":2,"note":""}]'::jsonb, null
  ) $$,
  'P0001', 'Um ou mais artigos sazonais são inválidos ou estão indisponíveis.',
  'mandatory seasonal item notes are enforced'
);

select lives_ok(
  $$ select public.create_seasonal_order(
    '550e8400-e29b-41d4-a716-446655440202', '49000000-0000-4000-8000-000000000001',
    'Cliente Sazonal', 'sazonal@example.pt', '912345678', '49200000-0000-4000-8000-000000000001', (((now() at time zone 'Europe/Lisbon')::date + 10) + time '10:00') at time zone 'Europe/Lisbon', 'Encomenda de Natal',
    '[{"product_id":"49100000-0000-4000-8000-000000000001","quantity":2.5,"note":"Bem passado"}]'::jsonb, null
  ) $$,
  'store can create a seasonal order during its acceptance period'
);

select is((select campaign_id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440202'), '49000000-0000-4000-8000-000000000001'::uuid, 'order keeps its campaign');
select is((select status::text from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440202'), 'pending', 'seasonal order enters the normal pending workflow');
select is((select product_name from public.order_items where revision_id = (select current_revision_id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440202')), 'Peru assado', 'special menu name is snapshotted');
select is((select product_id from public.order_items where revision_id = (select current_revision_id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440202')), null::uuid, 'seasonal snapshot does not depend on the regular catalog');
select is((select seasonal_product_id from public.order_items where revision_id = (select current_revision_id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440202')), '49100000-0000-4000-8000-000000000001'::uuid, 'seasonal snapshot retains the product identity for stock accounting');
select is((select count(*)::integer from public.notification_outbox where kind = 'new_order' and order_id = (select id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440202')), 1, 'seasonal order queues the kitchen push');
select is(
  public.create_seasonal_order(
    '550e8400-e29b-41d4-a716-446655440202', '49000000-0000-4000-8000-000000000001',
    'Cliente Sazonal', 'sazonal@example.pt', '912345678', '49200000-0000-4000-8000-000000000001', (((now() at time zone 'Europe/Lisbon')::date + 10) + time '10:00') at time zone 'Europe/Lisbon', 'Encomenda de Natal',
    '[{"product_id":"49100000-0000-4000-8000-000000000001","quantity":2.5,"note":"Bem passado"}]'::jsonb, null
  ),
  (select id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440202'),
  'seasonal creation is idempotent'
);

select throws_ok(
  $$ select public.create_seasonal_order(
    '550e8400-e29b-41d4-a716-446655440205', '49000000-0000-4000-8000-000000000001',
    'Cliente Sem Stock', 'sem-stock@example.pt', '912345678', '49200000-0000-4000-8000-000000000001', (((now() at time zone 'Europe/Lisbon')::date + 10) + time '10:00') at time zone 'Europe/Lisbon', '',
    '[{"product_id":"49100000-0000-4000-8000-000000000001","quantity":2,"note":"Bem passado"}]'::jsonb, null
  ) $$,
  'P0001', 'Stock insuficiente para um ou mais artigos sazonais.',
  'pending seasonal orders reserve stock'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000a003","role":"authenticated"}';
select lives_ok(
  $$ select public.reject_order((select id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440202'), 1, 'Teste de stock') $$,
  'kitchen can reject the stock-reserving order'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000a002","role":"authenticated"}';
select lives_ok(
  $$ select public.create_seasonal_order(
    '550e8400-e29b-41d4-a716-446655440206', '49000000-0000-4000-8000-000000000001',
    'Cliente Com Stock', 'com-stock@example.pt', '912345678', '49200000-0000-4000-8000-000000000001', (((now() at time zone 'Europe/Lisbon')::date + 10) + time '10:00') at time zone 'Europe/Lisbon', '',
    '[{"product_id":"49100000-0000-4000-8000-000000000001","quantity":2,"note":"Bem passado"}]'::jsonb, null
  ) $$,
  'rejected seasonal orders release stock'
);

select throws_ok(
  $$ select public.create_seasonal_order(
    '550e8400-e29b-41d4-a716-446655440204', '49000000-0000-4000-8000-000000000001',
    'Cliente Fora de Horas', 'horas@example.pt', '912345678', '49200000-0000-4000-8000-000000000001', (((now() at time zone 'Europe/Lisbon')::date + 10) + time '18:30') at time zone 'Europe/Lisbon', '',
    '[{"product_id":"49100000-0000-4000-8000-000000000001","quantity":2.5,"note":"Bem passado"}]'::jsonb, null
  ) $$,
  'P0001', 'Escolha um horário de levantamento disponível.',
  'pickup must be inside the configured store opening range'
);

select throws_ok(
  $$ select public.submit_order_revision(
    (select id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440202'),
    'Cliente Sazonal', 'sazonal@example.pt', '912345678',
    '10000000-0000-4000-8000-000000000003',
    ((date_trunc('week', now() at time zone 'Europe/Lisbon') + interval '2 weeks 10 hours') at time zone 'Europe/Lisbon'),
    '', '[{"product_id":"30000000-0000-4000-8000-000000000001","quantity":1,"note":""}]'::jsonb
  ) $$,
  'P0001', 'As encomendas sazonais não podem usar o catálogo regular.',
  'regular catalog revisions cannot replace a seasonal menu'
);

update public.seasonal_campaigns set ordering_opens_at = now() - interval '3 days', ordering_closes_at = now() - interval '2 days' where id = '49000000-0000-4000-8000-000000000001';
select throws_ok(
  $$ select public.create_seasonal_order(
    '550e8400-e29b-41d4-a716-446655440203', '49000000-0000-4000-8000-000000000001',
    'Cliente Tardio', 'tardio@example.pt', '912345678', '49200000-0000-4000-8000-000000000001', (((now() at time zone 'Europe/Lisbon')::date + 10) + time '10:00') at time zone 'Europe/Lisbon', '',
    '[{"product_id":"49100000-0000-4000-8000-000000000001","quantity":2.5,"note":"Bem passado"}]'::jsonb, null
  ) $$,
  'P0001', 'Esta campanha não está a aceitar encomendas.',
  'closed campaigns reject new orders'
);

select * from finish();
rollback;
