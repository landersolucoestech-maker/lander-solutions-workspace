-- Canonical corporate ownership schema.
-- Development-only migration for Supabase project jodzhcktrlwinywqgbab.

insert into public.permissions (code, module, action, description)
values
  ('corporate_ownership.read', 'corporate_ownership', 'read', 'Consultar estrutura societária, capital, quotas e beneficiários finais.'),
  ('corporate_ownership.manage', 'corporate_ownership', 'manage', 'Criar e manter rascunhos e registros societários.'),
  ('corporate_ownership.apply_changes', 'corporate_ownership', 'apply_changes', 'Aplicar alterações societárias aprovadas e historicamente rastreáveis.')
on conflict (code) do update
set module = excluded.module,
    action = excluded.action,
    description = excluded.description;

-- Existing corporate readers/managers retain equivalent non-executive access.
insert into public.role_permissions (role_id, permission_id)
select distinct rp.role_id, target.id
from public.role_permissions rp
join public.permissions source on source.id = rp.permission_id
join public.permissions target on target.code = 'corporate_ownership.read'
where source.code = 'corporate.read'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select distinct rp.role_id, target.id
from public.role_permissions rp
join public.permissions source on source.id = rp.permission_id
join public.permissions target on target.code = 'corporate_ownership.manage'
where source.code = 'corporate.manage'
on conflict do nothing;

-- Deliberately do not copy corporate.manage to corporate_ownership.apply_changes.
-- Application authority requires an explicit segregation-of-duties decision.

create table public.corporate_capital_structures (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  version_no integer not null,
  currency_code text not null references public.currencies(code) on delete restrict,
  capital_amount numeric(20,2) not null,
  total_quotas numeric(30,8) not null,
  status text not null default 'draft',
  effective_from date not null,
  effective_to date,
  change_reason text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  applied_by uuid references auth.users(id) on delete set null,
  applied_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint corporate_capital_structures_version_no_check check (version_no > 0),
  constraint corporate_capital_structures_capital_amount_check check (capital_amount >= 0),
  constraint corporate_capital_structures_total_quotas_check check (total_quotas > 0),
  constraint corporate_capital_structures_status_check check (status in ('draft','approved','effective','superseded','cancelled')),
  constraint corporate_capital_structures_period_check check (effective_to is null or effective_to >= effective_from),
  constraint corporate_capital_structures_approval_check check (
    status = 'draft' or (approved_by is not null and approved_at is not null)
  ),
  constraint corporate_capital_structures_application_check check (
    status not in ('effective','superseded') or (applied_by is not null and applied_at is not null)
  ),
  constraint corporate_capital_structures_entity_version_key unique (legal_entity_id, version_no)
);

create table public.corporate_share_classes (
  id uuid primary key default gen_random_uuid(),
  capital_structure_id uuid not null references public.corporate_capital_structures(id) on delete restrict,
  code text not null,
  name text not null,
  description text,
  authorized_quotas numeric(30,8) not null,
  voting_rights boolean not null default true,
  votes_per_quota numeric(20,8) not null default 1,
  distribution_priority integer not null default 0,
  liquidation_priority integer not null default 0,
  status text not null default 'active',
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint corporate_share_classes_code_format_check check (code ~ '^[A-Z0-9][A-Z0-9_-]*$'),
  constraint corporate_share_classes_authorized_quotas_check check (authorized_quotas > 0),
  constraint corporate_share_classes_votes_check check (votes_per_quota >= 0),
  constraint corporate_share_classes_priority_check check (distribution_priority >= 0 and liquidation_priority >= 0),
  constraint corporate_share_classes_status_check check (status in ('active','inactive')),
  constraint corporate_share_classes_structure_code_key unique (capital_structure_id, code)
);

