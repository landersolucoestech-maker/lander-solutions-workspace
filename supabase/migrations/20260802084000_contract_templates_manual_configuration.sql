create table if not exists public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(btrim(code)) between 2 and 80),
  name text not null check (char_length(btrim(name)) between 2 and 180),
  description text check (description is null or char_length(description) <= 2000),
  contract_type text not null check (char_length(btrim(contract_type)) between 2 and 120),
  body_text text not null default '',
  default_calculation_basis text not null default '',
  default_included_components text[] not null default '{}',
  default_excluded_components text[] not null default '{}',
  default_loss_rule text not null default '',
  default_investment_rule text not null default '',
  status text not null default 'active' check (status in ('active','inactive')),
  version integer not null default 1 check (version > 0),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  updated_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contracts
  add column if not exists template_id uuid references public.contract_templates(id) on delete set null;

alter table public.contract_versions
  add column if not exists template_body_snapshot text not null default '';

create index if not exists contracts_template_idx on public.contracts(template_id)
where template_id is not null;

create or replace function private.touch_contract_template()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  new.version := old.version + 1;
  return new;
end;
$$;

revoke all on function private.touch_contract_template() from public, anon, authenticated;

drop trigger if exists contract_templates_touch on public.contract_templates;
create trigger contract_templates_touch
before update on public.contract_templates
for each row execute function private.touch_contract_template();

alter table public.contract_templates enable row level security;

revoke all on table public.contract_templates from public, anon;
grant select, insert, update, delete on table public.contract_templates to authenticated;

drop policy if exists contract_templates_select on public.contract_templates;
create policy contract_templates_select on public.contract_templates
for select to authenticated
using (private.current_user_has_permission('contracts.read', null));

drop policy if exists contract_templates_insert on public.contract_templates;
create policy contract_templates_insert on public.contract_templates
for insert to authenticated
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('contracts.documents.manage', null)
);

drop policy if exists contract_templates_update on public.contract_templates;
create policy contract_templates_update on public.contract_templates
for update to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('contracts.documents.manage', null)
)
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('contracts.documents.manage', null)
);

drop policy if exists contract_templates_delete on public.contract_templates;
create policy contract_templates_delete on public.contract_templates
for delete to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('contracts.documents.manage', null)
);
