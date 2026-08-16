begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

select has_table('public','integration_connections','integration_connections exists');
select hasnt_table('public','integration_webhook_endpoints','integration_webhook_endpoints remains removed');
select hasnt_table('public','integration_events','integration_events remains removed');
select hasnt_table('public','integration_sync_jobs','integration_sync_jobs remains removed');
select hasnt_table('public','integration_job_attempts','integration_job_attempts remains removed');

select is(
  (
    select count(*)::integer
    from pg_tables
    where schemaname='public'
      and tablename like 'integration_%'
      and rowsecurity=false
  ),
  0,
  'all remaining integration tables have RLS enabled'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where table_schema='public'
      and table_name like 'integration_%'
      and grantee='anon'
      and privilege_type <> 'SELECT'
  ),
  0,
  'anon has no integration mutation privileges in development'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where table_schema='public'
      and table_name='integration_connections'
      and grantee='anon'
      and privilege_type='SELECT'
  ),
  1,
  'anon receives only the temporary development read grant'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where table_schema='public'
      and table_name='integration_connections'
      and grantee='authenticated'
      and privilege_type='SELECT'
  ),
  1,
  'authenticated users retain the integration registry read grant'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where table_schema='public'
      and table_name='integration_connections'
      and grantee='authenticated'
      and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
  ),
  0,
  'authenticated users cannot mutate the integration registry directly'
);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname like 'admin_%integration%'
  ),
  0,
  'obsolete integration orchestration RPCs remain removed'
);

select has_trigger(
  'public',
  'integration_connections',
  'integration_connections_touch_updated_at',
  'integration registry timestamps are maintained'
);

select has_trigger(
  'public',
  'integration_connections',
  'integration_connections_audit',
  'integration registry mutations are audited'
);

select has_index(
  'public',
  'integration_connections',
  'integration_connections_scope_unique',
  'integration registry scope is unique'
);

select has_index(
  'public',
  'integration_connections',
  'integration_connections_status_idx',
  'integration registry status is indexed'
);

select has_column(
  'public',
  'integration_connections',
  'secret_reference',
  'integration registry stores only an external secret reference'
);

select lives_ok(
$test$
  insert into public.integration_connections(
    source_system,
    information_type,
    endpoint_url,
    environment,
    secret_reference
  ) values(
    'github',
    'repository metadata',
    'http://localhost:3000/api/integrations',
    'development',
    'vault://integrations/github/pgtap'
  );
$test$,
  'development integration metadata accepts a local endpoint and external secret reference'
);

select lives_ok(
$test$
do $body$
declare
  v_rejected boolean := false;
begin
  begin
    insert into public.integration_connections(
      source_system,
      information_type,
      endpoint_url,
      environment
    ) values(
      'custom',
      'production invalid endpoint',
      'http://example.com/integration',
      'production'
    );
  exception when check_violation then
    v_rejected := true;
  end;

  if not v_rejected then
    raise exception 'Production HTTP endpoint was accepted.';
  end if;
end
$body$;
$test$,
  'production integrations reject non-HTTPS endpoints'
);

select lives_ok(
$test$
do $body$
declare
  v_rejected boolean := false;
begin
  begin
    insert into public.integration_connections(
      source_system,
      information_type,
      environment,
      secret_reference
    ) values(
      'custom',
      'inline credential rejection',
      'development',
      'token=plaintext-value'
    );
  exception when check_violation then
    v_rejected := true;
  end;

  if not v_rejected then
    raise exception 'Inline credential was accepted.';
  end if;
end
$body$;
$test$,
  'integration registry rejects inline credentials'
);

select lives_ok(
$test$
do $body$
declare
  v_rejected boolean := false;
begin
  begin
    insert into public.integration_connections(
      source_system,
      information_type,
      endpoint_url,
      environment,
      secret_reference
    ) values(
      'GitHub',
      'Repository Metadata',
      'http://127.0.0.1:3000/duplicate',
      'development',
      'vault://integrations/github/duplicate'
    );
  exception when unique_violation then
    v_rejected := true;
  end;

  if not v_rejected then
    raise exception 'Duplicate integration scope was accepted.';
  end if;
end
$body$;
$test$,
  'integration registry rejects duplicate active scopes'
);

select * from finish();

rollback;