create table public.corporate_ownership_positions (
  id uuid primary key default gen_random_uuid(),
  capital_structure_id uuid not null references public.corporate_capital_structures(id) on delete restrict,
  share_class_id uuid not null references public.corporate_share_classes(id) on delete restrict,
  holder_party_id uuid not null references public.parties(id) on delete restrict,
  quota_quantity numeric(30,8) not null,
  acquisition_method text not null default 'subscription',
  effective_from date not null,
  effective_to date,
  status text not null default 'active',
  evidence_document_id uuid references public.governance_documents(id) on delete restrict,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint corporate_ownership_positions_quota_check check (quota_quantity > 0),
  constraint corporate_ownership_positions_method_check check (acquisition_method in ('subscription','transfer','capitalization','inheritance','conversion','adjustment')),
  constraint corporate_ownership_positions_period_check check (effective_to is null or effective_to >= effective_from),
  constraint corporate_ownership_positions_status_check check (status in ('active','exited','cancelled')),
  constraint corporate_ownership_positions_exit_check check (status <> 'exited' or effective_to is not null)
);

create table public.corporate_ownership_roles (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  party_id uuid not null references public.parties(id) on delete restrict,
  ownership_position_id uuid references public.corporate_ownership_positions(id) on delete restrict,
  role_type text not null,
  ultimate_ownership_percentage numeric(9,6),
  effective_from date not null,
  effective_to date,
  status text not null default 'active',
  evidence_document_id uuid references public.governance_documents(id) on delete restrict,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint corporate_ownership_roles_type_check check (role_type in ('shareholder','administrator','director','officer','beneficial_owner','legal_representative')),
  constraint corporate_ownership_roles_percentage_check check (ultimate_ownership_percentage is null or ultimate_ownership_percentage between 0 and 100),
  constraint corporate_ownership_roles_period_check check (effective_to is null or effective_to >= effective_from),
  constraint corporate_ownership_roles_status_check check (status in ('active','ended','cancelled')),
  constraint corporate_ownership_roles_end_check check (status <> 'ended' or effective_to is not null)
);

