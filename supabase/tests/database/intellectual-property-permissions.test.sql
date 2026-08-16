begin;

create extension if not exists pgtap with schema extensions;

select plan(30);

select is(
  (select count(*)::integer from public.permissions where code in ('ip.read','ip.manage','ip.approve')),
  3,
  'PI exposes the minimal read, manage and approve permission set'
);

select is(
  (select count(*)::integer from public.permissions where code like 'ip.%' and module <> 'ip'),
  0,
  'all PI permissions are cataloged under the PI module'
);

select is(
  (select action from public.permissions where code='ip.approve'),
  'approve',
  'ip.approve has the canonical action'
);

select policies_are(
  'public','intellectual_property_assets',
  array['dev_public_read','ip_assets_delete','ip_assets_insert','ip_assets_select','ip_assets_update'],
  'PI assets expose separated read and write policies plus the existing development read policy'
);

select policies_are(
  'public','intellectual_property_events',
  array['dev_public_read','ip_events_delete','ip_events_insert','ip_events_select','ip_events_update'],
  'PI events expose separated read and write policies plus the existing development read policy'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname='public'
      and tablename in ('intellectual_property_assets','intellectual_property_events')
      and (coalesce(qual,'') ilike '%legal.manage%' or coalesce(with_check,'') ilike '%legal.manage%')
  ),
  0,
  'PI RLS has no legal.manage dependency'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname='public'
      and tablename in ('intellectual_property_assets','intellectual_property_events')
      and policyname <> 'dev_public_read'
      and 'anon'=any(roles)
  ),
  0,
  'no production PI policy opens access to anon'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.app_roles r on r.id=rp.role_id
    join public.permissions p on p.id=rp.permission_id
    where r.code in ('owner','corporate_admin','legal')
      and p.code in ('ip.read','ip.manage')
  ),
  6,
  'legitimate PI administrators receive explicit read and manage grants'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.app_roles r on r.id=rp.role_id
    join public.permissions p on p.id=rp.permission_id
    where p.code='ip.approve'
      and r.code in ('owner','corporate_admin')
  ),
  2,
  'existing PI approvers are preserved'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.app_roles r on r.id=rp.role_id
    join public.permissions p on p.id=rp.permission_id
    where r.code='finance_manager' and p.code like 'ip.%'
  ),
  0,
  'finance_manager does not inherit PI from its historical legal.manage grant'
);

insert into auth.users (
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
  confirmation_token,email_change,email_change_token_new,recovery_token
) values
  ('00000000-0000-0000-0000-000000000000','2d000000-0000-4000-8000-000000000001','authenticated','authenticated','pi-manager@test.local','',now(),'{}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','2d000000-0000-4000-8000-000000000002','authenticated','authenticated','legal-only@test.local','',now(),'{}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','2d000000-0000-4000-8000-000000000003','authenticated','authenticated','unauthorized@test.local','',now(),'{}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','2d000000-0000-4000-8000-000000000004','authenticated','authenticated','pi-approver@test.local','',now(),'{}','{}',now(),now(),'','','','');

update public.profiles
set status='active',mfa_required=false
where id in (
  '2d000000-0000-4000-8000-000000000001',
  '2d000000-0000-4000-8000-000000000002',
  '2d000000-0000-4000-8000-000000000003',
  '2d000000-0000-4000-8000-000000000004'
);

insert into public.user_role_assignments(user_id,role_id)
select '2d000000-0000-4000-8000-000000000001',id from public.app_roles where code='legal';
insert into public.user_role_assignments(user_id,role_id)
select '2d000000-0000-4000-8000-000000000002',id from public.app_roles where code='finance_manager';
insert into public.user_role_assignments(user_id,role_id)
select '2d000000-0000-4000-8000-000000000003',id from public.app_roles where code='employee';
insert into public.user_role_assignments(user_id,role_id)
select '2d000000-0000-4000-8000-000000000004',id from public.app_roles where code='corporate_admin';

insert into auth.sessions(id,user_id,created_at,updated_at) values
  ('2d100000-0000-4000-8000-000000000001','2d000000-0000-4000-8000-000000000001',now(),now()),
  ('2d100000-0000-4000-8000-000000000002','2d000000-0000-4000-8000-000000000002',now(),now());

do $$
begin
  perform set_config(
    'test.pi_legal_entity_id',
    (select id::text from public.legal_entities order by created_at limit 1),
    true
  );
end;
$$;

