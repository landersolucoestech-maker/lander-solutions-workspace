begin;

create extension if not exists pgtap with schema extensions;

select plan(33);

select has_function(
  'public','calculate_participation',array['uuid','integer'],
  'caller-scoped calculation RPC exists'
);
select has_function(
  'public','submit_participation',array['uuid','integer'],
  'caller-scoped submission RPC exists'
);
select has_function(
  'public','decide_participation',array['uuid','integer','boolean','text'],
  'caller-scoped decision RPC exists'
);
select has_function(
  'public','post_participation',array['uuid','integer'],
  'caller-scoped participation posting RPC exists'
);
select has_function(
  'public','post_payout_payment',array['uuid','integer'],
  'caller-scoped payout posting RPC exists'
);
select has_function(
  'public','list_available_payout_settlements',array['uuid'],
  'caller-scoped settlement listing RPC exists'
);

select is(
  has_function_privilege('anon','public.calculate_participation(uuid,integer)','EXECUTE'),
  false,
  'anon cannot calculate participations'
);
select is(
  has_function_privilege('anon','public.submit_participation(uuid,integer)','EXECUTE'),
  false,
  'anon cannot submit participations'
);
select is(
  has_function_privilege('anon','public.decide_participation(uuid,integer,boolean,text)','EXECUTE'),
  false,
  'anon cannot decide participations'
);
select is(
  has_function_privilege('anon','public.post_participation(uuid,integer)','EXECUTE'),
  false,
  'anon cannot post participations'
);
select is(
  has_function_privilege('anon','public.post_payout_payment(uuid,integer)','EXECUTE'),
  false,
  'anon cannot post payouts'
);
select is(
  has_function_privilege('anon','public.list_available_payout_settlements(uuid)','EXECUTE'),
  false,
  'anon cannot list payout settlements'
);

select is(
  has_function_privilege('authenticated','public.calculate_participation(uuid,integer)','EXECUTE'),
  true,
  'authenticated users can reach the caller-scoped calculation RPC'
);
select is(
  has_function_privilege('authenticated','public.post_payout_payment(uuid,integer)','EXECUTE'),
  true,
  'authenticated users can reach the caller-scoped payout RPC'
);

select is(
  has_function_privilege('authenticated','public.admin_calculate_participation(uuid,integer,uuid)','EXECUTE'),
  false,
  'authenticated users cannot supply an arbitrary calculation actor'
);
select is(
  has_function_privilege('authenticated','public.admin_submit_participation(uuid,integer,uuid)','EXECUTE'),
  false,
  'authenticated users cannot supply an arbitrary submission actor'
);
select is(
  has_function_privilege('authenticated','public.admin_decide_participation(uuid,integer,uuid,boolean,text)','EXECUTE'),
  false,
  'authenticated users cannot supply an arbitrary approval actor'
);
select is(
  has_function_privilege('authenticated','public.admin_post_participation(uuid,integer,uuid)','EXECUTE'),
  false,
  'authenticated users cannot supply an arbitrary posting actor'
);
select is(
  has_function_privilege('authenticated','public.admin_post_payout_payment(uuid,integer,uuid)','EXECUTE'),
  false,
  'authenticated users cannot supply an arbitrary payout actor'
);
select is(
  has_function_privilege('service_role','public.admin_post_payout_payment(uuid,integer,uuid)','EXECUTE'),
  false,
  'service role cannot bypass the caller-scoped payout workflow'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname='public'
      and tablename in (
        'participation_calculations','participation_calculation_lines','participation_approvals',
        'payout_obligations','payout_payments'
      )
      and policyname='dev_public_read'
  ),
  0,
  'participation and payout records have no development public-read policies'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where table_schema='public'
      and table_name in (
        'participation_calculations','participation_calculation_lines','participation_approvals',
        'payout_obligations','payout_payments'
      )
      and grantee='anon'
  ),
  0,
  'anon has no table grants in participation or payout ledgers'
);

select is(
  (
    select count(*)::integer
    from pg_tables
    where schemaname='public'
      and tablename in (
        'participation_calculations','participation_calculation_lines','participation_approvals',
        'payout_obligations','payout_payments'
      )
      and rowsecurity=false
  ),
  0,
  'RLS is enabled on all participation and payout records'
);

select is(
  position(
    'p_actor_user_id' in pg_get_functiondef(
      'public.calculate_participation(uuid,integer)'::regprocedure
    )
  ),
  0,
  'caller-scoped calculation RPC does not accept or derive a supplied actor id'
);

select is(
  position(
    'p_actor_user_id' in pg_get_functiondef(
      'public.post_payout_payment(uuid,integer)'::regprocedure
    )
  ),
  0,
  'caller-scoped payout RPC does not accept or derive a supplied actor id'
);

select is(
  (select count(*)::integer from public.permissions where code like 'payouts.%'),
  0,
  'legacy plural payout permission catalog was removed'
);

select is(
  (
    select array_agg(code order by code)
    from public.permissions
    where code like 'payout.%'
  ),
  array['payout.manage','payout.post','payout.read']::text[],
  'singular payout permission catalog is canonical'
);

select is(
  position(
    '''payout.post''' in pg_get_functiondef(
      'public.admin_post_payout_payment(uuid,integer,uuid)'::regprocedure
    )
  ) > 0,
  true,
  'payout posting implementation requires payout.post'
);

select is(
  position(
    '''payout.manage''' in pg_get_functiondef(
      'public.admin_post_payout_payment(uuid,integer,uuid)'::regprocedure
    )
  ),
  0,
  'payout posting implementation no longer reuses payout.manage'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions manage_grant
    join public.permissions manage_permission on manage_permission.id=manage_grant.permission_id
    where manage_permission.code='payout.manage'
      and not exists (
        select 1
        from public.role_permissions post_grant
        join public.permissions post_permission on post_permission.id=post_grant.permission_id
        where post_grant.role_id=manage_grant.role_id
          and post_permission.code='payout.post'
      )
  ),
  0,
  'roles with prior payment management access retain posting access explicitly'
);

select is(
  has_function_privilege(
    'service_role','public.admin_post_payout_payment(uuid,integer,uuid)','EXECUTE'
  ),
  false,
  'owner-only payout implementation cannot be called by service_role'
);

select is(
  (select count(*)::integer from public.permissions where code like 'participations.%'),
  0,
  'legacy plural participation permission catalog was removed'
);

select is(
  (
    select array_agg(code order by code)
    from public.permissions
    where code like 'participation.%'
  ),
  array[
    'participation.approve','participation.manage','participation.post','participation.read'
  ]::text[],
  'singular participation permission catalog is canonical'
);

select * from finish();

rollback;
