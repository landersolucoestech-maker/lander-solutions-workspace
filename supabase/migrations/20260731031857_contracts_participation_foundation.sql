insert into public.permissions (code, module, action, description)
values
  ('contracts.read', 'contracts', 'read', 'Consultar contratos, versões, partes e obrigações.'),
  ('contracts.create', 'contracts', 'create', 'Criar contratos em rascunho.'),
  ('contracts.update_draft', 'contracts', 'update_draft', 'Alterar contratos e versões ainda não aprovados.'),
  ('contracts.approve', 'contracts', 'approve', 'Aprovar versões e ativar contratos.'),
  ('contracts.terminate', 'contracts', 'terminate', 'Encerrar ou cancelar contratos vigentes.'),
  ('contracts.documents.manage', 'contracts', 'documents_manage', 'Administrar documentos contratuais.')
on conflict (code) do update
set module = excluded.module,
    action = excluded.action,
    description = excluded.description;

with grants(role_code, permission_code) as (
  values
    ('owner', 'contracts.read'), ('owner', 'contracts.create'), ('owner', 'contracts.update_draft'),
    ('owner', 'contracts.approve'), ('owner', 'contracts.terminate'), ('owner', 'contracts.documents.manage'),
    ('corporate_admin', 'contracts.read'), ('corporate_admin', 'contracts.create'),
    ('corporate_admin', 'contracts.update_draft'), ('corporate_admin', 'contracts.approve'),
    ('corporate_admin', 'contracts.terminate'), ('corporate_admin', 'contracts.documents.manage'),
    ('contract_manager', 'contracts.read'), ('contract_manager', 'contracts.create'),
    ('contract_manager', 'contracts.update_draft'), ('contract_manager', 'contracts.documents.manage'),
    ('legal', 'contracts.read'), ('legal', 'contracts.create'), ('legal', 'contracts.update_draft'),
    ('legal', 'contracts.approve'), ('legal', 'contracts.terminate'), ('legal', 'contracts.documents.manage'),
    ('participation_manager', 'contracts.read'), ('participation_manager', 'contracts.create'),
    ('participation_manager', 'contracts.update_draft'), ('participation_manager', 'contracts.documents.manage'),
    ('finance_manager', 'contracts.read'),
    ('commercial', 'contracts.read'), ('commercial', 'contracts.create'), ('commercial', 'contracts.update_draft'),
    ('unit_manager', 'contracts.read'), ('unit_manager', 'contracts.create'), ('unit_manager', 'contracts.update_draft'),
    ('compliance', 'contracts.read'), ('auditor', 'contracts.read'),
    ('executive_readonly', 'contracts.read'), ('readonly', 'contracts.read')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from grants g
join public.app_roles r on r.code = g.role_code
join public.permissions p on p.code = g.permission_code
on conflict do nothing;

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  business_unit_id uuid not null references public.business_units(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  service_line_id uuid references public.service_lines(id) on delete restrict,
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_-]{2,39}$'),
  title text not null check (char_length(btrim(title)) between 3 and 240),
  contract_type text not null check (contract_type in (
    'client', 'supplier', 'service', 'participation', 'investment', 'partnership', 'nda', 'employment', 'other'
  )),
  currency_code text not null default 'BRL' references public.currencies(code),
  billing_frequency text not null default 'none' check (billing_frequency in (
    'none', 'one_time', 'weekly', 'monthly', 'quarterly', 'semiannual', 'annual', 'milestone', 'usage_based'
  )),
  base_amount numeric(20,6) check (base_amount is null or base_amount >= 0),
  recognition_regime text not null default 'COMPETENCIA' check (recognition_regime in (
    'COMPETENCIA', 'CAIXA', 'HIBRIDO_CONTRATUAL'
  )),
  starts_on date,
  ends_on date,
  auto_renewal boolean not null default false,
  renewal_notice_days integer not null default 30 check (renewal_notice_days between 0 and 730),
  responsible_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'draft' check (status in (
    'draft', 'in_review', 'pending_signature', 'active', 'renewal', 'expired', 'terminated', 'cancelled'
  )),
  notes text check (notes is null or char_length(notes) <= 4000),
  version integer not null default 1 check (version > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  check (product_id is null or service_line_id is null)
);

create table public.contract_parties (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete restrict,
  party_id uuid not null references public.parties(id) on delete restrict,
  party_role text not null check (party_role in (
    'counterparty', 'client', 'supplier', 'participant', 'investor', 'beneficiary', 'guarantor', 'signatory', 'service_provider', 'other'
  )),
  is_primary boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive', 'ended')),
  starts_on date,
  ends_on date,
  notes text check (notes is null or char_length(notes) <= 2000),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table public.contract_versions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  effective_from date not null,
  effective_to date,
  change_reason text not null check (char_length(btrim(change_reason)) between 3 and 2000),
  calculation_basis text not null default 'gross_revenue' check (calculation_basis in (
    'gross_revenue', 'revenue_after_discounts', 'revenue_after_refunds', 'net_revenue',
    'selected_revenue', 'result_after_direct_costs', 'result_after_exclusive_expenses',
    'result_after_authorized_allocations', 'operating_profit', 'managerial_net_profit', 'typed_composition'
  )),
  included_components text[] not null default '{}',
  excluded_components text[] not null default '{}',
  loss_rule text not null default 'no_future_effect' check (loss_rule in (
    'absorbed_by_company', 'shared', 'reduce_future_bases', 'offset_future_profits', 'limited_offset', 'no_future_effect'
  )),
  investment_rule text not null default 'non_recoverable' check (investment_rule in (
    'non_recoverable', 'recover_before_split', 'recover_in_installments', 'advance', 'contractual_loan',
    'participant_expense', 'result_reinvestment', 'operational_reserve'
  )),
  reserve_method text not null default 'none' check (reserve_method in ('none', 'percentage', 'fixed_amount', 'formula_component')),
  reserve_value numeric(20,6) check (reserve_value is null or reserve_value >= 0),
  rounding_scale smallint not null default 2 check (rounding_scale between 0 and 6),
  allows_distinct_bases boolean not null default false,
  payment_term_days integer not null default 10 check (payment_term_days between 0 and 3650),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'superseded', 'rejected')),
  requested_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id, version_number),
  check (effective_to is null or effective_to >= effective_from),
  check ((status in ('approved', 'superseded')) = (approved_at is not null and approved_by is not null))
);

