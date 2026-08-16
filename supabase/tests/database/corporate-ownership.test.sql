begin;

create extension if not exists pgtap with schema extensions;

select plan(21);


select has_table('public','corporate_capital_structures','capital structures are versioned');
select has_table('public','corporate_share_classes','share classes belong to a capital structure');
select has_table('public','corporate_ownership_positions','ownership positions form the quota ledger');
select has_table('public','corporate_ownership_roles','corporate roles are separate from contractual participants');
select has_table('public','corporate_capital_contributions','capital contributions have a dedicated ledger');
select has_column('public','corporate_ownership_changes','decision_reason','approval decisions preserve their reason');

select has_function(
  'public','submit_corporate_ownership_change',array['uuid','bigint'],
  'caller-scoped submission RPC exists'
);
select has_function(
  'public','decide_corporate_ownership_change',array['uuid','bigint','boolean','text'],
  'caller-scoped decision RPC exists'
);
select has_function(
  'public','apply_corporate_ownership_change',array['uuid','bigint'],
  'atomic application RPC exists'
);

select extensions.unalike(
  pg_get_functiondef('public.apply_corporate_ownership_change(uuid,bigint)'::regprocedure),
  '%ownership_role_id%',
  'application RPC does not reference the removed ownership_role_id position column'
);
select extensions.unalike(
  pg_get_functiondef('public.apply_corporate_ownership_change(uuid,bigint)'::regprocedure),
  '%share_quantity%',
  'application RPC uses canonical quota_quantity naming'
);
select extensions.unalike(
  pg_get_functiondef('public.apply_corporate_ownership_change(uuid,bigint)'::regprocedure),
  '%ownership_change_id=%',
  'application RPC does not filter lines by a nonexistent ownership_change_id column'
);

select is(
  has_function_privilege('anon','public.submit_corporate_ownership_change(uuid,bigint)','EXECUTE'),
  false,
  'anon cannot submit corporate changes'
);
select is(
  has_function_privilege('anon','public.decide_corporate_ownership_change(uuid,bigint,boolean,text)','EXECUTE'),
  false,
  'anon cannot approve or reject corporate changes'
);
select is(
  has_function_privilege('anon','public.apply_corporate_ownership_change(uuid,bigint)','EXECUTE'),
  false,
  'anon cannot apply corporate changes'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where table_schema='public'
      and table_name in ('corporate_ownership_positions','corporate_ownership_roles','corporate_capital_contributions')
      and grantee='authenticated'
      and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES')
  ),
  0,
  'derived ownership ledgers are not directly writable by authenticated clients'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where table_schema='public'
      and table_name in (
        'corporate_capital_structures','corporate_share_classes','corporate_ownership_roles',
        'corporate_ownership_positions','corporate_ownership_changes','corporate_ownership_change_lines',
        'corporate_resolutions','corporate_capital_contributions'
      )
      and grantee='anon'
  ),
  0,
  'anon has no table privileges in the corporate ownership domain'
);

select is(
  (
    select count(*)::integer
    from pg_tables
    where schemaname='public'
      and tablename in (
        'corporate_capital_structures','corporate_share_classes','corporate_ownership_roles',
        'corporate_ownership_positions','corporate_ownership_changes','corporate_ownership_change_lines',
        'corporate_resolutions','corporate_capital_contributions'
      )
      and rowsecurity=false
  ),
  0,
  'all corporate ownership tables have RLS enabled'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname='public'
      and tablename in ('corporate_ownership_positions','corporate_ownership_roles','corporate_capital_contributions')
      and cmd<>'SELECT'
  ),
  0,
  'derived ledgers expose only SELECT policies'
);

select is(
  (
    select count(*)::integer
    from pg_indexes
    where schemaname='public'
      and tablename='corporate_ownership_positions'
      and indexname='corporate_ownership_positions_current_unique'
  ),
  1,
  'one current position per structure, class and holder is enforced'
);

select is(
  (
    select count(*)::integer
    from pg_constraint constraint_row
    join pg_class table_row on table_row.oid=constraint_row.conrelid
    join pg_namespace schema_row on schema_row.oid=table_row.relnamespace
    where schema_row.nspname='public'
      and table_row.relname='governance_documents'
      and constraint_row.conname='governance_documents_subject_check'
      and pg_get_constraintdef(constraint_row.oid,true) like '%<= 1%'
  ),
  1,
  'entity-level corporate governance documents are allowed without an unrelated subject'
);

select * from finish();

rollback;
