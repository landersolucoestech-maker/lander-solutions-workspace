insert into public.permissions (code, module, action, description)
values
  ('finance.read', 'finance', 'read', 'Consultar documentos financeiros, liquidações e contas de caixa.'),
  ('finance.documents.create', 'finance', 'documents_create', 'Criar contas a pagar e contas a receber em rascunho.'),
  ('finance.documents.manage_draft', 'finance', 'documents_manage_draft', 'Alterar documentos financeiros não consolidados.'),
  ('finance.documents.approve', 'finance', 'documents_approve', 'Aprovar e reconhecer documentos financeiros.'),
  ('finance.settlements.create', 'finance', 'settlements_create', 'Registrar pagamentos e recebimentos em rascunho.'),
  ('finance.settlements.post', 'finance', 'settlements_post', 'Postar pagamentos e recebimentos no ledger.'),
  ('finance.cash.manage', 'finance', 'cash_manage', 'Administrar contas financeiras e de compensação.'),
  ('ledger.read', 'ledger', 'read', 'Consultar lançamentos e linhas do ledger gerencial.'),
  ('ledger.create', 'ledger', 'create', 'Criar lançamentos gerenciais manuais em rascunho.'),
  ('ledger.post', 'ledger', 'post', 'Validar e postar lançamentos balanceados.'),
  ('ledger.reverse', 'ledger', 'reverse', 'Reverter lançamentos postados com contrapartida integral.')
on conflict (code) do update
set module = excluded.module,
    action = excluded.action,
    description = excluded.description;

with grants(role_code, permission_code) as (
  values
    ('owner','finance.read'),('owner','finance.documents.create'),('owner','finance.documents.manage_draft'),
    ('owner','finance.documents.approve'),('owner','finance.settlements.create'),('owner','finance.settlements.post'),
    ('owner','finance.cash.manage'),('owner','ledger.read'),('owner','ledger.create'),('owner','ledger.post'),('owner','ledger.reverse'),
    ('corporate_admin','finance.read'),('corporate_admin','finance.documents.create'),('corporate_admin','finance.documents.manage_draft'),
    ('corporate_admin','finance.documents.approve'),('corporate_admin','finance.settlements.create'),('corporate_admin','finance.settlements.post'),
    ('corporate_admin','finance.cash.manage'),('corporate_admin','ledger.read'),('corporate_admin','ledger.create'),
    ('corporate_admin','ledger.post'),('corporate_admin','ledger.reverse'),
    ('finance_manager','finance.read'),('finance_manager','finance.documents.create'),('finance_manager','finance.documents.manage_draft'),
    ('finance_manager','finance.documents.approve'),('finance_manager','finance.settlements.create'),('finance_manager','finance.settlements.post'),
    ('finance_manager','finance.cash.manage'),('finance_manager','ledger.read'),('finance_manager','ledger.create'),
    ('finance_manager','ledger.post'),('finance_manager','ledger.reverse'),
    ('accounts_payable','finance.read'),('accounts_payable','finance.documents.create'),
    ('accounts_payable','finance.documents.manage_draft'),('accounts_payable','finance.settlements.create'),('accounts_payable','ledger.read'),
    ('accounts_receivable','finance.read'),('accounts_receivable','finance.documents.create'),
    ('accounts_receivable','finance.documents.manage_draft'),('accounts_receivable','finance.settlements.create'),('accounts_receivable','ledger.read'),
    ('unit_manager','finance.read'),('unit_manager','finance.documents.create'),('unit_manager','finance.documents.manage_draft'),('unit_manager','ledger.read'),
    ('participation_manager','finance.read'),('participation_manager','ledger.read'),
    ('legal','finance.read'),('legal','ledger.read'),
    ('compliance','finance.read'),('compliance','ledger.read'),
    ('auditor','finance.read'),('auditor','ledger.read'),
    ('executive_readonly','finance.read'),('executive_readonly','ledger.read'),
    ('readonly','finance.read'),('readonly','ledger.read')
)
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from grants g
join public.app_roles r on r.code = g.role_code
join public.permissions p on p.code = g.permission_code
on conflict do nothing;