select ok(
  private.user_has_permission('2d000000-0000-4000-8000-000000000001','ip.read',null),
  'explicit PI role can read PI'
);
select ok(
  private.user_has_permission('2d000000-0000-4000-8000-000000000001','ip.manage',null),
  'explicit PI role can manage PI'
);
select ok(
  private.user_has_permission('2d000000-0000-4000-8000-000000000002','legal.manage',null),
  'legal-only fixture owns legal.manage'
);
select ok(
  not private.user_has_permission('2d000000-0000-4000-8000-000000000002','ip.read',null),
  'legal.manage alone does not grant PI read'
);
select ok(
  not private.user_has_permission('2d000000-0000-4000-8000-000000000002','ip.manage',null),
  'legal.manage alone does not grant PI management'
);
select ok(
  not private.user_has_permission('2d000000-0000-4000-8000-000000000003','ip.read',null),
  'unauthorized user cannot read PI'
);
select ok(
  not private.user_has_permission('2d000000-0000-4000-8000-000000000003','ip.manage',null),
  'unauthorized user cannot manage PI'
);

set local request.jwt.claims = '{"sub":"2d000000-0000-4000-8000-000000000001","session_id":"2d100000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;

select lives_ok(
  $$
    insert into public.intellectual_property_assets (
      id,legal_entity_id,code,title,ip_type,status,created_by
    )
    values (
      '2d200000-0000-4000-8000-000000000001',
      current_setting('test.pi_legal_entity_id')::uuid,
      'PI-TST-AUTH','Marca de teste','trademark','planned',
      '2d000000-0000-4000-8000-000000000001'
    )
  $$,
  'user with ip.manage creates a PI asset through RLS'
);

select lives_ok(
  $$
    update public.intellectual_property_assets
    set title='Marca de teste atualizada'
    where id='2d200000-0000-4000-8000-000000000001'
  $$,
  'user with ip.manage updates a PI asset through RLS'
);

select is(
  (select count(*)::integer from public.intellectual_property_assets where id='2d200000-0000-4000-8000-000000000001'),
  1,
  'user with ip.read sees the PI asset through RLS'
);

reset role;
set local request.jwt.claims = '{"sub":"2d000000-0000-4000-8000-000000000002","session_id":"2d100000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;

select is(
  (select count(*)::integer from public.intellectual_property_assets where id='2d200000-0000-4000-8000-000000000001'),
  0,
  'legal.manage alone cannot read PI through RLS'
);

select lives_ok(
  $$
    update public.intellectual_property_assets
    set title='Tentativa jurídica'
    where id='2d200000-0000-4000-8000-000000000001'
  $$,
  'unauthorized RLS update is safely filtered'
);

reset role;

select is(
  (select title from public.intellectual_property_assets where id='2d200000-0000-4000-8000-000000000001'),
  'Marca de teste atualizada',
  'legal.manage alone does not modify PI through RLS'
);

insert into public.intellectual_property_events (
  id,intellectual_property_id,sequence_no,event_type,event_status,occurred_on,protocol
) values (
  '2d300000-0000-4000-8000-000000000001',
  '2d200000-0000-4000-8000-000000000001',1,'registration','pending',current_date,'PI-TEST-1'
);

select lives_ok(
  $$
    select public.admin_apply_ip_event(
      '2d300000-0000-4000-8000-000000000001',1,
      '2d000000-0000-4000-8000-000000000004',true,'Aprovado em teste'
    )
  $$,
  'user with ip.approve approves a PI event'
);

select is(
  (select event_status from public.intellectual_property_events where id='2d300000-0000-4000-8000-000000000001'),
  'accepted',
  'approved PI event reaches the accepted state'
);

insert into public.intellectual_property_events (
  id,intellectual_property_id,sequence_no,event_type,event_status,occurred_on,protocol
) values (
  '2d300000-0000-4000-8000-000000000002',
  '2d200000-0000-4000-8000-000000000001',2,'renewal','pending',current_date,'PI-TEST-2'
);

select throws_ok(
  $$
    select public.admin_apply_ip_event(
      '2d300000-0000-4000-8000-000000000002',1,
      '2d000000-0000-4000-8000-000000000002',true,'Tentativa sem PI'
    )
  $$,
  'P0001',
  'Permissão insuficiente.',
  'legal.manage alone cannot approve a PI event'
);

select is(
  position(
    '''ip.approve''' in pg_get_functiondef(
      'public.admin_apply_ip_event(uuid,integer,uuid,boolean,text)'::regprocedure
    )
  ) > 0,
  true,
  'PI approval RPC enforces ip.approve'
);

select is(
  position(
    '''legal.manage''' in pg_get_functiondef(
      'public.admin_apply_ip_event(uuid,integer,uuid,boolean,text)'::regprocedure
    )
  ),
  0,
  'PI approval RPC does not depend on legal.manage'
);

select is(
  position(
    '''legal.close''' in pg_get_functiondef(
      'public.admin_close_legal_matter(uuid,integer,uuid,text)'::regprocedure
    )
  ) > 0,
  true,
  'Legal close RPC preserves its own legal.close authorization'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname='public'
      and tablename in ('legal_matters','legal_matter_events')
      and (coalesce(qual,'') ilike '%ip.%' or coalesce(with_check,'') ilike '%ip.%')
  ),
  0,
  'Legal RLS remains independent from PI permissions'
);

select * from finish();

rollback;
