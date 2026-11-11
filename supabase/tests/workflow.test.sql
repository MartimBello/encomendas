begin;
select plan(40);
truncate table public.orders cascade;

update public.products
set variations = array['Com recheio', 'Sem recheio']
where id = '30000000-0000-4000-8000-000000000001';

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000a002","role":"authenticated"}';

select lives_ok(
  $$ select public.create_order(
    '550e8400-e29b-41d4-a716-446655440099',
    'Cliente Teste', 'cliente@example.pt', '912345678',
    '10000000-0000-4000-8000-000000000003',
    ((date_trunc('week', now() at time zone 'Europe/Lisbon') + interval '2 weeks 10 hours') at time zone 'Europe/Lisbon'),
    '',
    '[{"product_id":"30000000-0000-4000-8000-000000000001","variation":"Com recheio","quantity":1,"note":""},{"product_id":"30000000-0000-4000-8000-000000000001","variation":"Sem recheio","quantity":1,"note":""}]'::jsonb,
    null
  ) $$,
  'store can create a valid order'
);

select is((select count(*)::integer from public.orders), 1, 'store creates one order');
select is((select status::text from public.orders limit 1), 'pending', 'new order is pending');
select is((select current_version from public.orders limit 1), 1, 'new order starts at version one');
select is((select count(*)::integer from public.order_events where event_type = 'created'), 1, 'creation is audited');
select is((select count(*)::integer from public.notification_outbox where kind = 'new_order'), 1, 'new order push is queued');
select is((select count(*)::integer from public.order_items), 2, 'different variations of the same product create separate order lines');
select is((select string_agg(variation_name, ', ' order by variation_name) from public.order_items), 'Com recheio, Sem recheio', 'regular order lines snapshot their selected variations');

select is(
  public.create_order(
    '550e8400-e29b-41d4-a716-446655440099',
    'Cliente Teste', 'cliente@example.pt', '912345678',
    '10000000-0000-4000-8000-000000000003',
    ((date_trunc('week', now() at time zone 'Europe/Lisbon') + interval '2 weeks 10 hours') at time zone 'Europe/Lisbon'),
    '',
    '[{"product_id":"30000000-0000-4000-8000-000000000001","variation":"Com recheio","quantity":1,"note":""},{"product_id":"30000000-0000-4000-8000-000000000001","variation":"Sem recheio","quantity":1,"note":""}]'::jsonb,
    null
  ),
  (select id from public.orders limit 1),
  'reusing the idempotency key returns the same order'
);
select is((select count(*)::integer from public.orders), 1, 'idempotent retry does not duplicate the order');

