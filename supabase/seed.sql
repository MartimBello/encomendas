insert into public.locations (id, name, kind, address) values
  ('10000000-0000-4000-8000-000000000001', 'Cozinha Central', 'kitchen', 'Porto'),
  ('10000000-0000-4000-8000-000000000002', 'Loja da Boavista', 'store', 'Avenida da Boavista, Porto'),
  ('10000000-0000-4000-8000-000000000003', 'Loja de Matosinhos', 'store', 'Matosinhos')
on conflict (id) do nothing;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current,
  reauthentication_token, email_change_confirm_status,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  is_super_admin, is_sso_user, is_anonymous
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000a001', 'authenticated', 'authenticated', 'admin@encomendas.local', extensions.crypt('Encomendas123!', extensions.gen_salt('bf')), now(), '', '', '', '', '', '', '', '', 0, '{"provider":"email","providers":["email"]}', '{"full_name":"Admin Local"}', now(), now(), false, false, false),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000a002', 'authenticated', 'authenticated', 'loja@encomendas.local', extensions.crypt('Encomendas123!', extensions.gen_salt('bf')), now(), '', '', '', '', '', '', '', '', 0, '{"provider":"email","providers":["email"]}', '{"full_name":"Operador Loja"}', now(), now(), false, false, false),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000a003', 'authenticated', 'authenticated', 'cozinha@encomendas.local', extensions.crypt('Encomendas123!', extensions.gen_salt('bf')), now(), '', '', '', '', '', '', '', '', 0, '{"provider":"email","providers":["email"]}', '{"full_name":"Operador Cozinha"}', now(), now(), false, false, false)
on conflict (id) do nothing;

insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at) values
  ('00000000-0000-4000-8000-00000000b001', 'admin@encomendas.local', '00000000-0000-4000-8000-00000000a001', '{"sub":"00000000-0000-4000-8000-00000000a001","email":"admin@encomendas.local","email_verified":true}', 'email', now(), now(), now()),
  ('00000000-0000-4000-8000-00000000b002', 'loja@encomendas.local', '00000000-0000-4000-8000-00000000a002', '{"sub":"00000000-0000-4000-8000-00000000a002","email":"loja@encomendas.local","email_verified":true}', 'email', now(), now(), now()),
  ('00000000-0000-4000-8000-00000000b003', 'cozinha@encomendas.local', '00000000-0000-4000-8000-00000000a003', '{"sub":"00000000-0000-4000-8000-00000000a003","email":"cozinha@encomendas.local","email_verified":true}', 'email', now(), now(), now())
on conflict (provider_id, provider) do nothing;

update public.profiles set full_name = 'Admin Local', role = 'admin', location_id = null, active = true
where id = '00000000-0000-4000-8000-00000000a001';
update public.profiles set full_name = 'Operador Loja', role = 'store', location_id = '10000000-0000-4000-8000-000000000002', active = true
where id = '00000000-0000-4000-8000-00000000a002';
update public.profiles set full_name = 'Operador Cozinha', role = 'kitchen', location_id = '10000000-0000-4000-8000-000000000001', active = true
where id = '00000000-0000-4000-8000-00000000a003';

insert into public.product_categories (id, name, position) values
  ('20000000-0000-4000-8000-000000000001', 'Pratos principais', 10),
  ('20000000-0000-4000-8000-000000000002', 'Acompanhamentos', 20),
  ('20000000-0000-4000-8000-000000000003', 'Sobremesas', 30)
on conflict (id) do nothing;

insert into public.products (
  id, category_id, name, description, unit_label, minimum_quantity, quantity_step, requires_note, position
) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Bacalhau com natas', 'Tabuleiro pronto a servir', 'tab.', 1, 1, false, 10),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'Vitela assada', 'Indicar o ponto e observações', 'kg', 1, 0.5, true, 20),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 'Arroz de forno', '', 'dose', 1, 1, false, 10),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000003', 'Pudim caseiro', '', 'un.', 1, 1, false, 10)
on conflict (id) do nothing;

insert into public.pickup_windows (location_id, weekday, opens_at, closes_at, slot_minutes)
select location_id, weekday, '10:00'::time, '19:00'::time, 30
from (values
  ('10000000-0000-4000-8000-000000000002'::uuid),
  ('10000000-0000-4000-8000-000000000003'::uuid)
) locations(location_id)
cross join generate_series(1, 6) weekday
on conflict do nothing;

-- Campanha de demonstração apenas para o ambiente Supabase local.
insert into public.seasonal_campaigns (
  id, name, slug, description, ordering_opens_at, ordering_closes_at, active
) values (
  '40000000-0000-4000-8000-000000000001', 'Natal — demonstração local', 'natal-demonstracao-local',
  'Exemplo de menu e levantamentos sazonais configurável na administração.', now() - interval '1 day', now() + interval '30 days', true
) on conflict (id) do nothing;

insert into public.seasonal_products (
  id, campaign_id, category_id, name, description, unit_label, minimum_quantity, quantity_step, variations, requires_note, position
) values
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Peru assado', 'Peru assado pronto a servir', 'kg', 2, 0.5, array['Com recheio', 'Sem recheio'], true, 10),
  ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 'Bolo-rei', 'Receita tradicional', 'un.', 1, 1, '{}', false, 20)
on conflict (id) do nothing;

insert into public.seasonal_pickup_slots (
  id, campaign_id, location_id, pickup_date, opens_at, closes_at, slot_minutes
) values
  ('42000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', current_date + 14, '09:00', '18:00', 30),
  ('42000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', current_date + 15, '09:00', '14:00', 30),
  ('42000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', current_date + 14, '10:00', '19:00', 30)
on conflict (id) do nothing;
