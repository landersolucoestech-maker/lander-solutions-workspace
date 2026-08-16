create or replace function public.temporary_export_support_migrations()
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'version',m.version,
        'name',m.name,
        'filename',m.version||'_'||m.name||'.sql',
        'sql',array_to_string(m.statements,E'\n')
      ) order by m.version
    ),
    '[]'::jsonb
  )
  from supabase_migrations.schema_migrations m
  where m.version>='20260804072749'
$$;
revoke all on function public.temporary_export_support_migrations() from public,anon,authenticated;
grant execute on function public.temporary_export_support_migrations() to service_role;