create table public.contract_formula_components (
  id uuid primary key default gen_random_uuid(),
  contract_version_id uuid not null references public.contract_versions(id) on delete restrict,
  sequence_no integer not null check (sequence_no between 1 and 1000),
  component_type text not null check (component_type in (
    'product_revenue', 'plan_revenue', 'channel_revenue', 'country_revenue', 'currency_revenue',
    'discounts', 'cancellations', 'refunds', 'chargebacks', 'taxes', 'payment_fees',
    'direct_costs', 'exclusive_expenses', 'shared_expenses', 'recoverable_investments',
    'reserves', 'contingencies', 'reinvestments', 'accumulated_losses', 'specific_revenue',
    'specific_expense', 'advances', 'compensations'
  )),
  operation text not null check (operation in ('include', 'exclude', 'add', 'deduct', 'reserve')),
  recognition_basis text not null default 'contract' check (recognition_basis in ('contract', 'COMPETENCIA', 'CAIXA')),
  filter_scope text not null default 'all' check (filter_scope in ('all', 'product', 'plan', 'channel', 'country', 'currency', 'category', 'project')),
  filter_value text,
  description text check (description is null or char_length(description) <= 1000),
  status text not null default 'active' check (status in ('active', 'inactive')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_version_id, sequence_no),
  check ((filter_scope = 'all' and filter_value is null) or (filter_scope <> 'all' and filter_value is not null))
);

create table public.contract_version_participants (
  id uuid primary key default gen_random_uuid(),
  contract_version_id uuid not null references public.contract_versions(id) on delete restrict,
  party_id uuid not null references public.parties(id) on delete restrict,
  percentage numeric(9,6) not null check (percentage > 0 and percentage <= 100),
  priority integer not null default 100 check (priority between 1 and 10000),
  minimum_amount numeric(20,6) check (minimum_amount is null or minimum_amount >= 0),
  maximum_amount numeric(20,6) check (maximum_amount is null or maximum_amount >= 0),
  retention_percentage numeric(9,6) not null default 0 check (retention_percentage between 0 and 100),
  eligibility_condition text check (eligibility_condition is null or char_length(eligibility_condition) <= 2000),
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_version_id, party_id),
  check (maximum_amount is null or minimum_amount is null or maximum_amount >= minimum_amount)
);