create table public.managerial_accounts (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.managerial_accounts(id) on delete restrict,
  code text not null unique check (code ~ '^[0-9]{3,12}$'),
  name text not null check (char_length(btrim(name)) between 2 and 160),
  account_type text not null check (account_type in ('asset','liability','equity','revenue','deduction','expense','investment','reserve')),
  normal_balance text not null check (normal_balance in ('debit','credit')),
  posting_allowed boolean not null default true,
  status text not null default 'active' check (status in ('active','inactive')),
  is_system boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cash_accounts (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  managerial_account_id uuid not null references public.managerial_accounts(id) on delete restrict,
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_-]{2,39}$'),
  name text not null check (char_length(btrim(name)) between 2 and 160),
  account_type text not null check (account_type in ('bank','wallet','payment_processor','clearing','cash')),
  currency_code text not null references public.currencies(code),
  institution_name text,
  masked_identifier text,
  external_vault_reference text,
  status text not null default 'active' check (status in ('active','inactive','closed')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (external_vault_reference is null or external_vault_reference ~ '^[A-Za-z0-9/_:.-]+$')
);

create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency_code text not null references public.currencies(code),
  quote_currency_code text not null references public.currencies(code),
  rate_date date not null,
  rate numeric(24,10) not null check (rate > 0),
  source text not null check (char_length(btrim(source)) between 2 and 120),
  source_reference text,
  status text not null default 'active' check (status in ('active','superseded','inactive')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (base_currency_code, quote_currency_code, rate_date, source),
  check (base_currency_code <> quote_currency_code)
);

create table public.financial_documents (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  business_unit_id uuid not null references public.business_units(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  service_line_id uuid references public.service_lines(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  contract_id uuid references public.contracts(id) on delete restrict,
  party_id uuid not null references public.parties(id) on delete restrict,
  cost_center_id uuid references public.cost_centers(id) on delete restrict,
  revenue_center_id uuid references public.revenue_centers(id) on delete restrict,
  category_id uuid references public.financial_categories(id) on delete restrict,
  document_nature text not null check (document_nature in ('payable','receivable')),
  source_type text not null check (source_type in ('bill','invoice','fiscal_document','refund','chargeback','investment','reimbursement','other')),
  document_number text not null check (char_length(btrim(document_number)) between 2 and 120),
  description text not null check (char_length(btrim(description)) between 3 and 1000),
  issue_date date not null,
  competence_date date not null,
  due_date date not null,
  original_currency_code text not null references public.currencies(code),
  original_amount numeric(20,6) not null check (original_amount > 0),
  fx_rate numeric(24,10) not null default 1 check (fx_rate > 0),
  fx_date date not null,
  fx_source text not null default 'functional_currency' check (char_length(btrim(fx_source)) between 2 and 120),
  functional_currency_code text not null default 'BRL' references public.currencies(code),
  functional_amount numeric(20,6) generated always as (round(original_amount * fx_rate, 6)) stored,
  tax_amount_functional numeric(20,6) not null default 0 check (tax_amount_functional >= 0),
  fee_amount_functional numeric(20,6) not null default 0 check (fee_amount_functional >= 0),
  classification_status text not null default 'classified' check (classification_status in ('classified','pending_classification')),
  classification_due_at timestamptz,
  classification_responsible_user_id uuid references auth.users(id) on delete set null,
  counterparty_account_id uuid not null references public.managerial_accounts(id) on delete restrict,
  status text not null default 'draft' check (status in (
    'draft','pending_approval','approved','issued','partially_settled','settled','overdue','in_dispute','cancelled','reversed'
  )),
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  journal_entry_id uuid,
  external_reference text,
  notes text check (notes is null or char_length(notes) <= 4000),
  version integer not null default 1 check (version > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (legal_entity_id, document_nature, document_number),
  check (due_date >= issue_date),
  check (product_id is null or service_line_id is null),
  check ((classification_status = 'classified') or (classification_due_at is not null and classification_responsible_user_id is not null)),
  check ((original_currency_code = functional_currency_code and fx_rate = 1) or original_currency_code <> functional_currency_code)
);

create table public.financial_document_lines (
  id uuid primary key default gen_random_uuid(),
  financial_document_id uuid not null references public.financial_documents(id) on delete restrict,
  sequence_no integer not null check (sequence_no between 1 and 10000),
  managerial_account_id uuid not null references public.managerial_accounts(id) on delete restrict,
  category_id uuid references public.financial_categories(id) on delete restrict,
  cost_center_id uuid references public.cost_centers(id) on delete restrict,
  revenue_center_id uuid references public.revenue_centers(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  service_line_id uuid references public.service_lines(id) on delete restrict,
  description text not null check (char_length(btrim(description)) between 2 and 1000),
  original_amount numeric(20,6) not null check (original_amount > 0),
  functional_amount numeric(20,6) not null check (functional_amount > 0),
  tax_amount_functional numeric(20,6) not null default 0 check (tax_amount_functional >= 0),
  allocation_status text not null default 'direct' check (allocation_status in ('direct','pending_allocation','allocated')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (financial_document_id, sequence_no),
  check (product_id is null or service_line_id is null)
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  financial_period_id uuid not null references public.financial_periods(id) on delete restrict,
  entry_number bigint generated always as identity,
  source_type text not null check (source_type in ('manual','financial_document','settlement','allocation','participation','reversal','opening','closing','integration')),
  source_id uuid,
  competence_date date not null,
  posting_date date,
  description text not null check (char_length(btrim(description)) between 3 and 1000),
  status text not null default 'draft' check (status in ('draft','validated','posted','reversed')),
  reversal_of_entry_id uuid references public.journal_entries(id) on delete restrict,
  reversed_by_entry_id uuid references public.journal_entries(id) on delete restrict,
  total_debit numeric(20,6) not null default 0 check (total_debit >= 0),
  total_credit numeric(20,6) not null default 0 check (total_credit >= 0),
  created_by uuid references auth.users(id) on delete set null,
  validated_by uuid references auth.users(id) on delete set null,
  posted_by uuid references auth.users(id) on delete set null,
  posted_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status in ('posted','reversed')) = (posted_at is not null and posting_date is not null)),
  check (reversal_of_entry_id is null or source_type = 'reversal')
);

alter table public.financial_documents
  add constraint financial_documents_journal_entry_fkey
  foreign key (journal_entry_id) references public.journal_entries(id) on delete restrict;

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries(id) on delete restrict,
  line_no integer not null check (line_no between 1 and 10000),
  managerial_account_id uuid not null references public.managerial_accounts(id) on delete restrict,
  business_unit_id uuid not null references public.business_units(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  service_line_id uuid references public.service_lines(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  contract_id uuid references public.contracts(id) on delete restrict,
  party_id uuid references public.parties(id) on delete restrict,
  cost_center_id uuid references public.cost_centers(id) on delete restrict,
  revenue_center_id uuid references public.revenue_centers(id) on delete restrict,
  category_id uuid references public.financial_categories(id) on delete restrict,
  debit_amount numeric(20,6) not null default 0 check (debit_amount >= 0),
  credit_amount numeric(20,6) not null default 0 check (credit_amount >= 0),
  original_currency_code text references public.currencies(code),
  original_amount numeric(20,6),
  fx_rate numeric(24,10),
  description text,
  created_at timestamptz not null default now(),
  unique (journal_entry_id, line_no),
  check ((debit_amount > 0 and credit_amount = 0) or (credit_amount > 0 and debit_amount = 0)),
  check (product_id is null or service_line_id is null),
  check ((original_currency_code is null and original_amount is null and fx_rate is null) or
         (original_currency_code is not null and original_amount is not null and fx_rate is not null and original_amount > 0 and fx_rate > 0))
);

create table public.financial_settlements (
  id uuid primary key default gen_random_uuid(),
  financial_document_id uuid not null references public.financial_documents(id) on delete restrict,
  cash_account_id uuid not null references public.cash_accounts(id) on delete restrict,
  settlement_date date not null,
  original_currency_code text not null references public.currencies(code),
  original_amount numeric(20,6) not null check (original_amount > 0),
  fx_rate numeric(24,10) not null default 1 check (fx_rate > 0),
  functional_amount numeric(20,6) generated always as (round(original_amount * fx_rate, 6)) stored,
  bank_fee_functional numeric(20,6) not null default 0 check (bank_fee_functional >= 0),
  fee_account_id uuid references public.managerial_accounts(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','pending_approval','posted','reversed','cancelled')),
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz,
  posted_by uuid references auth.users(id) on delete set null,
  posted_at timestamptz,
  journal_entry_id uuid references public.journal_entries(id) on delete restrict,
  external_reference text,
  notes text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((bank_fee_functional = 0 and fee_account_id is null) or (bank_fee_functional > 0 and fee_account_id is not null))
);

create table public.financial_approvals (
  id uuid primary key default gen_random_uuid(),
  object_type text not null check (object_type in ('document','settlement','journal_entry')),
  object_id uuid not null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  approver_user_id uuid references auth.users(id) on delete restrict,
  decision text not null default 'pending' check (decision in ('pending','approved','rejected','cancelled')),
  decision_reason text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check ((decision = 'pending' and decided_at is null) or (decision <> 'pending' and decided_at is not null)),
  check (approver_user_id is null or approver_user_id <> requested_by)
);

create index managerial_accounts_parent_idx on public.managerial_accounts(parent_id);
create index cash_accounts_entity_idx on public.cash_accounts(legal_entity_id);
create index cash_accounts_managerial_idx on public.cash_accounts(managerial_account_id);
create index cash_accounts_currency_idx on public.cash_accounts(currency_code);
create index exchange_rates_pair_date_idx on public.exchange_rates(base_currency_code, quote_currency_code, rate_date);
create index financial_documents_entity_idx on public.financial_documents(legal_entity_id);
create index financial_documents_unit_idx on public.financial_documents(business_unit_id);
create index financial_documents_product_idx on public.financial_documents(product_id);
create index financial_documents_service_idx on public.financial_documents(service_line_id);
create index financial_documents_project_idx on public.financial_documents(project_id);
create index financial_documents_contract_idx on public.financial_documents(contract_id);
create index financial_documents_party_idx on public.financial_documents(party_id);
create index financial_documents_cost_center_idx on public.financial_documents(cost_center_id);
create index financial_documents_revenue_center_idx on public.financial_documents(revenue_center_id);
create index financial_documents_category_idx on public.financial_documents(category_id);
create index financial_documents_counterparty_account_idx on public.financial_documents(counterparty_account_id);
create index financial_documents_status_due_idx on public.financial_documents(status, due_date);
create index financial_documents_created_by_idx on public.financial_documents(created_by);
create index financial_documents_submitted_by_idx on public.financial_documents(submitted_by);
create index financial_documents_approved_by_idx on public.financial_documents(approved_by);
create index financial_documents_classification_responsible_idx on public.financial_documents(classification_responsible_user_id);
create index financial_document_lines_document_idx on public.financial_document_lines(financial_document_id);
create index financial_document_lines_account_idx on public.financial_document_lines(managerial_account_id);
create index financial_document_lines_category_idx on public.financial_document_lines(category_id);
create index financial_document_lines_cost_center_idx on public.financial_document_lines(cost_center_id);
create index financial_document_lines_revenue_center_idx on public.financial_document_lines(revenue_center_id);
create index financial_document_lines_project_idx on public.financial_document_lines(project_id);
create index financial_document_lines_product_idx on public.financial_document_lines(product_id);
create index financial_document_lines_service_idx on public.financial_document_lines(service_line_id);
create index journal_entries_entity_idx on public.journal_entries(legal_entity_id);
create index journal_entries_period_idx on public.journal_entries(financial_period_id);
create index journal_entries_source_idx on public.journal_entries(source_type, source_id);
create index journal_entries_status_date_idx on public.journal_entries(status, competence_date);
create index journal_entries_reversal_of_idx on public.journal_entries(reversal_of_entry_id);
create index journal_entries_reversed_by_idx on public.journal_entries(reversed_by_entry_id);
create index journal_entries_created_by_idx on public.journal_entries(created_by);
create index journal_entries_validated_by_idx on public.journal_entries(validated_by);
create index journal_entries_posted_by_idx on public.journal_entries(posted_by);
create index journal_lines_entry_idx on public.journal_lines(journal_entry_id);
create index journal_lines_account_idx on public.journal_lines(managerial_account_id);
create index journal_lines_unit_idx on public.journal_lines(business_unit_id);
create index journal_lines_product_idx on public.journal_lines(product_id);
create index journal_lines_service_idx on public.journal_lines(service_line_id);
create index journal_lines_project_idx on public.journal_lines(project_id);
create index journal_lines_contract_idx on public.journal_lines(contract_id);
create index journal_lines_party_idx on public.journal_lines(party_id);
create index journal_lines_cost_center_idx on public.journal_lines(cost_center_id);
create index journal_lines_revenue_center_idx on public.journal_lines(revenue_center_id);
create index journal_lines_category_idx on public.journal_lines(category_id);
create index financial_settlements_document_idx on public.financial_settlements(financial_document_id);
create index financial_settlements_cash_idx on public.financial_settlements(cash_account_id);
create index financial_settlements_fee_account_idx on public.financial_settlements(fee_account_id);
create index financial_settlements_journal_idx on public.financial_settlements(journal_entry_id);
create index financial_settlements_requested_by_idx on public.financial_settlements(requested_by);
create index financial_settlements_posted_by_idx on public.financial_settlements(posted_by);
create index financial_approvals_object_idx on public.financial_approvals(object_type, object_id);
create index financial_approvals_requester_idx on public.financial_approvals(requested_by);
create index financial_approvals_approver_idx on public.financial_approvals(approver_user_id);

insert into public.managerial_accounts(code,name,account_type,normal_balance,posting_allowed,status,is_system)
values
 ('1000','Ativos','asset','debit',false,'active',true),
 ('1100','Caixa e equivalentes','asset','debit',true,'active',true),
 ('1200','Contas a receber','asset','debit',true,'active',true),
 ('1300','Adiantamentos e valores recuperáveis','asset','debit',true,'active',true),
 ('2000','Passivos','liability','credit',false,'active',true),
 ('2100','Contas a pagar','liability','credit',true,'active',true),
 ('2200','Valores devidos a participantes','liability','credit',true,'active',true),
 ('2300','Impostos e obrigações','liability','credit',true,'active',true),
 ('3000','Patrimônio e resultado gerencial','equity','credit',true,'active',true),
 ('4000','Receita bruta','revenue','credit',true,'active',true),
 ('4200','Deduções da receita','deduction','debit',true,'active',true),
 ('5000','Custos diretos','expense','debit',true,'active',true),
 ('6000','Despesas exclusivas','expense','debit',true,'active',true),
 ('6100','Despesas compartilhadas','expense','debit',true,'active',true),
 ('7000','Impostos sobre receita','expense','debit',true,'active',true),
 ('7100','Taxas de pagamento e bancárias','expense','debit',true,'active',true),
 ('8000','Investimentos gerenciais','investment','debit',true,'active',true),
 ('8100','Reservas e contingências','reserve','debit',true,'active',true),
 ('9000','Prejuízos e compensações gerenciais','equity','debit',true,'active',true)
on conflict (code) do nothing;

create or replace function private.financial_document_unit_code(p_document_id uuid)
returns text language sql stable security definer set search_path=''
as $$ select private.unit_code_for_id(d.business_unit_id) from public.financial_documents d where d.id=p_document_id $$;

create or replace function private.journal_entry_unit_access(p_entry_id uuid, p_permission text)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists (
    select 1 from public.journal_lines l
    where l.journal_entry_id=p_entry_id
      and private.current_user_has_permission(p_permission, private.unit_code_for_id(l.business_unit_id))
  )
$$;

create or replace function private.validate_financial_document_scope()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_unit uuid;
  v_entity uuid;
  v_contract_unit uuid;
begin
  select legal_entity_id into v_entity from public.business_units where id=new.business_unit_id;
  if v_entity is distinct from new.legal_entity_id then raise exception 'A unidade não pertence à pessoa jurídica informada.'; end if;
  if new.product_id is not null then
    select business_unit_id into v_unit from public.products where id=new.product_id;
    if v_unit is distinct from new.business_unit_id then raise exception 'O produto não pertence à unidade do documento.'; end if;
  end if;
  if new.service_line_id is not null then
    select business_unit_id into v_unit from public.service_lines where id=new.service_line_id;
    if v_unit is distinct from new.business_unit_id then raise exception 'O serviço não pertence à unidade do documento.'; end if;
  end if;
  if new.project_id is not null then
    select business_unit_id into v_unit from public.projects where id=new.project_id;
    if v_unit is distinct from new.business_unit_id then raise exception 'O projeto não pertence à unidade do documento.'; end if;
  end if;
  if new.contract_id is not null then
    select business_unit_id into v_contract_unit from public.contracts where id=new.contract_id;
    if v_contract_unit is distinct from new.business_unit_id then raise exception 'O contrato não pertence à unidade do documento.'; end if;
  end if;
  if new.document_nature='payable' and new.revenue_center_id is not null then raise exception 'Conta a pagar não utiliza centro de receita no cabeçalho.'; end if;
  if new.document_nature='receivable' and new.cost_center_id is not null then raise exception 'Conta a receber não utiliza centro de custo no cabeçalho.'; end if;
  return new;
end;
$$;

create or replace function private.protect_consolidated_financial_document()
returns trigger language plpgsql set search_path=''
as $$
begin
  if tg_op='DELETE' then
    if old.status <> 'draft' or old.journal_entry_id is not null then
      raise exception 'Somente documento em rascunho e não postado pode ser excluído.';
    end if;
    return old;
  end if;
  if old.journal_entry_id is not null or old.status in ('approved','issued','partially_settled','settled','reversed') then
    if (to_jsonb(new) - array['status','updated_at','version']::text[])
       <> (to_jsonb(old) - array['status','updated_at','version']::text[]) then
      raise exception 'Documento consolidado é imutável; utilize estorno ou liquidação.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.ensure_document_draft()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_id uuid; v_status text; v_entry uuid;
begin
  v_id := case when tg_op='DELETE' then old.financial_document_id else new.financial_document_id end;
  select status,journal_entry_id into v_status,v_entry from public.financial_documents where id=v_id;
  if v_status not in ('draft','pending_approval') or v_entry is not null then
    raise exception 'Linhas de documento consolidado são imutáveis.';
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;

create or replace function private.validate_document_line_total()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_id uuid; v_doc numeric; v_lines numeric;
begin
  v_id := case when tg_op='DELETE' then old.financial_document_id else new.financial_document_id end;
  select functional_amount into v_doc from public.financial_documents where id=v_id;
  select coalesce(sum(functional_amount),0) into v_lines from public.financial_document_lines where financial_document_id=v_id;
  if v_lines > v_doc then raise exception 'A soma das linhas não pode exceder o valor funcional do documento.'; end if;
  return null;
end;
$$;

create or replace function private.refresh_journal_totals()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
  v_id := case when tg_op='DELETE' then old.journal_entry_id else new.journal_entry_id end;
  update public.journal_entries e
  set total_debit=x.debits,total_credit=x.credits
  from (
    select coalesce(sum(debit_amount),0) debits,coalesce(sum(credit_amount),0) credits
    from public.journal_lines where journal_entry_id=v_id
  ) x
  where e.id=v_id and e.status in ('draft','validated');
  return null;
end;
$$;

create or replace function private.protect_posted_journal_entry()
returns trigger language plpgsql set search_path=''
as $$
begin
  if tg_op='DELETE' then
    if old.status not in ('draft','validated') then raise exception 'Lançamento postado não pode ser excluído.'; end if;
    return old;
  end if;
  if old.status in ('posted','reversed') then
    if (to_jsonb(new) - array['status','reversed_by_entry_id','updated_at','version']::text[])
       <> (to_jsonb(old) - array['status','reversed_by_entry_id','updated_at','version']::text[]) then
      raise exception 'Lançamento postado é imutável.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.ensure_entry_editable()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_id uuid; v_status text;
begin
  v_id := case when tg_op='DELETE' then old.journal_entry_id else new.journal_entry_id end;
  select status into v_status from public.journal_entries where id=v_id;
  if v_status not in ('draft','validated') then raise exception 'Linhas de lançamento postado são imutáveis.'; end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;

create or replace function private.prevent_settlement_overflow()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_document_amount numeric; v_posted numeric; v_new numeric;
begin
  select functional_amount into v_document_amount from public.financial_documents where id=new.financial_document_id;
  select coalesce(sum(functional_amount),0) into v_posted
  from public.financial_settlements
  where financial_document_id=new.financial_document_id and status='posted' and id<>new.id;
  v_new := case when new.status='posted' then new.functional_amount else 0 end;
  if v_posted+v_new > v_document_amount then raise exception 'Liquidações postadas excedem o valor do documento.'; end if;
  return new;
end;
$$;

create or replace function private.protect_posted_settlement()
returns trigger language plpgsql set search_path=''
as $$
begin
  if tg_op='DELETE' then
    if old.status <> 'draft' then raise exception 'Somente liquidação em rascunho pode ser excluída.'; end if;
    return old;
  end if;
  if old.status in ('posted','reversed') then
    if (to_jsonb(new) - array['status','updated_at','version']::text[])
       <> (to_jsonb(old) - array['status','updated_at','version']::text[]) then
      raise exception 'Liquidação postada é imutável.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.financial_document_unit_code(uuid) from public,anon;
revoke all on function private.journal_entry_unit_access(uuid,text) from public,anon;
grant execute on function private.financial_document_unit_code(uuid) to authenticated,service_role;
grant execute on function private.journal_entry_unit_access(uuid,text) to authenticated,service_role;
revoke all on function private.validate_financial_document_scope() from public,anon,authenticated;
revoke all on function private.protect_consolidated_financial_document() from public,anon,authenticated;
revoke all on function private.ensure_document_draft() from public,anon,authenticated;
revoke all on function private.validate_document_line_total() from public,anon,authenticated;
revoke all on function private.refresh_journal_totals() from public,anon,authenticated;
revoke all on function private.protect_posted_journal_entry() from public,anon,authenticated;
revoke all on function private.ensure_entry_editable() from public,anon,authenticated;
revoke all on function private.prevent_settlement_overflow() from public,anon,authenticated;
revoke all on function private.protect_posted_settlement() from public,anon,authenticated;

create trigger managerial_accounts_touch before update on public.managerial_accounts for each row execute function private.touch_updated_at();
create trigger managerial_accounts_audit after insert or update or delete on public.managerial_accounts for each row execute function private.audit_row_change();
create trigger cash_accounts_touch before update on public.cash_accounts for each row execute function private.touch_updated_at();
create trigger cash_accounts_audit after insert or update or delete on public.cash_accounts for each row execute function private.audit_row_change();
create trigger exchange_rates_touch before update on public.exchange_rates for each row execute function private.touch_updated_at();
create trigger exchange_rates_audit after insert or update or delete on public.exchange_rates for each row execute function private.audit_row_change();
create trigger financial_documents_a_scope before insert or update on public.financial_documents for each row execute function private.validate_financial_document_scope();
create trigger financial_documents_b_protect before update or delete on public.financial_documents for each row execute function private.protect_consolidated_financial_document();
create trigger financial_documents_touch before update on public.financial_documents for each row execute function private.touch_updated_at();
create trigger financial_documents_audit after insert or update or delete on public.financial_documents for each row execute function private.audit_row_change();
create trigger financial_document_lines_a_draft before insert or update or delete on public.financial_document_lines for each row execute function private.ensure_document_draft();
create trigger financial_document_lines_touch before update on public.financial_document_lines for each row execute function private.touch_updated_at();
create trigger financial_document_lines_total after insert or update or delete on public.financial_document_lines for each row execute function private.validate_document_line_total();
create trigger financial_document_lines_audit after insert or update or delete on public.financial_document_lines for each row execute function private.audit_row_change();
create trigger journal_entries_a_protect before update or delete on public.journal_entries for each row execute function private.protect_posted_journal_entry();
create trigger journal_entries_touch before update on public.journal_entries for each row execute function private.touch_updated_at();
create trigger journal_entries_audit after insert or update or delete on public.journal_entries for each row execute function private.audit_row_change();
create trigger journal_lines_a_editable before insert or update or delete on public.journal_lines for each row execute function private.ensure_entry_editable();
create trigger journal_lines_totals after insert or update or delete on public.journal_lines for each row execute function private.refresh_journal_totals();
create trigger journal_lines_audit after insert or update or delete on public.journal_lines for each row execute function private.audit_row_change();
create trigger financial_settlements_a_overflow before insert or update on public.financial_settlements for each row execute function private.prevent_settlement_overflow();
create trigger financial_settlements_b_protect before update or delete on public.financial_settlements for each row execute function private.protect_posted_settlement();
create trigger financial_settlements_touch before update on public.financial_settlements for each row execute function private.touch_updated_at();
create trigger financial_settlements_audit after insert or update or delete on public.financial_settlements for each row execute function private.audit_row_change();
create trigger financial_approvals_audit after insert or update or delete on public.financial_approvals for each row execute function private.audit_row_change();

alter table public.managerial_accounts enable row level security;
alter table public.cash_accounts enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.financial_documents enable row level security;
alter table public.financial_document_lines enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;
alter table public.financial_settlements enable row level security;
alter table public.financial_approvals enable row level security;

create policy managerial_accounts_select on public.managerial_accounts for select to authenticated using (private.current_user_has_permission('ledger.read',null));
create policy managerial_accounts_manage on public.managerial_accounts for all to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('finance.cash.manage',null) and not is_system)
with check (private.current_user_has_aal2() and private.current_user_has_permission('finance.cash.manage',null) and not is_system);
create policy cash_accounts_select on public.cash_accounts for select to authenticated using (private.current_user_has_permission('finance.read',null));
create policy cash_accounts_manage on public.cash_accounts for all to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('finance.cash.manage',null))
with check (private.current_user_has_aal2() and private.current_user_has_permission('finance.cash.manage',null));
create policy exchange_rates_select on public.exchange_rates for select to authenticated using (private.current_user_has_permission('finance.read',null));
create policy exchange_rates_manage on public.exchange_rates for all to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('finance.cash.manage',null))
with check (private.current_user_has_aal2() and private.current_user_has_permission('finance.cash.manage',null));

create policy financial_documents_select on public.financial_documents for select to authenticated
using (private.current_user_has_permission('finance.read',private.unit_code_for_id(business_unit_id)));
create policy financial_documents_insert on public.financial_documents for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('finance.documents.create',private.unit_code_for_id(business_unit_id)) and status='draft');
create policy financial_documents_update on public.financial_documents for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('finance.documents.manage_draft',private.unit_code_for_id(business_unit_id)) and status in ('draft','pending_approval'))
with check (private.current_user_has_aal2() and private.current_user_has_permission('finance.documents.manage_draft',private.unit_code_for_id(business_unit_id)) and status in ('draft','pending_approval'));
create policy financial_documents_delete on public.financial_documents for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('finance.documents.manage_draft',private.unit_code_for_id(business_unit_id)) and status='draft' and journal_entry_id is null);

