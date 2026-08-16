-- RH operational domains: documents, leave, payments, onboarding, offboarding, equipment and access registry.

create table if not exists public.document_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  default_visibility text not null default 'RH_ONLY' check (default_visibility in ('RH_ONLY','EMPLOYEE_AND_RH','MANAGER_AND_RH','FINANCE_AND_RH')),
  status text not null default 'active' check (status in ('active','inactive')),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  deleted_at timestamptz
);

create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  document_type_id uuid not null references public.document_types(id) on delete restrict,
  name text not null,
  storage_bucket text not null default 'hr-documents',
  storage_path text not null,
  original_file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  issued_at date,
  expires_at date,
  notes text,
  visibility text not null check (visibility in ('RH_ONLY','EMPLOYEE_AND_RH','MANAGER_AND_RH','FINANCE_AND_RH')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','REPLACED','DELETED')),
  supersedes_document_id uuid references public.employee_documents(id) on delete restrict,
  uploaded_by uuid references auth.users(id) on delete set null default auth.uid(),
  uploaded_at timestamptz not null default now(),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  deleted_at timestamptz,
  constraint employee_document_dates_valid check (expires_at is null or issued_at is null or expires_at >= issued_at),
  constraint employee_document_safe_path check (storage_path !~ '(^|/)\.\.?(/|$)')
);
create index if not exists employee_documents_employee_idx on public.employee_documents (employee_id, status) where deleted_at is null;
create index if not exists employee_documents_expiry_idx on public.employee_documents (expires_at) where deleted_at is null and status='ACTIVE';
create unique index if not exists employee_documents_storage_unique on public.employee_documents (storage_bucket, storage_path) where deleted_at is null;

create table if not exists public.leave_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  requires_document boolean not null default false,
  status text not null default 'active' check (status in ('active','inactive')),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  deleted_at timestamptz
);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  leave_type_id uuid not null references public.leave_types(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  duration_days integer generated always as ((end_date - start_date) + 1) stored,
  reason text,
  document_storage_path text,
  status text not null default 'RASCUNHO' check (status in ('RASCUNHO','SOLICITADO','APROVADO','RECUSADO','CANCELADO','CONCLUIDO')),
  manager_employee_id uuid references public.employees(id) on delete restrict,
  approver_user_id uuid references auth.users(id) on delete set null,
  decision_at timestamptz,
  rejection_reason text,
  notes text,
  requested_by uuid references auth.users(id) on delete set null default auth.uid(),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  deleted_at timestamptz,
  constraint leave_request_dates_valid check (end_date >= start_date),
  constraint leave_rejection_reason_required check (status <> 'RECUSADO' or btrim(coalesce(rejection_reason,'')) <> ''),
  constraint leave_decision_fields_valid check (
    status not in ('APROVADO','RECUSADO') or (approver_user_id is not null and decision_at is not null)
  )
);
create index if not exists leave_requests_employee_period_idx on public.leave_requests (employee_id, start_date, end_date) where deleted_at is null;
create index if not exists leave_requests_status_period_idx on public.leave_requests (status, start_date) where deleted_at is null;

create table if not exists public.employee_payments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  contract_id uuid references public.employment_contracts(id) on delete restrict,
  competence date not null,
  description text not null,
  base_amount numeric(18,2) not null default 0 check (base_amount >= 0),
  additions numeric(18,2) not null default 0 check (additions >= 0),
  informational_deductions numeric(18,2) not null default 0 check (informational_deductions >= 0),
  final_amount numeric(18,2) generated always as (base_amount + additions - informational_deductions) stored,
  expected_date date not null,
  payment_date date,
  payment_method text,
  status text not null default 'PENDENTE' check (status in ('PENDENTE','AGENDADO','PAGO','ATRASADO','CANCELADO')),
  proof_storage_path text,
  notes text,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  deleted_at timestamptz,
  constraint employee_payment_final_nonnegative check ((base_amount + additions - informational_deductions) >= 0),
  constraint employee_payment_paid_date_required check (status <> 'PAGO' or payment_date is not null),
  constraint employee_payment_competence_first_day check (extract(day from competence) = 1)
);
create index if not exists employee_payments_employee_competence_idx on public.employee_payments (employee_id, competence desc) where deleted_at is null;
create index if not exists employee_payments_status_expected_idx on public.employee_payments (status, expected_date) where deleted_at is null;