create table public.contract_obligations (
  id uuid primary key default gen_random_uuid(),
  contract_version_id uuid not null references public.contract_versions(id) on delete restrict,
  obligation_type text not null check (obligation_type in (
    'delivery', 'payment', 'reporting', 'sla', 'confidentiality', 'compliance', 'renewal', 'notice', 'other'
  )),
  title text not null check (char_length(btrim(title)) between 3 and 200),
  description text not null check (char_length(btrim(description)) between 3 and 4000),
  responsible_party_id uuid references public.parties(id) on delete restrict,
  due_rule text not null default 'manual' check (due_rule in ('manual', 'fixed_date', 'days_after_period', 'days_after_invoice', 'recurring')),
  due_date date,
  recurrence text not null default 'none' check (recurrence in ('none', 'weekly', 'monthly', 'quarterly', 'semiannual', 'annual')),
  amount numeric(20,6) check (amount is null or amount >= 0),
  currency_code text references public.currencies(code),
  status text not null default 'active' check (status in ('active', 'fulfilled', 'waived', 'breached', 'inactive')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((due_rule = 'fixed_date' and due_date is not null) or due_rule <> 'fixed_date'),
  check ((amount is null and currency_code is null) or (amount is not null and currency_code is not null))
);

create table public.contract_documents (
  id uuid primary key default gen_random_uuid(),
  contract_version_id uuid not null references public.contract_versions(id) on delete restrict,
  document_type text not null check (document_type in ('main_contract', 'amendment', 'annex', 'proposal', 'signature_evidence', 'approval_evidence', 'other')),
  label text not null check (char_length(btrim(label)) between 2 and 200),
  storage_provider text not null default 'none' check (storage_provider in ('none', 'r2', 'supabase', 'external')),
  storage_bucket text,
  storage_object_key text,
  external_reference text,
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-fA-F]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'uploaded', 'verified', 'superseded', 'inactive')),
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contract_approvals (
  id uuid primary key default gen_random_uuid(),
  contract_version_id uuid not null references public.contract_versions(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  approver_user_id uuid references auth.users(id) on delete restrict,
  decision text not null default 'pending' check (decision in ('pending', 'approved', 'rejected', 'cancelled')),
  decision_reason text check (decision_reason is null or char_length(decision_reason) <= 2000),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check ((decision = 'pending' and decided_at is null) or (decision <> 'pending' and decided_at is not null)),
  check (approver_user_id is null or approver_user_id <> requested_by)
);

create index contracts_legal_entity_idx on public.contracts(legal_entity_id);
create index contracts_business_unit_idx on public.contracts(business_unit_id);
create index contracts_product_idx on public.contracts(product_id);
create index contracts_service_line_idx on public.contracts(service_line_id);
create index contracts_currency_idx on public.contracts(currency_code);
create index contracts_responsible_idx on public.contracts(responsible_user_id);
create index contracts_status_idx on public.contracts(status);
create index contract_parties_contract_idx on public.contract_parties(contract_id);
create index contract_parties_party_idx on public.contract_parties(party_id);
create unique index contract_parties_primary_idx on public.contract_parties(contract_id)
  where status = 'active' and is_primary;
create index contract_versions_contract_idx on public.contract_versions(contract_id);
create index contract_versions_requested_idx on public.contract_versions(requested_by);
create index contract_versions_approved_idx on public.contract_versions(approved_by);
create unique index contract_versions_one_approved_idx on public.contract_versions(contract_id)
  where status = 'approved';
create index contract_formula_components_version_idx on public.contract_formula_components(contract_version_id);
create index contract_version_participants_version_idx on public.contract_version_participants(contract_version_id);
create index contract_version_participants_party_idx on public.contract_version_participants(party_id);
create index contract_obligations_version_idx on public.contract_obligations(contract_version_id);
create index contract_obligations_party_idx on public.contract_obligations(responsible_party_id);
create index contract_obligations_currency_idx on public.contract_obligations(currency_code);
create index contract_documents_version_idx on public.contract_documents(contract_version_id);
create index contract_documents_verified_idx on public.contract_documents(verified_by);
create index contract_approvals_version_idx on public.contract_approvals(contract_version_id);
create index contract_approvals_requester_idx on public.contract_approvals(requested_by);
create index contract_approvals_approver_idx on public.contract_approvals(approver_user_id);

create or replace function private.contract_unit_code(p_contract_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.unit_code_for_id(c.business_unit_id)
  from public.contracts c
  where c.id = p_contract_id;
$$;

create or replace function private.contract_version_unit_code(p_version_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.contract_unit_code(v.contract_id)
  from public.contract_versions v
  where v.id = p_version_id;
$$;

create or replace function private.validate_contract_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product_unit uuid;
  v_service_unit uuid;
begin
  if new.product_id is not null then
    select business_unit_id into v_product_unit from public.products where id = new.product_id;
    if v_product_unit is distinct from new.business_unit_id then
      raise exception 'O produto não pertence à unidade informada.';
    end if;
  end if;
  if new.service_line_id is not null then
    select business_unit_id into v_service_unit from public.service_lines where id = new.service_line_id;
    if v_service_unit is distinct from new.business_unit_id then
      raise exception 'A linha de serviço não pertence à unidade informada.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.protect_contract_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status not in ('draft', 'rejected') then
      raise exception 'Somente versões em rascunho ou rejeitadas podem ser excluídas.';
    end if;
    return old;
  end if;

  if old.status = 'superseded' then
    raise exception 'Versão substituída é imutável.';
  end if;

  if old.status = 'approved' then
    if new.status <> 'superseded'
       or (to_jsonb(new) - array['status','updated_at','version']::text[])
          <> (to_jsonb(old) - array['status','updated_at','version']::text[]) then
      raise exception 'Versão aprovada somente pode ser marcada como substituída sem alterar seus termos.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.ensure_version_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version_id uuid;
  v_status text;
begin
  v_version_id := case when tg_op = 'DELETE' then old.contract_version_id else new.contract_version_id end;
  select status into v_status from public.contract_versions where id = v_version_id;
  if v_status not in ('draft', 'in_review', 'rejected') then
    raise exception 'Itens de versão aprovada ou substituída são imutáveis.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.validate_participation_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version_id uuid;
  v_total numeric;
  v_distinct boolean;
begin
  v_version_id := case when tg_op = 'DELETE' then old.contract_version_id else new.contract_version_id end;
  select allows_distinct_bases into v_distinct from public.contract_versions where id = v_version_id;
  if coalesce(v_distinct, false) then
    return null;
  end if;
  select coalesce(sum(percentage), 0) into v_total
  from public.contract_version_participants
  where contract_version_id = v_version_id and status = 'active';
  if v_total > 100 then
    raise exception 'A soma das participações ativas não pode exceder 100%%.';
  end if;
  return null;
end;
$$;

create or replace function private.prevent_used_contract_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status <> 'draft' then
    raise exception 'Somente contrato em rascunho pode ser excluído fisicamente.';
  end if;
  if exists (select 1 from public.contract_versions where contract_id = old.id)
     or exists (select 1 from public.contract_parties where contract_id = old.id) then
    raise exception 'Contrato com vínculos deve ser cancelado, não excluído.';
  end if;
  return old;
end;
$$;

revoke all on function private.contract_unit_code(uuid) from public, anon;
revoke all on function private.contract_version_unit_code(uuid) from public, anon;
grant execute on function private.contract_unit_code(uuid) to authenticated, service_role;
grant execute on function private.contract_version_unit_code(uuid) to authenticated, service_role;
revoke all on function private.validate_contract_scope() from public, anon, authenticated;
revoke all on function private.protect_contract_version() from public, anon, authenticated;
revoke all on function private.ensure_version_draft() from public, anon, authenticated;
revoke all on function private.validate_participation_total() from public, anon, authenticated;
revoke all on function private.prevent_used_contract_delete() from public, anon, authenticated;

create trigger contracts_validate_scope before insert or update of business_unit_id, product_id, service_line_id
on public.contracts for each row execute function private.validate_contract_scope();
create trigger contracts_prevent_used_delete before delete on public.contracts
for each row execute function private.prevent_used_contract_delete();
create trigger contracts_touch_updated_at before update on public.contracts
for each row execute function private.touch_updated_at();
create trigger contracts_audit after insert or update or delete on public.contracts
for each row execute function private.audit_row_change();

create trigger contract_parties_touch_updated_at before update on public.contract_parties
for each row execute function private.touch_updated_at();
create trigger contract_parties_audit after insert or update or delete on public.contract_parties
for each row execute function private.audit_row_change();

create trigger contract_versions_a_protect before update or delete on public.contract_versions
for each row execute function private.protect_contract_version();
create trigger contract_versions_touch_updated_at before update on public.contract_versions
for each row execute function private.touch_updated_at();
create trigger contract_versions_audit after insert or update or delete on public.contract_versions
for each row execute function private.audit_row_change();

create trigger contract_formula_components_a_draft before insert or update or delete on public.contract_formula_components
for each row execute function private.ensure_version_draft();
create trigger contract_formula_components_touch_updated_at before update on public.contract_formula_components
for each row execute function private.touch_updated_at();
create trigger contract_formula_components_audit after insert or update or delete on public.contract_formula_components
for each row execute function private.audit_row_change();

create trigger contract_version_participants_a_draft before insert or update or delete on public.contract_version_participants
for each row execute function private.ensure_version_draft();
create trigger contract_version_participants_touch_updated_at before update on public.contract_version_participants
for each row execute function private.touch_updated_at();
create trigger contract_version_participants_total after insert or update or delete on public.contract_version_participants
for each row execute function private.validate_participation_total();
create trigger contract_version_participants_audit after insert or update or delete on public.contract_version_participants
for each row execute function private.audit_row_change();

create trigger contract_obligations_a_draft before insert or update or delete on public.contract_obligations
for each row execute function private.ensure_version_draft();
create trigger contract_obligations_touch_updated_at before update on public.contract_obligations
for each row execute function private.touch_updated_at();
create trigger contract_obligations_audit after insert or update or delete on public.contract_obligations
for each row execute function private.audit_row_change();

create trigger contract_documents_a_draft before insert or update or delete on public.contract_documents
for each row execute function private.ensure_version_draft();
create trigger contract_documents_touch_updated_at before update on public.contract_documents
for each row execute function private.touch_updated_at();
create trigger contract_documents_audit after insert or update or delete on public.contract_documents
for each row execute function private.audit_row_change();

create trigger contract_approvals_audit after insert or update or delete on public.contract_approvals
for each row execute function private.audit_row_change();

alter table public.contracts enable row level security;
alter table public.contract_parties enable row level security;
alter table public.contract_versions enable row level security;
alter table public.contract_formula_components enable row level security;
alter table public.contract_version_participants enable row level security;
alter table public.contract_obligations enable row level security;
alter table public.contract_documents enable row level security;
alter table public.contract_approvals enable row level security;

create policy contracts_select on public.contracts for select to authenticated
using (private.current_user_has_permission('contracts.read', private.unit_code_for_id(business_unit_id)));
create policy contracts_insert on public.contracts for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('contracts.create', private.unit_code_for_id(business_unit_id)) and status = 'draft');
create policy contracts_update_draft on public.contracts for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('contracts.update_draft', private.unit_code_for_id(business_unit_id)) and status in ('draft','in_review','pending_signature'))
with check (private.current_user_has_aal2() and private.current_user_has_permission('contracts.update_draft', private.unit_code_for_id(business_unit_id)) and status in ('draft','in_review','pending_signature'));
create policy contracts_delete_draft on public.contracts for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('contracts.update_draft', private.unit_code_for_id(business_unit_id)) and status = 'draft');

