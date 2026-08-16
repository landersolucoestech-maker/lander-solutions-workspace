create table public.currencies (
  code text primary key check (code ~ '^[A-Z]{3}$'),
  name text not null,
  symbol text not null,
  decimal_places smallint not null default 2 check (decimal_places between 0 and 6),
  is_active boolean not null default true,
  is_system boolean not null default false,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.legal_entities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_]*$'),
  legal_name text not null,
  trade_name text,
  tax_id text,
  country_code text not null default 'BR' check (country_code ~ '^[A-Z]{2}$'),
  functional_currency_code text not null references public.currencies(code) on delete restrict,
  status text not null default 'active' check (status in ('active', 'inactive', 'closed')),
  is_system boolean not null default true,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_units (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_]*$'),
  name text not null,
  description text,
  unit_type text not null check (unit_type in ('administrative', 'product', 'services')),
  status text not null default 'active' check (status in ('active', 'inactive', 'closed')),
  primary_currency_code text not null references public.currencies(code) on delete restrict,
  responsible_user_id uuid references public.profiles(id) on delete set null,
  start_date date,
  end_date date,
  is_system boolean not null default false,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date),
  check ((status = 'closed' and end_date is not null) or status <> 'closed')
);

create index business_units_legal_entity_idx on public.business_units(legal_entity_id);
create index business_units_responsible_idx on public.business_units(responsible_user_id) where responsible_user_id is not null;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id) on delete restrict,
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_]*$'),
  name text not null,
  description text,
  product_type text not null check (product_type in ('saas', 'course', 'digital_product', 'content', 'other')),
  status text not null default 'active' check (status in ('planned', 'active', 'inactive', 'discontinued')),
  start_date date,
  end_date date,
  is_system boolean not null default false,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create index products_business_unit_idx on public.products(business_unit_id);

create table public.service_lines (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id) on delete restrict,
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_]*$'),
  name text not null,
  description text,
  service_type text not null,
  status text not null default 'active' check (status in ('planned', 'active', 'inactive', 'discontinued')),
  start_date date,
  end_date date,
  is_system boolean not null default false,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create index service_lines_business_unit_idx on public.service_lines(business_unit_id);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  business_unit_id uuid references public.business_units(id) on delete restrict,
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_]*$'),
  name text not null,
  description text,
  responsible_user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive', 'closed')),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index departments_legal_entity_idx on public.departments(legal_entity_id);
create index departments_business_unit_idx on public.departments(business_unit_id) where business_unit_id is not null;
create index departments_responsible_idx on public.departments(responsible_user_id) where responsible_user_id is not null;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  service_line_id uuid references public.service_lines(id) on delete restrict,
  department_id uuid references public.departments(id) on delete set null,
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_]*$'),
  name text not null,
  description text,
  responsible_user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'planned' check (status in ('planned', 'active', 'on_hold', 'completed', 'cancelled')),
  start_date date,
  end_date date,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not (product_id is not null and service_line_id is not null)),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create index projects_business_unit_idx on public.projects(business_unit_id);
create index projects_product_idx on public.projects(product_id) where product_id is not null;
create index projects_service_line_idx on public.projects(service_line_id) where service_line_id is not null;
create index projects_department_idx on public.projects(department_id) where department_id is not null;
create index projects_responsible_idx on public.projects(responsible_user_id) where responsible_user_id is not null;

create table public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  business_unit_id uuid references public.business_units(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  service_line_id uuid references public.service_lines(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_]*$'),
  name text not null,
  description text,
  allocation_scope text not null check (allocation_scope in ('corporate', 'direct', 'shared')),
  status text not null default 'active' check (status in ('active', 'inactive', 'closed')),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(product_id, service_line_id, project_id) <= 1),
  check ((allocation_scope = 'corporate' and business_unit_id is null) or allocation_scope <> 'corporate')
);

create index cost_centers_legal_entity_idx on public.cost_centers(legal_entity_id);
create index cost_centers_business_unit_idx on public.cost_centers(business_unit_id) where business_unit_id is not null;
create index cost_centers_product_idx on public.cost_centers(product_id) where product_id is not null;
create index cost_centers_service_line_idx on public.cost_centers(service_line_id) where service_line_id is not null;
create index cost_centers_project_idx on public.cost_centers(project_id) where project_id is not null;

