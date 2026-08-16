drop policy if exists dev_public_read on public.legal_entities;
drop policy if exists dev_public_read on public.business_units;
drop policy if exists dev_public_read on public.departments;
drop policy if exists dev_public_read on public.positions;
drop policy if exists dev_public_read on public.products;
drop policy if exists dev_public_read on public.service_lines;
drop policy if exists dev_public_read on public.projects;
drop policy if exists dev_public_read on public.cost_centers;
drop policy if exists dev_public_read on public.revenue_centers;

revoke all on public.legal_entities from anon;
revoke all on public.business_units from anon;
revoke all on public.departments from anon;
revoke all on public.positions from anon;
revoke all on public.products from anon;
revoke all on public.service_lines from anon;
revoke all on public.projects from anon;
revoke all on public.cost_centers from anon;
revoke all on public.revenue_centers from anon;

do $$
begin
  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema='public'
      and table_name in (
        'legal_entities','business_units','departments','positions','products',
        'service_lines','projects','cost_centers','revenue_centers'
      )
      and grantee='anon'
  ) then
    raise exception 'Ainda existem privilégios anônimos na estrutura organizacional.';
  end if;
end;
$$;