create policy contract_parties_select on public.contract_parties for select to authenticated
using (private.current_user_has_permission('contracts.read', private.contract_unit_code(contract_id)));
create policy contract_parties_insert on public.contract_parties for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('contracts.update_draft', private.contract_unit_code(contract_id)));
create policy contract_parties_update on public.contract_parties for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('contracts.update_draft', private.contract_unit_code(contract_id)))
with check (private.current_user_has_aal2() and private.current_user_has_permission('contracts.update_draft', private.contract_unit_code(contract_id)));
create policy contract_parties_delete on public.contract_parties for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('contracts.update_draft', private.contract_unit_code(contract_id)));

create policy contract_versions_select on public.contract_versions for select to authenticated
using (private.current_user_has_permission('contracts.read', private.contract_unit_code(contract_id)));
create policy contract_versions_insert on public.contract_versions for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('contracts.update_draft', private.contract_unit_code(contract_id)) and status = 'draft');
create policy contract_versions_update_draft on public.contract_versions for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('contracts.update_draft', private.contract_unit_code(contract_id)) and status in ('draft','in_review','rejected'))
with check (private.current_user_has_aal2() and private.current_user_has_permission('contracts.update_draft', private.contract_unit_code(contract_id)) and status in ('draft','in_review','rejected'));
create policy contract_versions_delete_draft on public.contract_versions for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('contracts.update_draft', private.contract_unit_code(contract_id)) and status in ('draft','rejected'));