create table public.revenue_centers (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  business_unit_id uuid not null references public.business_units(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  service_line_id uuid references public.service_lines(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_]*$'),
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive', 'closed')),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(product_id, service_line_id, project_id) <= 1)
);

create index revenue_centers_legal_entity_idx on public.revenue_centers(legal_entity_id);
create index revenue_centers_business_unit_idx on public.revenue_centers(business_unit_id);
create index revenue_centers_product_idx on public.revenue_centers(product_id) where product_id is not null;
create index revenue_centers_service_line_idx on public.revenue_centers(service_line_id) where service_line_id is not null;
create index revenue_centers_project_idx on public.revenue_centers(project_id) where project_id is not null;

create table public.financial_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.financial_categories(id) on delete restrict,
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_]*$'),
  name text not null,
  description text,
  category_type text not null check (category_type in (
    'revenue', 'deduction', 'tax', 'payment_fee', 'direct_cost', 'expense',
    'investment', 'reserve', 'asset', 'liability', 'equity', 'transfer'
  )),
  status text not null default 'active' check (status in ('active', 'inactive')),
  is_system boolean not null default false,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index financial_categories_parent_idx on public.financial_categories(parent_id) where parent_id is not null;
create index financial_categories_type_idx on public.financial_categories(category_type);

create table public.financial_periods (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  status text not null default 'open' check (status in ('open', 'closing', 'closed', 'reopened')),
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null,
  reopened_at timestamptz,
  reopened_by uuid references public.profiles(id) on delete set null,
  reopening_reason text,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (legal_entity_id, period_start, period_end),
  check (period_end >= period_start),
  check ((status = 'closed' and closed_at is not null and closed_by is not null) or status <> 'closed'),
  check ((status = 'reopened' and reopened_at is not null and reopened_by is not null and reopening_reason is not null) or status <> 'reopened')
);

create index financial_periods_entity_status_idx on public.financial_periods(legal_entity_id, status, period_start);
create index financial_periods_closed_by_idx on public.financial_periods(closed_by) where closed_by is not null;
create index financial_periods_reopened_by_idx on public.financial_periods(reopened_by) where reopened_by is not null;

