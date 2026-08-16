-- Make legal_cases unequivocally read-only after canonical migration.

drop policy if exists legal_cases_insert on public.legal_cases;
drop policy if exists legal_cases_update on public.legal_cases;
drop policy if exists legal_cases_delete on public.legal_cases;

revoke insert, update, delete, truncate, references, trigger
on public.legal_cases from authenticated;

grant select on public.legal_cases to authenticated;

do $$
begin
  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'legal_cases'
      and grantee in ('anon','authenticated')
      and privilege_type <> 'SELECT'
  ) then
    raise exception 'legal_cases ainda possui privilégios de mutação para clientes.';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and n.nspname = 'public'
      and c.relname = 'legal_cases'
      and t.tgname = 'legal_cases_block_legacy_write'
  ) then
    raise exception 'Bloqueio de escrita legado não encontrado em legal_cases.';
  end if;
end;
$$;

comment on table public.legal_cases
is 'Legacy read-only source retained temporarily for reconciliation. Canonical writes belong exclusively to legal_matters.';