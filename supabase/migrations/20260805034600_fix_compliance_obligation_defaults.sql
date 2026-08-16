-- Align obligation defaults with the permanent rule status catalog.

alter table public.compliance_obligations
  alter column status set default 'draft';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='compliance_obligations'
      and column_name='status'
      and column_default <> '''draft''::text'
  ) then
    raise exception 'Default de compliance_obligations.status não foi normalizado.';
  end if;
end;
$$;
