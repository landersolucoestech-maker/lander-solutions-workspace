begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

select is(
  (
    select count(*)::integer
    from pg_tables
    where schemaname = 'public'
      and tablename like 'saas_%'
  ),
  0,
  'central database has no SaaS operation tables'
);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like '%saas%' or p.proname like 'admin_%saas%')
  ),
  0,
  'central database has no SaaS operation functions'
);

select is(
  (
    select count(*)::integer
    from public.permissions
    where code like 'saas.%'
  ),
  0,
  'central authorization model has no SaaS permissions'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name like 'integration%'
      and (
        column_name ilike '%subscription%'
        or column_name ilike '%tenant%'
        or column_name ilike '%billing%'
      )
  ),
  0,
  'integration registry does not model subscriptions tenants or product billing'
);

select * from finish();

rollback;