create policy contract_formula_components_select on public.contract_formula_components for select to authenticated
using (private.current_user_has_permission('contracts.read', private.contract_version_unit_code(contract_version_id)));
create policy contract_formula_components_manage on public.contract_formula_components for all to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('contracts.update_draft', private.contract_version_unit_code(contract_version_id)))
with check (private.current_user_has_aal2() and private.current_user_has_permission('contracts.update_draft', private.contract_version_unit_code(contract_version_id)));

create policy contract_version_participants_select on public.contract_version_participants for select to authenticated
using (private.current_user_has_permission('contracts.read', private.contract_version_unit_code(contract_version_id)));
create policy contract_version_participants_manage on public.contract_version_participants for all to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('contracts.update_draft', private.contract_version_unit_code(contract_version_id)))
with check (private.current_user_has_aal2() and private.current_user_has_permission('contracts.update_draft', private.contract_version_unit_code(contract_version_id)));

create policy contract_obligations_select on public.contract_obligations for select to authenticated
using (private.current_user_has_permission('contracts.read', private.contract_version_unit_code(contract_version_id)));
create policy contract_obligations_manage on public.contract_obligations for all to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('contracts.update_draft', private.contract_version_unit_code(contract_version_id)))
with check (private.current_user_has_aal2() and private.current_user_has_permission('contracts.update_draft', private.contract_version_unit_code(contract_version_id)));