select throws_ok(
  $$ select public.accept_order((select id from public.orders limit 1), 1) $$,
  'P0001', 'Sem permissão.',
  'store cannot accept an order'
);
select throws_ok(
  $$ select public.acknowledge_cancellation((select id from public.orders limit 1)) $$,
  'P0001', 'Sem permissão.',
  'store cannot acknowledge a cancellation'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000a003","role":"authenticated"}';
select lives_ok(
  $$ select public.accept_order((select id from public.orders limit 1), 1) $$,
  'kitchen can accept the pending version'
);
select is((select status::text from public.orders limit 1), 'accepted', 'accepted status is persisted');
select ok((select accepted_revision_id = current_revision_id from public.orders limit 1), 'accepted revision is pinned');
select is((select count(*)::integer from public.notification_outbox where kind = 'order_accepted'), 1, 'acceptance email is queued');
select throws_ok(
  $$ select public.accept_order((select id from public.orders limit 1), 1) $$,
  'P0001', 'Esta versão já foi tratada ou alterada.',
  'a second kitchen decision loses the race'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000a002","role":"authenticated"}';
select lives_ok(
  $$ select public.submit_order_revision(
    (select id from public.orders limit 1),
    'Cliente Revisto', 'cliente@example.pt', '912345678',
    '10000000-0000-4000-8000-000000000003',
    ((date_trunc('week', now() at time zone 'Europe/Lisbon') + interval '2 weeks 10 hours') at time zone 'Europe/Lisbon'),
    'Sem cebola',
    '[{"product_id":"30000000-0000-4000-8000-000000000001","variation":"Com recheio","quantity":2,"note":""}]'::jsonb
  ) $$,
  'origin store can revise an accepted order'
);
select is((select status::text from public.orders limit 1), 'pending', 'revision returns the order to pending');
select is((select current_version from public.orders limit 1), 2, 'revision increments the version');
select is((select count(*)::integer from public.order_events where event_type = 'revised'), 1, 'revision is audited');
select is((select count(*)::integer from public.notification_outbox where kind = 'revised_order'), 1, 'revision push is queued');

set local role authenticated;
select is_empty(
  $$ update public.order_revisions set customer_name = 'Alterado' returning id $$,
  'authenticated users cannot mutate revision snapshots directly'
);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000a003","role":"authenticated"}';
select lives_ok(
  $$ select public.accept_order((select id from public.orders limit 1), 2) $$,
  'kitchen can re-accept the revised version'
);
select is((select count(*)::integer from public.notification_outbox where kind = 'order_updated_accepted'), 1, 'updated acceptance email is queued');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000a002","role":"authenticated"}';
select lives_ok(
  $$ select public.cancel_order((select id from public.orders limit 1)) $$,
  'origin store can cancel the accepted order'
);
select ok((select status = 'cancelled' and cancellation_requires_ack from public.orders limit 1), 'accepted cancellation is immediate and requires acknowledgment');
select is((select count(*)::integer from public.notification_outbox where kind = 'order_cancelled'), 1, 'cancellation email is queued');
select is((select count(*)::integer from public.notification_outbox where kind = 'accepted_order_cancelled'), 1, 'urgent cancellation push is queued');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000a003","role":"authenticated"}';
select lives_ok(
  $$ select public.acknowledge_cancellation((select id from public.orders limit 1)) $$,
  'kitchen can acknowledge an accepted-order cancellation'
);
select ok((select cancellation_acknowledged_at is not null from public.orders limit 1), 'acknowledgment is persisted');
select is((select count(*)::integer from public.order_events where event_type = 'cancellation_acknowledged'), 1, 'acknowledgment is audited');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000a002","role":"authenticated"}';
select lives_ok(
  $$ select public.create_order(
    '550e8400-e29b-41d4-a716-446655440100',
    'Cliente Rejeitado', 'rejeitado@example.pt', '912345678',
    '10000000-0000-4000-8000-000000000002',
    ((date_trunc('week', now() at time zone 'Europe/Lisbon') + interval '2 weeks 10 hours') at time zone 'Europe/Lisbon'),
    '',
    '[{"product_id":"30000000-0000-4000-8000-000000000001","variation":"Sem recheio","quantity":1,"note":""}]'::jsonb,
    null
  ) $$,
  'store can create another order for rejection'
);
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000a003","role":"authenticated"}';
select lives_ok(
  $$ select public.reject_order((select id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440100'), 1, '') $$,
  'kitchen can reject a pending order'
);
select is((select rejection_reason from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440100'), 'Sem disponibilidade', 'empty rejection uses the Portuguese default');
select is((select count(*)::integer from public.notification_outbox where kind = 'order_rejected'), 1, 'rejection email is queued');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000a002","role":"authenticated"}';
select lives_ok(
  $$ select public.create_order(
    '550e8400-e29b-41d4-a716-446655440101',
    'Cliente Sem Email', '', '912345678',
    '10000000-0000-4000-8000-000000000003',
    ((date_trunc('week', now() at time zone 'Europe/Lisbon') + interval '2 weeks 10 hours') at time zone 'Europe/Lisbon'),
    '',
    '[{"product_id":"30000000-0000-4000-8000-000000000001","variation":"Com recheio","quantity":1,"note":""}]'::jsonb,
    null
  ) $$,
  'store can create an order without an email'
);
select is((select customer_email from public.order_revisions where order_id = (select id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440101')), null::text, 'empty email is stored as null');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000a003","role":"authenticated"}';
select lives_ok(
  $$ select public.accept_order((select id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440101'), 1) $$,
  'kitchen can accept an order without an email'
);
select is((select count(*)::integer from public.notification_outbox where channel = 'email' and order_id = (select id from public.orders where idempotency_key = '550e8400-e29b-41d4-a716-446655440101')), 0, 'no email delivery is queued without a recipient');

select * from finish();
rollback;
