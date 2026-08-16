create or replace function public.admin_export_governance_migrations()
returns table(version text,name text,sql text)
language sql
security definer
set search_path=''
as $$
  select sm.version,sm.name,array_to_string(sm.statements,E'\n')
  from supabase_migrations.schema_migrations sm
  where sm.version in ('20260731181222','20260731181426','20260731181615')
  order by sm.version
$$;

revoke all on function public.admin_export_governance_migrations() from public,anon,authenticated;
grant execute on function public.admin_export_governance_migrations() to service_role;