create table if not exists public.onboarding_processes (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  expected_start_date date not null,
  responsible_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'PENDENTE' check (status in ('PENDENTE','EM_ANDAMENTO','CONCLUIDO','CANCELADO')),
  completion_percentage numeric(5,2) not null default 0 check (completion_percentage between 0 and 100),
  notes text,
  completed_at timestamptz,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  deleted_at timestamptz
);
create unique index if not exists onboarding_employee_open_unique on public.onboarding_processes (employee_id) where deleted_at is null and status in ('PENDENTE','EM_ANDAMENTO');
create index if not exists onboarding_status_date_idx on public.onboarding_processes (status, expected_start_date) where deleted_at is null;

create table if not exists public.onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  onboarding_process_id uuid not null references public.onboarding_processes(id) on delete restrict,
  title text not null,
  description text,
  responsible_user_id uuid references auth.users(id) on delete set null,
  due_date date,
  required boolean not null default true,
  status text not null default 'PENDENTE' check (status in ('PENDENTE','EM_ANDAMENTO','CONCLUIDA','CANCELADA')),
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  notes text,
  sort_order integer not null default 0,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  deleted_at timestamptz,
  constraint onboarding_task_completion_valid check (
    status <> 'CONCLUIDA' or (completed_at is not null and completed_by is not null)
  )
);
create index if not exists onboarding_tasks_process_idx on public.onboarding_tasks (onboarding_process_id, sort_order) where deleted_at is null;

create table if not exists public.offboarding_processes (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  requested_at timestamptz not null default now(),
  last_working_day date not null,
  effective_termination_date date,
  reason text not null,
  responsible_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'SOLICITADO' check (status in ('SOLICITADO','EM_ANDAMENTO','CONCLUIDO','CANCELADO')),
  notes text,
  financial_pending boolean not null default false,
  document_pending boolean not null default false,
  equipment_pending boolean not null default false,
  access_pending boolean not null default false,
  final_documents_storage_path text,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  deleted_at timestamptz,
  constraint offboarding_dates_valid check (effective_termination_date is null or effective_termination_date >= last_working_day),
  constraint offboarding_completion_valid check (status <> 'CONCLUIDO' or (completed_at is not null and completed_by is not null and effective_termination_date is not null))
);
create unique index if not exists offboarding_employee_open_unique on public.offboarding_processes (employee_id) where deleted_at is null and status in ('SOLICITADO','EM_ANDAMENTO');
create index if not exists offboarding_status_date_idx on public.offboarding_processes (status, last_working_day) where deleted_at is null;

create table if not exists public.offboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  offboarding_process_id uuid not null references public.offboarding_processes(id) on delete restrict,
  title text not null,
  description text,
  responsible_user_id uuid references auth.users(id) on delete set null,
  due_date date,
  required boolean not null default true,
  status text not null default 'PENDENTE' check (status in ('PENDENTE','EM_ANDAMENTO','CONCLUIDA','CANCELADA')),
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  notes text,
  sort_order integer not null default 0,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  deleted_at timestamptz,
  constraint offboarding_task_completion_valid check (
    status <> 'CONCLUIDA' or (completed_at is not null and completed_by is not null)
  )
);
create index if not exists offboarding_tasks_process_idx on public.offboarding_tasks (offboarding_process_id, sort_order) where deleted_at is null;

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid references public.business_units(id) on delete restrict,
  equipment_type text not null check (equipment_type in ('NOTEBOOK','DESKTOP','MONITOR','CELULAR','CHIP','TECLADO','MOUSE','HEADSET','CAMERA','OUTRO')),
  name text not null,
  manufacturer text,
  model text,
  serial_number text,
  asset_number text,
  condition text not null check (condition in ('NOVO','BOM','REGULAR','DANIFICADO')),
  status text not null default 'DISPONIVEL' check (status in ('DISPONIVEL','ATRIBUIDO','EM_MANUTENCAO','DEVOLVIDO','BAIXADO')),
  notes text,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  deleted_at timestamptz
);
create unique index if not exists equipment_serial_unique on public.equipment (lower(serial_number)) where serial_number is not null and deleted_at is null;
create unique index if not exists equipment_asset_unique on public.equipment (lower(asset_number)) where asset_number is not null and deleted_at is null;
create index if not exists equipment_unit_status_idx on public.equipment (business_unit_id, status) where deleted_at is null;

create table if not exists public.equipment_assignments (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  delivered_at date not null,
  expected_return_date date,
  returned_at date,
  delivery_condition text not null check (delivery_condition in ('NOVO','BOM','REGULAR','DANIFICADO')),
  return_condition text check (return_condition is null or return_condition in ('NOVO','BOM','REGULAR','DANIFICADO')),
  status text not null default 'ATIVO' check (status in ('ATIVO','DEVOLVIDO')),
  assigned_by uuid references auth.users(id) on delete set null default auth.uid(),
  returned_by uuid references auth.users(id) on delete set null,
  notes text,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  deleted_at timestamptz,
  constraint equipment_assignment_return_valid check (
    status <> 'DEVOLVIDO' or (returned_at is not null and return_condition is not null and returned_by is not null)
  ),
  constraint equipment_assignment_dates_valid check (returned_at is null or returned_at >= delivered_at)
);
create unique index if not exists equipment_assignment_active_unique on public.equipment_assignments (equipment_id) where deleted_at is null and status='ATIVO';
create index if not exists equipment_assignment_employee_idx on public.equipment_assignments (employee_id, status) where deleted_at is null;

