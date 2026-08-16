create table if not exists public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(btrim(code)) between 2 and 80),
  name text not null check (char_length(btrim(name)) between 2 and 200),
  description text,
  contract_type text not null,
  body_text text not null default '',
  default_calculation_basis text not null default 'gross_revenue',
  default_included_components text[] not null default '{}',
  default_excluded_components text[] not null default '{}',
  default_loss_rule text not null default 'none',
  default_investment_rule text not null default 'none',
  status text not null default 'active' check (status in ('active','inactive')),
  version integer not null default 1 check (version > 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contract_templates enable row level security;

grant usage on schema public to anon;

do $public_read$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name, c.relname, c.relkind, c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r','p','v','m','f')
  loop
    execute format('grant select on %I.%I to anon', r.schema_name, r.relname);

    if r.relkind in ('r','p') and r.relrowsecurity then
      execute format('drop policy if exists dev_public_read on %I.%I', r.schema_name, r.relname);
      execute format('create policy dev_public_read on %I.%I for select to anon using (true)', r.schema_name, r.relname);
    end if;
  end loop;
end
$public_read$;

alter default privileges in schema public grant select on tables to anon;

create or replace function public.has_permission(
  p_permission_code text,
  p_unit_code text default null::text
)
returns boolean
language sql
stable
set search_path to ''
as $function$
  select case
    when auth.uid() is null then true
    else authorization_private.current_user_has_permission(p_permission_code, p_unit_code)
  end;
$function$;

grant execute on function public.has_permission(text,text) to anon;
grant execute on function public.hr_dashboard_summary(text) to anon;
grant execute on function public.hr_employee_directory(text) to anon;
grant execute on function public.hr_employee_sensitive_detail(uuid) to anon;

grant usage on schema private to anon;
grant execute on function private.hr_employee_directory_data(text) to anon;
grant execute on function private.hr_employee_sensitive_detail_data(uuid) to anon;

drop policy if exists dev_public_hr_documents_read on storage.objects;
create policy dev_public_hr_documents_read on storage.objects
for select to anon
using (bucket_id in ('hr-documents','financial-fiscal-documents'));