create or replace function private.unit_code_for_id(p_unit_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select bu.code
  from public.business_units bu
  where bu.id = p_unit_id;
$$;

revoke execute on function private.unit_code_for_id(uuid) from public, anon;
grant execute on function private.unit_code_for_id(uuid) to authenticated;

create or replace function private.protect_system_directory_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_system and tg_op = 'DELETE' then
    raise exception 'System records cannot be deleted.';
  end if;

  if old.is_system and tg_op = 'UPDATE' and new.code <> old.code then
    raise exception 'The code of a system record cannot be changed.';
  end if;

  return coalesce(new, old);
end;
$$;

revoke execute on function private.protect_system_directory_record() from public, anon, authenticated;

create trigger currencies_protect_system
before update or delete on public.currencies
for each row execute function private.protect_system_directory_record();
create trigger legal_entities_protect_system
before update or delete on public.legal_entities
for each row execute function private.protect_system_directory_record();
create trigger business_units_protect_system
before update or delete on public.business_units
for each row execute function private.protect_system_directory_record();
create trigger products_protect_system
before update or delete on public.products
for each row execute function private.protect_system_directory_record();
create trigger financial_categories_protect_system
before update or delete on public.financial_categories
for each row execute function private.protect_system_directory_record();

create or replace function private.prevent_closed_period_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status in ('closed', 'reopened') then
    raise exception 'Closed or reopened financial periods cannot be deleted.';
  end if;
  return old;
end;
$$;

revoke execute on function private.prevent_closed_period_delete() from public, anon, authenticated;

create trigger financial_periods_protect_delete
before delete on public.financial_periods
for each row execute function private.prevent_closed_period_delete();

create trigger currencies_touch_updated_at before update on public.currencies
for each row execute function private.touch_updated_at();
create trigger legal_entities_touch_updated_at before update on public.legal_entities
for each row execute function private.touch_updated_at();
create trigger business_units_touch_updated_at before update on public.business_units
for each row execute function private.touch_updated_at();
create trigger products_touch_updated_at before update on public.products
for each row execute function private.touch_updated_at();
create trigger service_lines_touch_updated_at before update on public.service_lines
for each row execute function private.touch_updated_at();
create trigger departments_touch_updated_at before update on public.departments
for each row execute function private.touch_updated_at();
create trigger projects_touch_updated_at before update on public.projects
for each row execute function private.touch_updated_at();
create trigger cost_centers_touch_updated_at before update on public.cost_centers
for each row execute function private.touch_updated_at();
create trigger revenue_centers_touch_updated_at before update on public.revenue_centers
for each row execute function private.touch_updated_at();
create trigger financial_categories_touch_updated_at before update on public.financial_categories
for each row execute function private.touch_updated_at();
create trigger financial_periods_touch_updated_at before update on public.financial_periods
for each row execute function private.touch_updated_at();

create trigger currencies_audit after insert or update or delete on public.currencies
for each row execute function private.audit_row_change();
create trigger legal_entities_audit after insert or update or delete on public.legal_entities
for each row execute function private.audit_row_change();
create trigger business_units_audit after insert or update or delete on public.business_units
for each row execute function private.audit_row_change();
create trigger products_audit after insert or update or delete on public.products
for each row execute function private.audit_row_change();
create trigger service_lines_audit after insert or update or delete on public.service_lines
for each row execute function private.audit_row_change();
create trigger departments_audit after insert or update or delete on public.departments
for each row execute function private.audit_row_change();
create trigger projects_audit after insert or update or delete on public.projects
for each row execute function private.audit_row_change();
create trigger cost_centers_audit after insert or update or delete on public.cost_centers
for each row execute function private.audit_row_change();
create trigger revenue_centers_audit after insert or update or delete on public.revenue_centers
for each row execute function private.audit_row_change();
create trigger financial_categories_audit after insert or update or delete on public.financial_categories
for each row execute function private.audit_row_change();
create trigger financial_periods_audit after insert or update or delete on public.financial_periods
for each row execute function private.audit_row_change();

insert into public.currencies (code, name, symbol, decimal_places, is_active, is_system) values
  ('BRL', 'Real brasileiro', 'R$', 2, true, true),
  ('USD', 'Dólar dos Estados Unidos', 'US$', 2, true, true)
on conflict (code) do nothing;

insert into public.legal_entities (
  id, code, legal_name, trade_name, country_code, functional_currency_code, status, is_system
) values (
  '10000000-0000-4000-8000-000000000001',
  'LANDER_SOLUTIONS',
  'LANDER SOLUTIONS LTDA.',
  'LANDER SOLUTIONS',
  'BR',
  'BRL',
  'active',
  true
) on conflict (code) do nothing;

insert into public.business_units (
  id, legal_entity_id, code, name, description, unit_type, status, primary_currency_code, is_system
) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'CORPORATIVO', 'LANDER SOLUTIONS', 'Camada administrativa, jurídica e de consolidação. Não representa um quinto produto.', 'administrative', 'active', 'BRL', true),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'MUSICOS360', 'Music OS 360', 'Produto SaaS e serviços diretamente relacionados.', 'product', 'active', 'BRL', true),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'VIVENDOMUSICA', 'Vivendo da Música', 'Cursos, conteúdos e produtos digitais.', 'product', 'active', 'BRL', true),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'DICADECRIA', 'Dica de Cria', 'Cursos, conteúdos e produtos digitais.', 'product', 'active', 'BRL', true),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'LANDERSERVICES', 'Lander Services', 'Linhas de serviços profissionais prestados pela LANDER SOLUTIONS.', 'services', 'active', 'BRL', true)
on conflict (code) do nothing;

insert into public.products (
  id, business_unit_id, code, name, description, product_type, status, is_system
) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'MUSIC_OS_360', 'Music OS 360', 'Sistema SaaS para gestão do ecossistema musical.', 'saas', 'active', true),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', 'VIVENDO_DA_MUSICA', 'Vivendo da Música', 'Plataforma, cursos, conteúdos e produtos digitais.', 'course', 'active', true),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000004', 'DICA_DE_CRIA', 'Dica de Cria', 'Plataforma, cursos, conteúdos e produtos digitais.', 'course', 'active', true)
on conflict (code) do nothing;

