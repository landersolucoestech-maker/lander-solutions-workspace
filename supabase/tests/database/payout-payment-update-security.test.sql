begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payout_payments'
      and policyname = 'payout_payments_update'
      and cmd = 'UPDATE'
  ),
  1,
  'payout payment has one canonical update policy'
);

select ok(
  (
    select position('payout.manage' in pg_get_expr(polwithcheck, polrelid)) > 0
      and position('payout_obligation_id' in pg_get_expr(polwithcheck, polrelid)) > 0
    from pg_policy
    where polrelid = 'public.payout_payments'::regclass
      and polname = 'payout_payments_update'
  ),
  'destination row is checked against payout.manage on its obligation scope'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', 'fa000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'payout-unit-a@test.local', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'fa000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'payout-denied@test.local', '', now(), '{}', '{}', now(), now(), '', '', '', '');

update public.profiles
set status = 'active', mfa_required = false
where id in (
  'fa000000-0000-4000-8000-000000000001',
  'fa000000-0000-4000-8000-000000000002'
);

insert into auth.sessions(id, user_id, created_at, updated_at) values
  ('fa100000-0000-4000-8000-000000000001', 'fa000000-0000-4000-8000-000000000001', now(), now()),
  ('fa100000-0000-4000-8000-000000000002', 'fa000000-0000-4000-8000-000000000002', now(), now());

insert into public.app_roles(id, code, name, description, is_system)
values (
  'fa200000-0000-4000-8000-000000000001',
  'test-payout-unit-manager',
  'Test payout unit manager',
  'Transaction-scoped pgTAP fixture',
  false
);

insert into public.role_permissions(role_id, permission_id)
select 'fa200000-0000-4000-8000-000000000001', permission.id
from public.permissions permission
where permission.code in ('payout.read', 'payout.manage');

do $$
declare
  unit_a public.business_units;
  unit_b public.business_units;
begin
  select * into unit_a from public.business_units order by code limit 1;
  select * into unit_b from public.business_units order by code offset 1 limit 1;

  if unit_a.id is null or unit_b.id is null then
    raise exception 'payout RLS test requires two business units';
  end if;

  perform set_config('test.payout_unit_a_id', unit_a.id::text, true);
  perform set_config('test.payout_unit_a_code', unit_a.code, true);
  perform set_config('test.payout_unit_b_id', unit_b.id::text, true);
end;
$$;

insert into public.user_role_assignments(user_id, role_id, unit_code)
values (
  'fa000000-0000-4000-8000-000000000001',
  'fa200000-0000-4000-8000-000000000001',
  current_setting('test.payout_unit_a_code')
);

set local session_replication_role = replica;

insert into public.financial_settlements(
  id, financial_document_id, cash_account_id, settlement_date,
  original_currency_code, original_amount, status
) values (
  'fa410000-0000-4000-8000-000000000001',
  'fa350000-0000-4000-8000-000000000001',
  'fa420000-0000-4000-8000-000000000001',
  current_date, 'BRL', 30, 'draft'
);

insert into public.payout_obligations(
  id, participation_calculation_line_id, participation_calculation_id,
  party_id, business_unit_id, contract_id, financial_document_id, currency_code,
  amount, due_date, status
) values
  (
    'fa300000-0000-4000-8000-000000000001',
    'fa310000-0000-4000-8000-000000000001',
    'fa320000-0000-4000-8000-000000000001',
    'fa330000-0000-4000-8000-000000000001',
    current_setting('test.payout_unit_a_id')::uuid,
    'fa340000-0000-4000-8000-000000000001',
    'fa350000-0000-4000-8000-000000000001',
    'BRL', 100, current_date + 10, 'open'
  ),
  (
    'fa300000-0000-4000-8000-000000000002',
    'fa310000-0000-4000-8000-000000000002',
    'fa320000-0000-4000-8000-000000000002',
    'fa330000-0000-4000-8000-000000000002',
    current_setting('test.payout_unit_b_id')::uuid,
    'fa340000-0000-4000-8000-000000000002',
    'fa350000-0000-4000-8000-000000000002',
    'BRL', 100, current_date + 10, 'open'
  );

insert into public.payout_payments(
  id, payout_obligation_id, financial_settlement_id, paid_on, amount, currency_code,
  external_reference, notes, status
) values (
  'fa400000-0000-4000-8000-000000000001',
  'fa300000-0000-4000-8000-000000000001',
  'fa410000-0000-4000-8000-000000000001',
  current_date, 25, 'BRL', 'RLS-TEST', 'original', 'draft'
);

set local request.jwt.claims = '{"sub":"fa000000-0000-4000-8000-000000000001","session_id":"fa100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select lives_ok(
  $$
    update public.payout_payments
    set notes = 'same-unit-authorized', amount = 30
    where id = 'fa400000-0000-4000-8000-000000000001'
  $$,
  'same-unit authorized draft payment update succeeds'
);

reset role;

select is(
  (select notes from public.payout_payments where id = 'fa400000-0000-4000-8000-000000000001'),
  'same-unit-authorized',
  'legitimate draft payment update is persisted'
);

set local role authenticated;

select throws_ok(
  $$
    update public.payout_payments
    set payout_obligation_id = 'fa300000-0000-4000-8000-000000000002'
    where id = 'fa400000-0000-4000-8000-000000000001'
  $$,
  '42501', null,
  'cross-unit obligation reassignment is denied without destination permission'
);

reset role;

select is(
  (
    select payout_obligation_id
    from public.payout_payments
    where id = 'fa400000-0000-4000-8000-000000000001'
  ),
  'fa300000-0000-4000-8000-000000000001'::uuid,
  'denied reassignment preserves the original obligation'
);

set local request.jwt.claims = '{"sub":"fa000000-0000-4000-8000-000000000002","session_id":"fa100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select lives_ok(
  $$
    update public.payout_payments
    set amount = 99
    where id = 'fa400000-0000-4000-8000-000000000001'
  $$,
  'unauthorized update is safely denied by row filtering'
);

reset role;

select is(
  (select amount from public.payout_payments where id = 'fa400000-0000-4000-8000-000000000001'),
  30::numeric,
  'unauthorized user cannot alter the payment'
);

set local session_replication_role = origin;

select * from finish();

rollback;