create policy financial_document_lines_select on public.financial_document_lines for select to authenticated
using (private.current_user_has_permission('finance.read',private.financial_document_unit_code(financial_document_id)));
create policy financial_document_lines_insert on public.financial_document_lines for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('finance.documents.manage_draft',private.financial_document_unit_code(financial_document_id)));
create policy financial_document_lines_update on public.financial_document_lines for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('finance.documents.manage_draft',private.financial_document_unit_code(financial_document_id)))
with check (private.current_user_has_aal2() and private.current_user_has_permission('finance.documents.manage_draft',private.financial_document_unit_code(financial_document_id)));
create policy financial_document_lines_delete on public.financial_document_lines for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('finance.documents.manage_draft',private.financial_document_unit_code(financial_document_id)));

create policy journal_entries_select on public.journal_entries for select to authenticated
using (private.current_user_has_permission('ledger.read',null));
create policy journal_entries_insert on public.journal_entries for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('ledger.create',null) and status='draft' and source_type='manual');
create policy journal_entries_update on public.journal_entries for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('ledger.create',null) and status in ('draft','validated') and source_type='manual')
with check (private.current_user_has_aal2() and private.current_user_has_permission('ledger.create',null) and status in ('draft','validated') and source_type='manual');
create policy journal_entries_delete on public.journal_entries for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('ledger.create',null) and status in ('draft','validated') and source_type='manual');