insert into public.service_lines (
  id, business_unit_id, code, name, description, service_type, status, is_system
) values
  ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000005', 'SYSTEM_DEVELOPMENT', 'Desenvolvimento de sistemas', 'Projetos de software sob encomenda.', 'technology', 'active', false),
  ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000005', 'WEB_DEVELOPMENT', 'Websites e portais', 'Desenvolvimento de sites, landing pages e portais.', 'technology', 'active', false),
  ('40000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000005', 'AUTOMATIONS', 'Automações', 'Automações de processos e integrações para clientes.', 'technology', 'active', false),
  ('40000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000005', 'TECH_CONSULTING', 'Consultoria tecnológica', 'Arquitetura, processos e consultoria em tecnologia.', 'consulting', 'active', false),
  ('40000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000005', 'TECH_SUPPORT', 'Suporte técnico', 'Suporte, manutenção e operação tecnológica.', 'support', 'active', false),
  ('40000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000005', 'ADMIN_SUPPORT', 'Apoio administrativo', 'Serviços administrativos e backoffice.', 'administrative', 'active', false),
  ('40000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000005', 'DISPATCH_SERVICES', 'Serviços de dispatch', 'Serviços operacionais de dispatch, sem software próprio.', 'dispatch', 'active', false),
  ('40000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000005', 'OTHER_SERVICES', 'Outros serviços', 'Outras linhas de serviços aprovadas.', 'other', 'active', false)
on conflict (code) do nothing;

insert into public.financial_categories (code, name, category_type, status, is_system) values
  ('GROSS_REVENUE', 'Receita bruta', 'revenue', 'active', true),
  ('DISCOUNTS', 'Descontos', 'deduction', 'active', true),
  ('CANCELLATIONS', 'Cancelamentos', 'deduction', 'active', true),
  ('REFUNDS', 'Reembolsos', 'deduction', 'active', true),
  ('CHARGEBACKS', 'Chargebacks', 'deduction', 'active', true),
  ('REVENUE_TAXES', 'Impostos sobre receita', 'tax', 'active', true),
  ('PAYMENT_FEES', 'Taxas dos meios de pagamento', 'payment_fee', 'active', true),
  ('DIRECT_COSTS', 'Custos diretos', 'direct_cost', 'active', true),
  ('EXCLUSIVE_EXPENSES', 'Despesas exclusivas', 'expense', 'active', true),
  ('SHARED_EXPENSES', 'Despesas compartilhadas', 'expense', 'active', true),
  ('INVESTMENTS', 'Investimentos', 'investment', 'active', true),
  ('RESERVES', 'Reservas e contingências', 'reserve', 'active', true),
  ('INTERNAL_TRANSFERS', 'Transferências internas', 'transfer', 'active', true)
on conflict (code) do nothing;

alter table public.currencies enable row level security;
alter table public.legal_entities enable row level security;
alter table public.business_units enable row level security;
alter table public.products enable row level security;
alter table public.service_lines enable row level security;
alter table public.departments enable row level security;
alter table public.projects enable row level security;
alter table public.cost_centers enable row level security;
alter table public.revenue_centers enable row level security;
alter table public.financial_categories enable row level security;
alter table public.financial_periods enable row level security;

revoke all on table public.currencies, public.legal_entities, public.business_units,
  public.products, public.service_lines, public.departments, public.projects,
  public.cost_centers, public.revenue_centers, public.financial_categories,
  public.financial_periods from anon;

grant select, insert, update, delete on table public.currencies, public.legal_entities,
  public.business_units, public.products, public.service_lines, public.departments,
  public.projects, public.cost_centers, public.revenue_centers,
  public.financial_categories, public.financial_periods to authenticated;

