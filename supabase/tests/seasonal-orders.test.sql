begin;
select plan(37);

select has_table('public', 'seasonal_campaigns', 'seasonal campaigns table exists');
select has_table('public', 'seasonal_products', 'seasonal products table exists');
select has_table('public', 'seasonal_pickup_slots', 'seasonal pickup slots table exists');
select has_column('public', 'orders', 'campaign_id', 'orders identify their seasonal campaign');
select has_column('public', 'seasonal_products', 'stock_limit', 'seasonal products can have a stock limit');
select has_column('public', 'seasonal_products', 'category_id', 'seasonal products can be assigned to a category');
select has_column('public', 'seasonal_products', 'variations', 'seasonal products can define variations');
select has_column('public', 'order_items', 'seasonal_product_id', 'seasonal snapshots retain their stock identity');
select has_column('public', 'order_items', 'variation_name', 'order lines snapshot their variation');
select has_function('public', 'create_seasonal_order', array['uuid','uuid','text','text','text','uuid','timestamp with time zone','text','jsonb','uuid'], 'seasonal order RPC exists');
select has_function('public', 'submit_seasonal_order_revision', array['uuid','text','text','text','uuid','timestamp with time zone','text','jsonb'], 'seasonal revision RPC exists');

insert into public.seasonal_campaigns (id, name, slug, description, ordering_opens_at, ordering_closes_at, active)
values ('49000000-0000-4000-8000-000000000001', 'Natal teste', 'natal-teste', 'Menu de teste', now() - interval '1 day', now() + interval '1 day', true);
insert into public.seasonal_products (id, campaign_id, name, unit_label, minimum_quantity, quantity_step, variations, stock_limit, requires_note)
values ('49100000-0000-4000-8000-000000000001', '49000000-0000-4000-8000-000000000001', 'Peru assado', 'kg', 2, 0.5, array['Com recheio', 'Sem recheio'], 3, true);
insert into public.seasonal_pickup_slots (id, campaign_id, location_id, pickup_date, opens_at, closes_at, slot_minutes)
values ('49200000-0000-4000-8000-000000000001', '49000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', (now() at time zone 'Europe/Lisbon')::date + 10, '09:00', '18:00', 30);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000a002","role":"authenticated"}';

select throws_ok(
  $$ select public.create_seasonal_order(
    '550e8400-e29b-41d4-a716-446655440201', '49000000-0000-4000-8000-000000000001',
    'Cliente Sazonal', 'sazonal@example.pt', '912345678', '49200000-0000-4000-8000-000000000001', (((now() at time zone 'Europe/Lisbon')::date + 10) + time '10:00') at time zone 'Europe/Lisbon', '',
    '[{"product_id":"49100000-0000-4000-8000-000000000001","variation":"Com recheio","quantity":2,"note":""}]'::jsonb, null
  ) $$,
  'P0001', 'Um ou mais artigos sazonais são inválidos ou estão indisponíveis.',
  'mandatory seasonal item notes are enforced'
);

select throws_ok(
  $$ select public.create_seasonal_order(
    '550e8400-e29b-41d4-a716-446655440207', '49000000-0000-4000-8000-000000000001',
    'Cliente Sazonal', 'sazonal@example.pt', '912345678', '49200000-0000-4000-8000-000000000001', (((now() at time zone 'Europe/Lisbon')::date + 10) + time '10:00') at time zone 'Europe/Lisbon', '',
    '[{"product_id":"49100000-0000-4000-8000-000000000001","quantity":2,"note":"Bem passado"}]'::jsonb, null
  ) $$,
  'P0001', 'Um ou mais artigos sazonais são inválidos ou estão indisponíveis.',
  'a variation is required when the seasonal product defines choices'
);

