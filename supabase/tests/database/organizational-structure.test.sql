begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

select has_table('public','legal_entities','legal entities belong to organizational structure');
select has_table('public','business_units','business units belong to organizational structure');
select has_table('public','departments','departments belong to organizational structure');
select has_table('public','positions','positions belong to organizational structure');
select has_table('public','products','products belong to organizational structure');
select has_table('public','service_lines','service lines belong to organizational structure');
select has_table('public','projects','projects belong to organizational structure');
select has_table('public','cost_centers','cost centers belong to organizational structure');
select has_table('public','revenue_centers','revenue centers belong to organizational structure');

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where table_schema='public'
      and table_name in (
        'legal_entities','business_units','departments','positions','products',
        'service_lines','projects','cost_centers','revenue_centers'
      )
      and grantee='anon'
  ),
  0,
  'anon has no organizational master-data privileges'
);

select is(
  (
    select count(*)::integer
    from pg_tables
    where schemaname='public'
      and tablename in (
        'legal_entities','business_units','departments','positions','products',
        'service_lines','projects','cost_centers','revenue_centers'
      )
      and rowsecurity=false
  ),
  0,
  'all organizational tables have RLS enabled'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname='public'
      and tablename in ('cost_centers','revenue_centers')
      and cmd in ('INSERT','UPDATE','DELETE')
      and coalesce(qual,'') || coalesce(with_check,'') like '%finance.manage%'
  ),
  0,
  'finance.manage cannot mutate organizational center masters'
);

select is(
  (
    select count(*)::integer
    from public.business_units bu
    left join public.legal_entities le on le.id=bu.legal_entity_id
    where le.id is null
  ),
  0,
  'business units have no orphan legal entities'
);

select is(
  (
    select count(*)::integer
    from public.projects p
    left join public.business_units bu on bu.id=p.business_unit_id
    where bu.id is null
  ),
  0,
  'projects have no orphan business units'
);

select * from finish();

rollback;