create policy currencies_select_authorized on public.currencies
for select to authenticated
using (private.current_user_has_permission('corporate.read', null));
create policy currencies_insert_authorized on public.currencies
for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', null));
create policy currencies_update_authorized on public.currencies
for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', null))
with check (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', null));
create policy currencies_delete_authorized on public.currencies
for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', null));

create policy legal_entities_select_authorized on public.legal_entities
for select to authenticated
using (private.current_user_has_permission('corporate.read', null));
create policy legal_entities_insert_authorized on public.legal_entities
for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', null));
create policy legal_entities_update_authorized on public.legal_entities
for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', null))
with check (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', null));
create policy legal_entities_delete_authorized on public.legal_entities
for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', null));

create policy business_units_select_authorized on public.business_units
for select to authenticated
using (private.current_user_has_permission('corporate.read', code));
create policy business_units_insert_authorized on public.business_units
for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', code));
create policy business_units_update_authorized on public.business_units
for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', code))
with check (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', code));
create policy business_units_delete_authorized on public.business_units
for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', code));

create policy products_select_authorized on public.products
for select to authenticated
using (private.current_user_has_permission('corporate.read', private.unit_code_for_id(business_unit_id)));
create policy products_insert_authorized on public.products
for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', private.unit_code_for_id(business_unit_id)));
create policy products_update_authorized on public.products
for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', private.unit_code_for_id(business_unit_id)))
with check (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', private.unit_code_for_id(business_unit_id)));
create policy products_delete_authorized on public.products
for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', private.unit_code_for_id(business_unit_id)));

create policy service_lines_select_authorized on public.service_lines
for select to authenticated
using (private.current_user_has_permission('corporate.read', private.unit_code_for_id(business_unit_id)));
create policy service_lines_insert_authorized on public.service_lines
for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', private.unit_code_for_id(business_unit_id)));
create policy service_lines_update_authorized on public.service_lines
for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', private.unit_code_for_id(business_unit_id)))
with check (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', private.unit_code_for_id(business_unit_id)));
create policy service_lines_delete_authorized on public.service_lines
for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', private.unit_code_for_id(business_unit_id)));

create policy departments_select_authorized on public.departments
for select to authenticated
using (private.current_user_has_permission('corporate.read', case when business_unit_id is null then null else private.unit_code_for_id(business_unit_id) end));
create policy departments_insert_authorized on public.departments
for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', case when business_unit_id is null then null else private.unit_code_for_id(business_unit_id) end));
create policy departments_update_authorized on public.departments
for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', case when business_unit_id is null then null else private.unit_code_for_id(business_unit_id) end))
with check (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', case when business_unit_id is null then null else private.unit_code_for_id(business_unit_id) end));
create policy departments_delete_authorized on public.departments
for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', case when business_unit_id is null then null else private.unit_code_for_id(business_unit_id) end));

create policy projects_select_authorized on public.projects
for select to authenticated
using (private.current_user_has_permission('corporate.read', private.unit_code_for_id(business_unit_id)));
create policy projects_insert_authorized on public.projects
for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', private.unit_code_for_id(business_unit_id)));
create policy projects_update_authorized on public.projects
for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', private.unit_code_for_id(business_unit_id)))
with check (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', private.unit_code_for_id(business_unit_id)));
create policy projects_delete_authorized on public.projects
for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('corporate.manage', private.unit_code_for_id(business_unit_id)));

create policy cost_centers_select_authorized on public.cost_centers
for select to authenticated
using (private.current_user_has_permission('finance.read', case when business_unit_id is null then null else private.unit_code_for_id(business_unit_id) end));
create policy cost_centers_insert_authorized on public.cost_centers
for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('finance.manage', case when business_unit_id is null then null else private.unit_code_for_id(business_unit_id) end));
create policy cost_centers_update_authorized on public.cost_centers
for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('finance.manage', case when business_unit_id is null then null else private.unit_code_for_id(business_unit_id) end))
with check (private.current_user_has_aal2() and private.current_user_has_permission('finance.manage', case when business_unit_id is null then null else private.unit_code_for_id(business_unit_id) end));
create policy cost_centers_delete_authorized on public.cost_centers
for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('finance.manage', case when business_unit_id is null then null else private.unit_code_for_id(business_unit_id) end));

create policy revenue_centers_select_authorized on public.revenue_centers
for select to authenticated
using (private.current_user_has_permission('finance.read', private.unit_code_for_id(business_unit_id)));
create policy revenue_centers_insert_authorized on public.revenue_centers
for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('finance.manage', private.unit_code_for_id(business_unit_id)));
create policy revenue_centers_update_authorized on public.revenue_centers
for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('finance.manage', private.unit_code_for_id(business_unit_id)))
with check (private.current_user_has_aal2() and private.current_user_has_permission('finance.manage', private.unit_code_for_id(business_unit_id)));
create policy revenue_centers_delete_authorized on public.revenue_centers
for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('finance.manage', private.unit_code_for_id(business_unit_id)));

create policy financial_categories_select_authorized on public.financial_categories
for select to authenticated
using (private.current_user_has_permission('finance.read', null));
create policy financial_categories_insert_authorized on public.financial_categories
for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('finance.manage', null));
create policy financial_categories_update_authorized on public.financial_categories
for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('finance.manage', null))
with check (private.current_user_has_aal2() and private.current_user_has_permission('finance.manage', null));
create policy financial_categories_delete_authorized on public.financial_categories
for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('finance.manage', null));

create policy financial_periods_select_authorized on public.financial_periods
for select to authenticated
using (private.current_user_has_permission('finance.read', null));
create policy financial_periods_insert_authorized on public.financial_periods
for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('finance.manage', null));
create policy financial_periods_update_authorized on public.financial_periods
for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('finance.approve', null))
with check (private.current_user_has_aal2() and private.current_user_has_permission('finance.approve', null));
create policy financial_periods_delete_authorized on public.financial_periods
for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('finance.manage', null));