create table if not exists public.employee_accesses (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  platform text not null,
  account_identifier text,
  access_type text,
  granted_at date,
  granted_by uuid references auth.users(id) on delete set null,
  status text not null default 'PENDENTE' check (status in ('PENDENTE','ATIVO','REVOGADO')),
  revoked_at date,
  revoked_by uuid references auth.users(id) on delete set null,
  notes text,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  deleted_at timestamptz,
  constraint employee_access_grant_valid check (status <> 'ATIVO' or (granted_at is not null and granted_by is not null)),
  constraint employee_access_revoke_valid check (status <> 'REVOGADO' or (revoked_at is not null and revoked_by is not null))
);
create index if not exists employee_accesses_employee_status_idx on public.employee_accesses (employee_id, status) where deleted_at is null;

insert into public.document_types (code,name,default_visibility)
values
  ('IDENTIFICACAO','Documento de identificação','RH_ONLY'),
  ('CPF','CPF','RH_ONLY'),
  ('COMPROVANTE_ENDERECO','Comprovante de endereço','RH_ONLY'),
  ('CONTRATO','Contrato','EMPLOYEE_AND_RH'),
  ('ADITIVO','Aditivo','EMPLOYEE_AND_RH'),
  ('TERMO_ASSINADO','Termo assinado','EMPLOYEE_AND_RH'),
  ('DADOS_BANCARIOS','Dados bancários','FINANCE_AND_RH'),
  ('CERTIFICADO','Certificado','MANAGER_AND_RH'),
  ('ATESTADO','Atestado','RH_ONLY'),
  ('DESLIGAMENTO','Documento de desligamento','EMPLOYEE_AND_RH'),
  ('OUTRO','Outro','RH_ONLY')
on conflict (code) do update set name=excluded.name, default_visibility=excluded.default_visibility, updated_at=now();

insert into public.leave_types (code,name,requires_document)
values
  ('FERIAS','Férias',false),
  ('FOLGA','Folga',false),
  ('ATESTADO','Atestado',true),
  ('AUSENCIA','Ausência',false),
  ('AFASTAMENTO','Afastamento',true),
  ('OUTRO','Outro',false)
on conflict (code) do update set name=excluded.name, requires_document=excluded.requires_document, updated_at=now();

create trigger document_types_touch_updated_at before update on public.document_types for each row execute function private.touch_updated_at();
create trigger employee_documents_touch_updated_at before update on public.employee_documents for each row execute function private.touch_updated_at();
create trigger leave_types_touch_updated_at before update on public.leave_types for each row execute function private.touch_updated_at();
create trigger leave_requests_touch_updated_at before update on public.leave_requests for each row execute function private.touch_updated_at();
create trigger employee_payments_touch_updated_at before update on public.employee_payments for each row execute function private.touch_updated_at();
create trigger onboarding_processes_touch_updated_at before update on public.onboarding_processes for each row execute function private.touch_updated_at();
create trigger onboarding_tasks_touch_updated_at before update on public.onboarding_tasks for each row execute function private.touch_updated_at();
create trigger offboarding_processes_touch_updated_at before update on public.offboarding_processes for each row execute function private.touch_updated_at();
create trigger offboarding_tasks_touch_updated_at before update on public.offboarding_tasks for each row execute function private.touch_updated_at();
create trigger equipment_touch_updated_at before update on public.equipment for each row execute function private.touch_updated_at();
create trigger equipment_assignments_touch_updated_at before update on public.equipment_assignments for each row execute function private.touch_updated_at();
create trigger employee_accesses_touch_updated_at before update on public.employee_accesses for each row execute function private.touch_updated_at();

alter table public.document_types enable row level security;
alter table public.employee_documents enable row level security;
alter table public.leave_types enable row level security;
alter table public.leave_requests enable row level security;
alter table public.employee_payments enable row level security;
alter table public.onboarding_processes enable row level security;
alter table public.onboarding_tasks enable row level security;
alter table public.offboarding_processes enable row level security;
alter table public.offboarding_tasks enable row level security;
alter table public.equipment enable row level security;
alter table public.equipment_assignments enable row level security;
alter table public.employee_accesses enable row level security;
