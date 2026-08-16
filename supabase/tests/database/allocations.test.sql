begin;

create extension if not exists pgtap with schema extensions;

select plan(26);

select has_table('public','allocation_rules','allocation_rules exists');
select has_table('public','allocation_rule_versions','allocation_rule_versions exists');
select has_table('public','allocation_rule_targets','allocation_rule_targets exists');
select has_table('public','allocation_driver_values','allocation_driver_values exists');
select has_table('public','allocation_runs','allocation_runs exists');
select has_table('public','allocation_run_sources','allocation_run_sources exists');
select has_table('public','allocation_run_distributions','allocation_run_distributions exists');
select has_table('public','allocation_approvals','allocation_approvals exists');

select is(
  (
    select count(*)::integer
    from pg_tables
    where schemaname='public'
      and tablename like 'allocation_%'
      and rowsecurity=false
  ),
  0,
  'all allocation tables have RLS enabled'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where table_schema='public'
      and table_name like 'allocation_%'
      and grantee='anon'
      and privilege_type <> 'SELECT'
  ),
  0,
  'anon has no allocation mutation privileges in development'
);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname = any(array[
        'admin_submit_allocation_rule_version',
        'admin_decide_allocation_rule_version',
        'admin_simulate_allocation_run',
        'admin_submit_allocation_run',
        'admin_decide_allocation_run',
        'admin_post_allocation_run',
        'admin_reverse_allocation_run'
      ])
      and exists (
        select 1
        from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
        left join pg_roles role_grantee on role_grantee.oid=acl.grantee
        where acl.privilege_type='EXECUTE'
          and (acl.grantee=0 or role_grantee.rolname in ('anon','authenticated'))
      )
  ),
  0,
  'allocation administrative RPCs are service-only'
);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname = any(array[
        'admin_submit_allocation_rule_version',
        'admin_decide_allocation_rule_version',
        'admin_simulate_allocation_run',
        'admin_submit_allocation_run',
        'admin_decide_allocation_run',
        'admin_post_allocation_run',
        'admin_reverse_allocation_run'
      ])
      and exists (
        select 1
        from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
        join pg_roles role_grantee on role_grantee.oid=acl.grantee
        where acl.privilege_type='EXECUTE'
          and role_grantee.rolname='service_role'
      )
  ),
  0,
  'all seven allocation administrative RPCs are owner-only implementation details'
);

select has_trigger('public','allocation_rules','allocation_rules_validate_source','allocation rule source scope is validated');
select has_trigger('public','allocation_rule_versions','allocation_versions_protect','approved allocation versions are protected');
select has_trigger('public','allocation_rule_versions','allocation_versions_validate_source','allocation version source scope is validated');
select has_trigger('public','allocation_runs','allocation_runs_audit','allocation runs are audited');

select has_function(
  'public','run_allocation_workflow',array['text','uuid','integer','text','date'],
  'caller-scoped allocation dispatcher exists'
);

select ok(
  has_function_privilege(
    'authenticated','public.run_allocation_workflow(text,uuid,integer,text,date)','EXECUTE'
  ),
  'authenticated callers can reach the allocation dispatcher'
);

select ok(
  not has_function_privilege(
    'authenticated','public.admin_post_allocation_run(uuid,integer,uuid)','EXECUTE'
  ),
  'authenticated callers cannot invoke the owner-only posting implementation'
);

select ok(
  not has_function_privilege(
    'authenticated','public.admin_reverse_allocation_run(uuid,integer,date,text,uuid)','EXECUTE'
  ),
  'authenticated callers cannot invoke the owner-only reversal implementation'
);

select is(
  position(
    '''allocation.post''' in pg_get_functiondef(
      'public.admin_post_allocation_run(uuid,integer,uuid)'::regprocedure
    )
  ) > 0,
  true,
  'posting implementation requires allocation.post'
);

select is(
  position(
    '''allocation.approve''' in pg_get_functiondef(
      'public.admin_post_allocation_run(uuid,integer,uuid)'::regprocedure
    )
  ),
  0,
  'posting implementation does not reuse allocation.approve'
);

select is(
  position(
    '''allocation.reverse''' in pg_get_functiondef(
      'public.admin_reverse_allocation_run(uuid,integer,date,text,uuid)'::regprocedure
    )
  ) > 0,
  true,
  'reversal implementation requires allocation.reverse'
);

select is(
  position(
    '''allocation.approve''' in pg_get_functiondef(
      'public.admin_reverse_allocation_run(uuid,integer,date,text,uuid)'::regprocedure
    )
  ),
  0,
  'reversal implementation does not reuse allocation.approve'
);

select is(
  (
    select count(*)::integer
    from public.app_roles role_row
    join public.role_permissions approval_grant on approval_grant.role_id=role_row.id
    join public.permissions approval on approval.id=approval_grant.permission_id
    where approval.code='allocation.approve'
      and not exists (
        select 1
        from public.role_permissions workflow_grant
        join public.permissions workflow_permission
          on workflow_permission.id=workflow_grant.permission_id
        where workflow_grant.role_id=role_row.id
          and workflow_permission.code='allocation.post'
      )
  ),
  0,
  'roles with prior effective posting access retain allocation.post'
);

select is(
  (
    select count(*)::integer
    from public.app_roles role_row
    join public.role_permissions approval_grant on approval_grant.role_id=role_row.id
    join public.permissions approval on approval.id=approval_grant.permission_id
    where approval.code='allocation.approve'
      and not exists (
        select 1
        from public.role_permissions workflow_grant
        join public.permissions workflow_permission
          on workflow_permission.id=workflow_grant.permission_id
        where workflow_grant.role_id=role_row.id
          and workflow_permission.code='allocation.reverse'
      )
  ),
  0,
  'roles with prior effective reversal access retain allocation.reverse'
);

select * from finish();

rollback;
