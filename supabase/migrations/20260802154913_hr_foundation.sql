-- RH foundation: person, employee, position and employment contract separation.

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid references public.business_units(id) on delete restrict,
  department_id uuid references public.departments(id) on delete restrict,
  code text not null,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  deleted_at timestamptz,
  constraint positions_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,63}$')
);

create unique index if not exists positions_scope_code_unique
  on public.positions (coalesce(business_unit_id, '00000000-0000-0000-0000-000000000000'::uuid), code)
  where deleted_at is null;
create index if not exists positions_business_unit_idx on public.positions (business_unit_id) where deleted_at is null;
create index if not exists positions_department_idx on public.positions (department_id) where deleted_at is null;

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  social_name text,
  cpf text not null,
  birth_date date not null,
  personal_email text,
  phone text,
  address_line text,
  city text,
  state text,
  postal_code text,
  emergency_contact_name text,
  emergency_contact_phone text,
  photo_path text,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  deleted_at timestamptz,
  constraint people_legal_name_not_blank check (btrim(legal_name) <> ''),
  constraint people_cpf_digits check (cpf ~ '^[0-9]{11}$'),
  constraint people_birth_date_valid check (birth_date <= current_date),
  constraint people_personal_email_format check (
    personal_email is null or personal_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  ),
  constraint people_state_format check (state is null or state ~ '^[A-Z]{2}$'),
  constraint people_postal_code_format check (postal_code is null or postal_code ~ '^[0-9]{8}$')
);

create unique index if not exists people_cpf_active_unique
  on public.people (cpf)
  where deleted_at is null;
create index if not exists people_name_idx on public.people using gin (to_tsvector('portuguese', legal_name));

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  corporate_email text,
  business_unit_id uuid not null references public.business_units(id) on delete restrict,
  department_id uuid references public.departments(id) on delete restrict,
  position_id uuid references public.positions(id) on delete restrict,
  manager_employee_id uuid references public.employees(id) on delete restrict,
  hire_date date not null,
  employment_type text not null check (employment_type in ('CLT','PJ','FREELANCER','ESTAGIO','SOCIO','OUTRO')),
  work_schedule text,
  work_mode text not null check (work_mode in ('PRESENCIAL','HIBRIDO','REMOTO')),
  status text not null default 'ATIVO' check (status in ('ATIVO','AFASTADO','DESLIGADO')),
  internal_notes text,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  deleted_at timestamptz,
  constraint employees_manager_not_self check (manager_employee_id is null or manager_employee_id <> id),
  constraint employees_corporate_email_format check (
    corporate_email is null or corporate_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  ),
  constraint employees_hire_date_reasonable check (hire_date >= date '1900-01-01')
);

create unique index if not exists employees_person_active_unique
  on public.employees (person_id)
  where deleted_at is null and status <> 'DESLIGADO';
create unique index if not exists employees_user_unique
  on public.employees (user_id)
  where user_id is not null and deleted_at is null;
create unique index if not exists employees_corporate_email_unique
  on public.employees (lower(corporate_email))
  where corporate_email is not null and deleted_at is null;
create index if not exists employees_business_unit_status_idx on public.employees (business_unit_id, status) where deleted_at is null;
create index if not exists employees_manager_idx on public.employees (manager_employee_id) where deleted_at is null;
create index if not exists employees_department_idx on public.employees (department_id) where deleted_at is null;
create index if not exists employees_position_idx on public.employees (position_id) where deleted_at is null;

create table if not exists public.employment_contracts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  business_unit_id uuid not null references public.business_units(id) on delete restrict,
  position_id uuid references public.positions(id) on delete restrict,
  contract_type text not null check (contract_type in ('CLT','PJ','FREELANCER','ESTAGIO','SOCIO','OUTRO')),
  start_date date not null,
  end_date date,
  amount numeric(18,2) check (amount is null or amount >= 0),
  payment_frequency text check (payment_frequency is null or payment_frequency in ('MENSAL','QUINZENAL','SEMANAL','POR_PROJETO','POR_HORA','OUTRO')),
  payment_method text,
  work_schedule text,
  work_mode text not null check (work_mode in ('PRESENCIAL','HIBRIDO','REMOTO')),
  status text not null default 'RASCUNHO' check (status in ('RASCUNHO','ATIVO','ENCERRADO','CANCELADO','VENCIDO')),
  file_path text,
  notes text,
  is_primary boolean not null default true,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  deleted_at timestamptz,
  constraint employment_contract_dates_valid check (end_date is null or end_date >= start_date)
);