create policy journal_lines_select on public.journal_lines for select to authenticated
using (private.current_user_has_permission('ledger.read',private.unit_code_for_id(business_unit_id)));
create policy journal_lines_insert on public.journal_lines for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('ledger.create',private.unit_code_for_id(business_unit_id)));
create policy journal_lines_update on public.journal_lines for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('ledger.create',private.unit_code_for_id(business_unit_id)))
with check (private.current_user_has_aal2() and private.current_user_has_permission('ledger.create',private.unit_code_for_id(business_unit_id)));
create policy journal_lines_delete on public.journal_lines for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('ledger.create',private.unit_code_for_id(business_unit_id)));

create policy financial_settlements_select on public.financial_settlements for select to authenticated
using (private.current_user_has_permission('finance.read',private.financial_document_unit_code(financial_document_id)));
create policy financial_settlements_insert on public.financial_settlements for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('finance.settlements.create',private.financial_document_unit_code(financial_document_id)) and status='draft');
create policy financial_settlements_update on public.financial_settlements for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('finance.settlements.create',private.financial_document_unit_code(financial_document_id)) and status in ('draft','pending_approval'))
with check (private.current_user_has_aal2() and private.current_user_has_permission('finance.settlements.create',private.financial_document_unit_code(financial_document_id)) and status in ('draft','pending_approval'));
create policy financial_settlements_delete on public.financial_settlements for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('finance.settlements.create',private.financial_document_unit_code(financial_document_id)) and status='draft');
create policy financial_approvals_select on public.financial_approvals for select to authenticated using (private.current_user_has_permission('finance.read',null));

revoke all on public.managerial_accounts,public.cash_accounts,public.exchange_rates,public.financial_documents,
 public.financial_document_lines,public.journal_entries,public.journal_lines,public.financial_settlements,public.financial_approvals from anon;
grant select,insert,update,delete on public.managerial_accounts,public.cash_accounts,public.exchange_rates,
 public.financial_documents,public.financial_document_lines,public.journal_entries,public.journal_lines,public.financial_settlements to authenticated;
grant select on public.financial_approvals to authenticated;
grant all on public.managerial_accounts,public.cash_accounts,public.exchange_rates,public.financial_documents,
 public.financial_document_lines,public.journal_entries,public.journal_lines,public.financial_settlements,public.financial_approvals to service_role;