create table public.corporate_resolutions (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  code text not null,
  resolution_type text not null,
  title text not null,
  summary text,
  held_on date not null,
  status text not null default 'draft',
  evidence_document_id uuid references public.governance_documents(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint corporate_resolutions_code_key unique (legal_entity_id, code),
  constraint corporate_resolutions_type_check check (resolution_type in ('shareholders_meeting','quotaholders_meeting','sole_shareholder_decision','board_resolution','management_decision','written_consent')),
  constraint corporate_resolutions_status_check check (status in ('draft','approved','applied','cancelled')),
  constraint corporate_resolutions_evidence_check check (
    status = 'draft' or (approved_by is not null and approved_at is not null and evidence_document_id is not null)
  )
);

create table public.corporate_ownership_changes (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  code text not null,
  change_type text not null,
  effective_on date not null,
  status text not null default 'draft',
  source_capital_structure_id uuid references public.corporate_capital_structures(id) on delete restrict,
  resulting_capital_structure_id uuid references public.corporate_capital_structures(id) on delete restrict,
  resolution_id uuid references public.corporate_resolutions(id) on delete restrict,
  evidence_document_id uuid references public.governance_documents(id) on delete restrict,
  justification text not null,
  requested_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  applied_by uuid references auth.users(id) on delete set null,
  applied_at timestamptz,
  reversed_by uuid references auth.users(id) on delete set null,
  reversed_at timestamptz,
  reversal_reason text,
  request_id text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint corporate_ownership_changes_code_key unique (legal_entity_id, code),
  constraint corporate_ownership_changes_type_check check (change_type in ('incorporation','quota_issue','quota_transfer','capital_increase','capital_reduction','capital_contribution','share_class_change','beneficial_owner_change','administration_change','correction','reversal')),
  constraint corporate_ownership_changes_status_check check (status in ('draft','submitted','approved','applied','rejected','reversed','cancelled')),
  constraint corporate_ownership_changes_approval_check check (
    status not in ('approved','applied','reversed') or (approved_by is not null and approved_at is not null)
  ),
  constraint corporate_ownership_changes_application_check check (
    status not in ('applied','reversed') or (applied_by is not null and applied_at is not null and evidence_document_id is not null)
  ),
  constraint corporate_ownership_changes_reversal_check check (
    status <> 'reversed' or (reversed_by is not null and reversed_at is not null and nullif(btrim(reversal_reason), '') is not null)
  )
);

create table public.corporate_ownership_change_lines (
  id uuid primary key default gen_random_uuid(),
  change_id uuid not null references public.corporate_ownership_changes(id) on delete restrict,
  sequence_no integer not null,
  operation_type text not null,
  holder_party_id uuid references public.parties(id) on delete restrict,
  counterparty_party_id uuid references public.parties(id) on delete restrict,
  share_class_id uuid references public.corporate_share_classes(id) on delete restrict,
  source_position_id uuid references public.corporate_ownership_positions(id) on delete restrict,
  quota_delta numeric(30,8) not null default 0,
  capital_delta numeric(20,2) not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint corporate_ownership_change_lines_sequence_check check (sequence_no > 0),
  constraint corporate_ownership_change_lines_operation_check check (operation_type in ('issue','transfer_out','transfer_in','cancel','increase','reduce','contribute','role_add','role_end','adjust')),
  constraint corporate_ownership_change_lines_nonzero_check check (quota_delta <> 0 or capital_delta <> 0 or operation_type in ('role_add','role_end')),
  constraint corporate_ownership_change_lines_change_sequence_key unique (change_id, sequence_no)
);

create index corporate_capital_structures_entity_status_idx
  on public.corporate_capital_structures (legal_entity_id, status, effective_from desc);
create unique index corporate_capital_structures_one_effective_idx
  on public.corporate_capital_structures (legal_entity_id)
  where status = 'effective';
create index corporate_share_classes_structure_idx
  on public.corporate_share_classes (capital_structure_id, status);
create index corporate_ownership_positions_structure_status_idx
  on public.corporate_ownership_positions (capital_structure_id, status);
create index corporate_ownership_positions_holder_idx
  on public.corporate_ownership_positions (holder_party_id, status, effective_from desc);
create index corporate_ownership_roles_entity_party_idx
  on public.corporate_ownership_roles (legal_entity_id, party_id, status);
create index corporate_ownership_changes_entity_status_idx
  on public.corporate_ownership_changes (legal_entity_id, status, effective_on desc);
create index corporate_ownership_change_lines_change_idx
  on public.corporate_ownership_change_lines (change_id, sequence_no);
create index corporate_resolutions_entity_status_idx
  on public.corporate_resolutions (legal_entity_id, status, held_on desc);

create or replace view public.corporate_ownership_current_positions
with (security_invoker = true)
as
select
  cs.legal_entity_id,
  op.capital_structure_id,
  op.share_class_id,
  sc.code as share_class_code,
  sc.name as share_class_name,
  op.holder_party_id,
  sum(op.quota_quantity) as quota_quantity,
  cs.total_quotas,
  round((sum(op.quota_quantity) / cs.total_quotas) * 100, 6) as ownership_percentage,
  min(op.effective_from) as effective_from,
  max(op.version) as source_version
from public.corporate_ownership_positions op
join public.corporate_capital_structures cs on cs.id = op.capital_structure_id
join public.corporate_share_classes sc on sc.id = op.share_class_id
where op.status = 'active'
  and cs.status = 'effective'
  and op.effective_from <= current_date
  and (op.effective_to is null or op.effective_to >= current_date)
group by cs.legal_entity_id, op.capital_structure_id, op.share_class_id,
         sc.code, sc.name, op.holder_party_id, cs.total_quotas;

comment on table public.corporate_capital_structures is 'Versioned capital structures for a legal entity; effective versions preserve historical capital and quota totals.';
comment on table public.corporate_ownership_positions is 'Temporal quota positions. Percentages are derived from quota quantities and the capital structure total.';
comment on table public.corporate_ownership_roles is 'Temporal societary roles, including administrators and beneficial owners; never contractual participation.';
comment on table public.corporate_ownership_changes is 'Auditable corporate ownership operations. Applied records are immutable and require documentary evidence.';
comment on view public.corporate_ownership_current_positions is 'Current effective ownership positions with percentages derived from quotas.';
