begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

select has_table('public','legal_matters','legal_matters is the canonical legal master');
select has_table('public','legal_matter_events','legal_matter_events stores the legal chronology');
select has_table(
  'public',
  'legal_matter_intellectual_property_assets',
  'legal matters reference canonical intellectual property assets explicitly'
);

select hasnt_table(
  'public',
  'legal_cases',
  'legacy legal_cases master remains removed after reconciliation'
);

select is(
  (
    select count(*)::integer
    from public.legal_matter_events
    where event_type='legacy_import'
  ),
  (select count(*)::integer from public.legal_matters where legacy_source='legal_cases'),
  'each reconciled legacy case retains a traceability event'
);

select is(
  (
    select count(*)::integer
    from public.governance_documents gd
    left join public.legal_matters m on m.id=gd.legal_matter_id
    where gd.legal_matter_id is not null and m.id is null
  ),
  0,
  'legal governance documents have no orphan matter references'
);

select is(
  (
    select count(*)::integer
    from public.legal_matter_events e
    left join public.legal_matters m on m.id=e.legal_matter_id
    where m.id is null
  ),
  0,
  'legal events have no orphan matter references'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema='public' and column_name='legal_case_id'
  ),
  0,
  'legacy legal_case_id columns were removed'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where table_schema='public'
      and table_name in (
        'legal_cases','legal_matters','legal_matter_events',
        'governance_documents','legal_matter_intellectual_property_assets'
      )
      and grantee='anon'
  ),
  0,
  'anon has no privileges on legal records or evidence'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where table_schema='public'
      and table_name='legal_cases'
      and grantee='authenticated'
      and privilege_type <> 'SELECT'
  ),
  0,
  'authenticated clients cannot mutate legal_cases'
);

select is(
  (
    select count(*)::integer
    from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where not t.tgisinternal
      and n.nspname='public'
      and c.relname='legal_cases'
  ),
  0,
  'no obsolete legal_cases trigger remains after table removal'
);

select has_function(
  'public',
  'close_legal_matter',
  array['uuid','integer','text'],
  'caller-scoped legal close RPC exists'
);

select is(
  position(
    'auth.uid()' in
    pg_get_functiondef('public.close_legal_matter(uuid,integer,text)'::regprocedure)
  ) > 0,
  true,
  'legal close derives the actor from auth.uid'
);

select is(
  position(
    'legal.close' in
    pg_get_functiondef('public.close_legal_matter(uuid,integer,text)'::regprocedure)
  ) > 0,
  true,
  'legal close enforces the dedicated permission'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_routine_grants
    where specific_schema='public'
      and routine_name='close_legal_matter'
      and grantee='anon'
  ),
  0,
  'anon cannot execute legal close'
);

select is(
  (
    select count(*)::integer
    from pg_tables
    where schemaname='public'
      and tablename in (
        'legal_matters','legal_matter_events','legal_matter_intellectual_property_assets'
      )
      and rowsecurity=false
  ),
  0,
  'canonical legal tables have RLS enabled'
);

select is(
  (
    select count(*)::integer
    from public.legal_matter_intellectual_property_assets link
    left join public.legal_matters m on m.id=link.legal_matter_id
    left join public.intellectual_property_assets ip
      on ip.id=link.intellectual_property_asset_id
    where m.id is null or ip.id is null
  ),
  0,
  'legal to intellectual property links have no orphans'
);

select is(
  (
    select count(*)::integer
    from public.legal_matters
    where probability < 0 or probability > 100 or exposure_amount < 0
  ),
  0,
  'legal probability and exposure values are valid'
);

select * from finish();

rollback;