create policy contract_documents_select on public.contract_documents for select to authenticated
using (private.current_user_has_permission('contracts.read', private.contract_version_unit_code(contract_version_id)));
create policy contract_documents_manage on public.contract_documents for all to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('contracts.documents.manage', private.contract_version_unit_code(contract_version_id)))
with check (private.current_user_has_aal2() and private.current_user_has_permission('contracts.documents.manage', private.contract_version_unit_code(contract_version_id)));

create policy contract_approvals_select on public.contract_approvals for select to authenticated
using (private.current_user_has_permission('contracts.read', private.contract_version_unit_code(contract_version_id)));

revoke all on public.contracts, public.contract_parties, public.contract_versions,
  public.contract_formula_components, public.contract_version_participants,
  public.contract_obligations, public.contract_documents, public.contract_approvals from anon;
grant select, insert, update, delete on public.contracts, public.contract_parties, public.contract_versions,
  public.contract_formula_components, public.contract_version_participants,
  public.contract_obligations, public.contract_documents to authenticated;
grant select on public.contract_approvals to authenticated;
grant all on public.contracts, public.contract_parties, public.contract_versions,
  public.contract_formula_components, public.contract_version_participants,
  public.contract_obligations, public.contract_documents, public.contract_approvals to service_role;

create or replace function public.approve_contract_version(p_version_id uuid, p_expected_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.contract_versions;
  v_contract public.contracts;
  v_unit_code text;
  v_total numeric;
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not private.current_user_has_aal2() then
    raise exception 'Aprovação exige sessão autenticada com MFA aal2.';
  end if;

  select * into v_row from public.contract_versions where id = p_version_id for update;
  if not found or v_row.version <> p_expected_version then
    raise exception 'Versão não encontrada ou alterada por outro usuário.';
  end if;
  select * into v_contract from public.contracts where id = v_row.contract_id for update;
  v_unit_code := private.unit_code_for_id(v_contract.business_unit_id);
  if not private.current_user_has_permission('contracts.approve', v_unit_code) then
    raise exception 'Permissão de aprovação insuficiente.';
  end if;
  if v_row.status not in ('draft','in_review') then
    raise exception 'Somente versão em rascunho ou revisão pode ser aprovada.';
  end if;
  if v_row.requested_by is not null and v_row.requested_by = v_actor then
    raise exception 'O solicitante não pode aprovar a própria versão.';
  end if;
  if not exists (select 1 from public.contract_documents where contract_version_id = v_row.id and document_type = 'main_contract' and status in ('uploaded','verified')) then
    raise exception 'A aprovação exige documento principal vinculado.';
  end if;
  select coalesce(sum(percentage),0) into v_total
  from public.contract_version_participants
  where contract_version_id = v_row.id and status = 'active';
  if not v_row.allows_distinct_bases and v_total > 100 then
    raise exception 'Participações ativas excedem 100%%.';
  end if;

  update public.contract_versions
  set status = 'superseded'
  where contract_id = v_row.contract_id and status = 'approved' and id <> v_row.id;

  update public.contract_versions
  set status = 'approved', approved_by = v_actor, approved_at = now()
  where id = v_row.id and version = p_expected_version
  returning * into v_row;

  insert into public.contract_approvals(contract_version_id, requested_by, approver_user_id, decision, decided_at)
  values (v_row.id, coalesce(v_row.requested_by, v_actor), v_actor, 'approved', now());

  return to_jsonb(v_row);
end;
$$;

create or replace function public.activate_contract(p_contract_id uuid, p_expected_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.contracts;
  v_unit_code text;
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not private.current_user_has_aal2() then
    raise exception 'Ativação exige sessão autenticada com MFA aal2.';
  end if;
  select * into v_row from public.contracts where id = p_contract_id for update;
  if not found or v_row.version <> p_expected_version then
    raise exception 'Contrato não encontrado ou alterado por outro usuário.';
  end if;
  v_unit_code := private.unit_code_for_id(v_row.business_unit_id);
  if not private.current_user_has_permission('contracts.approve', v_unit_code) then
    raise exception 'Permissão de ativação insuficiente.';
  end if;
  if not exists (select 1 from public.contract_versions where contract_id = v_row.id and status = 'approved') then
    raise exception 'Contrato exige uma versão aprovada.';
  end if;
  if not exists (select 1 from public.contract_parties where contract_id = v_row.id and status = 'active' and is_primary) then
    raise exception 'Contrato exige uma contraparte principal ativa.';
  end if;
  update public.contracts
  set status = 'active'
  where id = v_row.id and version = p_expected_version
  returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.terminate_contract(p_contract_id uuid, p_expected_version integer, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.contracts;
  v_unit_code text;
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not private.current_user_has_aal2() then
    raise exception 'Encerramento exige sessão autenticada com MFA aal2.';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 5 then
    raise exception 'Motivo de encerramento obrigatório.';
  end if;
  select * into v_row from public.contracts where id = p_contract_id for update;
  if not found or v_row.version <> p_expected_version then
    raise exception 'Contrato não encontrado ou alterado por outro usuário.';
  end if;
  v_unit_code := private.unit_code_for_id(v_row.business_unit_id);
  if not private.current_user_has_permission('contracts.terminate', v_unit_code) then
    raise exception 'Permissão de encerramento insuficiente.';
  end if;
  if v_row.status not in ('active','renewal','pending_signature') then
    raise exception 'Situação atual não permite encerramento.';
  end if;
  update public.contracts
  set status = case when v_row.status = 'pending_signature' then 'cancelled' else 'terminated' end,
      ends_on = coalesce(ends_on, current_date),
      notes = concat_ws(E'\n', notes, 'Encerramento: ' || btrim(p_reason))
  where id = v_row.id and version = p_expected_version
  returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.approve_contract_version(uuid, integer) from public, anon;
revoke all on function public.activate_contract(uuid, integer) from public, anon;
revoke all on function public.terminate_contract(uuid, integer, text) from public, anon;
grant execute on function public.approve_contract_version(uuid, integer) to authenticated;
grant execute on function public.activate_contract(uuid, integer) to authenticated;
grant execute on function public.terminate_contract(uuid, integer, text) to authenticated;