create unique index if not exists employment_contract_active_primary_unique
  on public.employment_contracts (employee_id, legal_entity_id)
  where status = 'ATIVO' and is_primary and deleted_at is null;
create index if not exists employment_contract_employee_idx on public.employment_contracts (employee_id, status) where deleted_at is null;
create index if not exists employment_contract_unit_end_idx on public.employment_contracts (business_unit_id, end_date) where deleted_at is null;

create table if not exists public.employment_contract_history (
  id bigint generated always as identity primary key,
  contract_id uuid not null references public.employment_contracts(id) on delete restrict,
  changed_at timestamptz not null default clock_timestamp(),
  changed_by uuid references auth.users(id) on delete set null default auth.uid(),
  changed_fields text[] not null default '{}',
  before_data jsonb not null,
  after_data jsonb not null
);
create index if not exists employment_contract_history_contract_idx
  on public.employment_contract_history (contract_id, changed_at desc);

create table if not exists public.hr_settings (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid references public.business_units(id) on delete restrict,
  contract_expiry_alert_days integer not null default 30 check (contract_expiry_alert_days between 1 and 365),
  document_expiry_alert_days integer not null default 30 check (document_expiry_alert_days between 1 and 365),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  deleted_at timestamptz
);
create unique index if not exists hr_settings_scope_unique
  on public.hr_settings (coalesce(business_unit_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where deleted_at is null;

create or replace function private.track_employment_contract_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fields text[] := '{}';
begin
  if old.position_id is distinct from new.position_id then v_fields := array_append(v_fields, 'position_id'); end if;
  if old.amount is distinct from new.amount then v_fields := array_append(v_fields, 'amount'); end if;
  if old.business_unit_id is distinct from new.business_unit_id then v_fields := array_append(v_fields, 'business_unit_id'); end if;
  if old.contract_type is distinct from new.contract_type then v_fields := array_append(v_fields, 'contract_type'); end if;
  if old.work_schedule is distinct from new.work_schedule then v_fields := array_append(v_fields, 'work_schedule'); end if;
  if old.work_mode is distinct from new.work_mode then v_fields := array_append(v_fields, 'work_mode'); end if;
  if old.end_date is distinct from new.end_date then v_fields := array_append(v_fields, 'end_date'); end if;
  if old.status is distinct from new.status then v_fields := array_append(v_fields, 'status'); end if;

  if cardinality(v_fields) > 0 then
    insert into public.employment_contract_history (
      contract_id, changed_by, changed_fields, before_data, after_data
    ) values (
      new.id,
      coalesce(auth.uid(), new.updated_by),
      v_fields,
      to_jsonb(old) - array['file_path','notes','created_by','updated_by'],
      to_jsonb(new) - array['file_path','notes','created_by','updated_by']
    );
  end if;
  return new;
end;
$$;

create trigger positions_touch_updated_at
before update on public.positions
for each row execute function private.touch_updated_at();
create trigger people_touch_updated_at
before update on public.people
for each row execute function private.touch_updated_at();
create trigger employees_touch_updated_at
before update on public.employees
for each row execute function private.touch_updated_at();
create trigger employment_contracts_touch_updated_at
before update on public.employment_contracts
for each row execute function private.touch_updated_at();
create trigger hr_settings_touch_updated_at
before update on public.hr_settings
for each row execute function private.touch_updated_at();
create trigger employment_contracts_history
before update on public.employment_contracts
for each row execute function private.track_employment_contract_history();

alter table public.positions enable row level security;
alter table public.people enable row level security;
alter table public.employees enable row level security;
alter table public.employment_contracts enable row level security;
alter table public.employment_contract_history enable row level security;
alter table public.hr_settings enable row level security;

comment on table public.people is 'Dados pessoais separados da identidade autenticável e do vínculo organizacional.';
comment on table public.employees is 'Participação da pessoa na organização; não representa autenticação nem contrato.';
comment on table public.employment_contracts is 'Vínculos contratuais e financeiros históricos do colaborador.';
