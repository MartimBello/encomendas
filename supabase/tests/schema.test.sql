begin;
select plan(9);

select has_table('public', 'orders', 'orders table exists');
select has_table('public', 'order_revisions', 'order revisions table exists');
select has_table('public', 'notification_outbox', 'notification outbox exists');
select has_function('public', 'create_order', array['uuid','text','text','text','uuid','timestamp with time zone','text','jsonb','uuid'], 'create_order RPC exists');
select has_function('public', 'accept_order', array['uuid','integer'], 'accept_order RPC exists');
select has_function('public', 'reject_order', array['uuid','integer','text'], 'reject_order RPC exists');
select col_is_pk('public', 'orders', 'id', 'orders has a primary key');
select col_is_unique('public', 'orders', 'idempotency_key', 'idempotency keys are unique');
select policies_are('public', 'orders', array['orders_read'], 'orders only expose the read policy');

select * from finish();
rollback;