select lives_ok(
  $$ select public.create_seasonal_order(
    '550e8400-e29b-41d4-a716-446655440202', '49000000-0000-4000-8000-000000000001',
    'Cliente Sazonal', 'sazonal@example.pt', '912345678', '49200000-0000-4000-8000-000000000001', (((now() at time zone 'Europe/Lisbon')::date + 10) + time '10:00') at time zone 'Europe/Lisbon', 'Encomenda de Natal',
    '[{"product_id":"49100000-0000-4000-8000-000000000001","variation":"Com recheio","quantity":2.5,"note":"Bem passado"}]'::jsonb, null
  ) $$,
  'store can create a seasonal order during its acceptance period'
);

select is((select campaign_id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440202'), '49000000-0000-4000-8000-000000000001'::uuid, 'order keeps its campaign');
select is((select status::text from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440202'), 'accepted', 'seasonal order is confirmed automatically');
select ok((select accepted_revision_id = current_revision_id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440202'), 'automatic confirmation pins the created revision');
select is((select product_name from public.order_items where revision_id = (select current_revision_id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440202')), 'Peru assado', 'special menu name is snapshotted');
select is((select variation_name from public.order_items where revision_id = (select current_revision_id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440202')), 'Com recheio', 'selected variation is snapshotted');
select is((select product_id from public.order_items where revision_id = (select current_revision_id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440202')), null::uuid, 'seasonal snapshot does not depend on the regular catalog');
select is((select seasonal_product_id from public.order_items where revision_id = (select current_revision_id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440202')), '49100000-0000-4000-8000-000000000001'::uuid, 'seasonal snapshot retains the product identity for stock accounting');
select is((select count(*)::integer from public.notification_outbox where kind = 'new_order' and order_id = (select id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440202')), 0, 'seasonal order does not queue a kitchen acceptance push');
select is((select count(*)::integer from public.notification_outbox where kind = 'order_accepted' and channel = 'email' and order_id = (select id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440202')), 1, 'seasonal order queues its confirmation email');
select is((select recipient from public.notification_outbox where kind = 'order_accepted' and channel = 'email' and order_id = (select id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440202')), 'sazonal@example.pt', 'seasonal confirmation email keeps its recipient');
select is((select count(*)::integer from public.order_events where event_type = 'accepted' and metadata ->> 'automatic' = 'true' and order_id = (select id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440202')), 1, 'automatic confirmation is audited');
select is(
  public.create_seasonal_order(
    '550e8400-e29b-41d4-a716-446655440202', '49000000-0000-4000-8000-000000000001',
    'Cliente Sazonal', 'sazonal@example.pt', '912345678', '49200000-0000-4000-8000-000000000001', (((now() at time zone 'Europe/Lisbon')::date + 10) + time '10:00') at time zone 'Europe/Lisbon', 'Encomenda de Natal',
    '[{"product_id":"49100000-0000-4000-8000-000000000001","variation":"Com recheio","quantity":2.5,"note":"Bem passado"}]'::jsonb, null
  ),
  (select id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440202'),
  'seasonal creation is idempotent'
);

select throws_ok(
  $$ select public.create_seasonal_order(
    '550e8400-e29b-41d4-a716-446655440205', '49000000-0000-4000-8000-000000000001',
    'Cliente Sem Stock', 'sem-stock@example.pt', '912345678', '49200000-0000-4000-8000-000000000001', (((now() at time zone 'Europe/Lisbon')::date + 10) + time '10:00') at time zone 'Europe/Lisbon', '',
    '[{"product_id":"49100000-0000-4000-8000-000000000001","variation":"Sem recheio","quantity":2,"note":"Bem passado"}]'::jsonb, null
  ) $$,
  'P0001', 'Stock insuficiente para um ou mais artigos sazonais.',
  'automatically accepted seasonal orders reserve stock'
);

select lives_ok(
  $$ select public.cancel_order((select id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440202')) $$,
  'store can cancel the stock-reserving seasonal order'
);

select lives_ok(
  $$ select public.create_seasonal_order(
    '550e8400-e29b-41d4-a716-446655440206', '49000000-0000-4000-8000-000000000001',
    'Cliente Com Stock', 'com-stock@example.pt', '912345678', '49200000-0000-4000-8000-000000000001', (((now() at time zone 'Europe/Lisbon')::date + 10) + time '10:00') at time zone 'Europe/Lisbon', '',
    '[{"product_id":"49100000-0000-4000-8000-000000000001","variation":"Sem recheio","quantity":2,"note":"Bem passado"}]'::jsonb, null
  ) $$,
  'cancelled seasonal orders release stock'
);

select lives_ok(
  $$ select public.submit_seasonal_order_revision(
    (select id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440206'),
    'Cliente Sazonal Revisto', '', '912345678',
    '49200000-0000-4000-8000-000000000001',
    (((now() at time zone 'Europe/Lisbon')::date + 10) + time '10:30') at time zone 'Europe/Lisbon',
    'Versão revista',
    '[{"product_id":"49100000-0000-4000-8000-000000000001","variation":"Sem recheio","quantity":2.5,"note":"Bem passado"}]'::jsonb
  ) $$,
  'store can revise a seasonal order with its campaign menu'
);
select ok((select current_version = 2 and status = 'accepted' and accepted_revision_id = current_revision_id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440206'), 'seasonal revision is versioned and confirmed automatically');
select is((select quantity from public.order_items where revision_id = (select current_revision_id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440206')), 2.500::numeric, 'seasonal revision replaces the reserved quantity without double counting stock');
select is((select customer_email from public.order_revisions where id = (select current_revision_id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440206')), null::text, 'seasonal revision stores an empty email as null');
select is((select count(*)::integer from public.notification_outbox where kind = 'order_updated_accepted' and order_id = (select id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440206')), 0, 'seasonal revision without email does not queue a delivery');

select throws_ok(
  $$ select public.create_seasonal_order(
    '550e8400-e29b-41d4-a716-446655440204', '49000000-0000-4000-8000-000000000001',
    'Cliente Fora de Horas', 'horas@example.pt', '912345678', '49200000-0000-4000-8000-000000000001', (((now() at time zone 'Europe/Lisbon')::date + 10) + time '18:30') at time zone 'Europe/Lisbon', '',
    '[{"product_id":"49100000-0000-4000-8000-000000000001","variation":"Com recheio","quantity":2.5,"note":"Bem passado"}]'::jsonb, null
  ) $$,
  'P0001', 'Escolha um horário de levantamento disponível.',
  'pickup must be inside the configured store opening range'
);

select throws_ok(
  $$ select public.submit_order_revision(
    (select id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440206'),
    'Cliente Sazonal', 'sazonal@example.pt', '912345678',
    '10000000-0000-4000-8000-000000000003',
    ((date_trunc('week', now() at time zone 'Europe/Lisbon') + interval '2 weeks 10 hours') at time zone 'Europe/Lisbon'),
    '', '[{"product_id":"30000000-0000-4000-8000-000000000001","quantity":1,"note":""}]'::jsonb
  ) $$,
  'P0001', 'Use a edição própria da campanha sazonal.',
  'regular catalog revisions cannot replace a seasonal menu'
);

update public.seasonal_campaigns set ordering_opens_at = now() - interval '3 days', ordering_closes_at = now() - interval '2 days' where id = '49000000-0000-4000-8000-000000000001';
select throws_ok(
  $$ select public.create_seasonal_order(
    '550e8400-e29b-41d4-a716-446655440203', '49000000-0000-4000-8000-000000000001',
    'Cliente Tardio', 'tardio@example.pt', '912345678', '49200000-0000-4000-8000-000000000001', (((now() at time zone 'Europe/Lisbon')::date + 10) + time '10:00') at time zone 'Europe/Lisbon', '',
    '[{"product_id":"49100000-0000-4000-8000-000000000001","variation":"Com recheio","quantity":2.5,"note":"Bem passado"}]'::jsonb, null
  ) $$,
  'P0001', 'Esta campanha não está a aceitar encomendas.',
  'closed campaigns reject new orders'
);

select * from finish();
rollback;
