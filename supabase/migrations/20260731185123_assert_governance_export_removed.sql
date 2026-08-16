do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'admin_export_governance_migrations'
  ) then
    raise exception 'Temporary governance export RPC still exists';
  end if;
end
$$;
