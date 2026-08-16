create table public.financial_fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  financial_document_id uuid not null unique references public.financial_documents(id) on delete restrict,
  fiscal_document_type text not null check (fiscal_document_type in ('commercial_invoice','nfe','nfse','service_receipt','credit_note','debit_note')),
  fiscal_number text not null check (char_length(btrim(fiscal_number)) between 1 and 120),
  series text,
  access_key text,
  issuer_tax_id text,
  recipient_tax_id text,
  service_code text,
  tax_regime text,
  issued_at timestamptz,
  status text not null default 'draft' check (status in ('draft','authorized','denied','cancelled','corrected')),
  authorization_protocol text,
  authorized_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  storage_provider text not null default 'external' check (storage_provider in ('external','supabase','r2')),
  xml_bucket text,
  xml_object_key text,
  xml_checksum_sha256 text,
  pdf_bucket text,
  pdf_object_key text,
  version integer not null default 1 check (version > 0),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (issuer_tax_id,fiscal_document_type,series,fiscal_number),
  check (access_key is null or char_length(access_key) between 8 and 80),
  check (xml_checksum_sha256 is null or xml_checksum_sha256 ~ '^[A-Fa-f0-9]{64}$'),
  check ((status <> 'authorized') or (authorization_protocol is not null and authorized_at is not null)),
  check ((status <> 'cancelled') or (cancelled_at is not null and cancellation_reason is not null))
);

create table public.financial_fiscal_events (
  id uuid primary key default gen_random_uuid(),
  fiscal_document_id uuid not null references public.financial_fiscal_documents(id) on delete cascade,
  sequence_no integer not null check (sequence_no > 0),
  event_type text not null check (event_type in ('authorization','cancellation','correction','denial','inutilization','protocol','return')),
  event_status text not null default 'pending' check (event_status in ('pending','accepted','rejected')),
  occurred_at timestamptz not null,
  protocol text,
  reason text,
  xml_bucket text,
  xml_object_key text,
  xml_checksum_sha256 text,
  response_code text,
  response_message text,
  version integer not null default 1 check (version > 0),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fiscal_document_id,sequence_no),
  check (xml_checksum_sha256 is null or xml_checksum_sha256 ~ '^[A-Fa-f0-9]{64}$')
);

create table public.financial_adjustments (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null references public.financial_documents(id) on delete restrict,
  adjustment_document_id uuid unique references public.financial_documents(id) on delete restrict,
  adjustment_type text not null check (adjustment_type in ('cancellation','refund','chargeback','reimbursement','credit_note','debit_note','tax_adjustment')),
  counterparty_account_id uuid not null references public.managerial_accounts(id) on delete restrict,
  original_currency_code text not null references public.currencies(code) on delete restrict,
  original_amount numeric(18,2) not null check (original_amount > 0),
  adjustment_date date not null,
  due_date date not null,
  reason text not null check (char_length(btrim(reason)) between 5 and 2000),
  external_reference text,
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','posted','rejected','cancelled','reversed')),
  requested_by uuid references public.profiles(id) on delete restrict,
  requested_at timestamptz,
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  decision_reason text,
  posted_by uuid references public.profiles(id) on delete restrict,
  posted_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_date >= adjustment_date)
);

create table public.bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  cash_account_id uuid not null references public.cash_accounts(id) on delete restrict,
  statement_format text not null default 'OFX' check (statement_format='OFX'),
  period_start date not null,
  period_end date not null,
  opening_balance numeric(18,2) not null,
  closing_balance numeric(18,2) not null,
  currency_code text not null references public.currencies(code) on delete restrict,
  storage_provider text not null default 'external' check (storage_provider in ('external','supabase','r2')),
  storage_bucket text,
  storage_object_key text not null,
  checksum_sha256 text not null check (checksum_sha256 ~ '^[A-Fa-f0-9]{64}$'),
  status text not null default 'uploaded' check (status in ('uploaded','validated','reconciled','cancelled')),
  imported_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  imported_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cash_account_id,checksum_sha256),
  check (period_end >= period_start)
);

create table public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  statement_import_id uuid not null references public.bank_statement_imports(id) on delete cascade,
  sequence_no integer not null check (sequence_no > 0),
  transaction_date date not null,
  value_date date,
  transaction_type text not null check (transaction_type in ('credit','debit')),
  amount numeric(18,2) not null check (amount > 0),
  currency_code text not null references public.currencies(code) on delete restrict,
  bank_reference text,
  memo text,
  counterparty_name text,
  balance_after numeric(18,2),
  match_status text not null default 'unmatched' check (match_status in ('unmatched','matched','ignored')),
  matched_settlement_id uuid references public.financial_settlements(id) on delete restrict,
  matched_journal_entry_id uuid references public.journal_entries(id) on delete restrict,
  ignored_reason text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (statement_import_id,sequence_no),
  check ((match_status='matched' and num_nonnulls(matched_settlement_id,matched_journal_entry_id)>=1) or (match_status='ignored' and ignored_reason is not null) or match_status='unmatched')
);

create table public.bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  statement_import_id uuid not null unique references public.bank_statement_imports(id) on delete restrict,
  cash_account_id uuid not null references public.cash_accounts(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  book_closing_balance numeric(18,2) not null,
  statement_closing_balance numeric(18,2) not null,
  difference numeric(18,2) generated always as (round(statement_closing_balance-book_closing_balance,2)) stored,
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','closed','reopened','cancelled')),
  requested_by uuid references public.profiles(id) on delete restrict,
  requested_at timestamptz,
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  reopening_reason text,
  version integer not null default 1 check (version > 0),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table public.financial_period_close_runs (
  id uuid primary key default gen_random_uuid(),
  financial_period_id uuid not null unique references public.financial_periods(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','closed','reopened','cancelled')),
  open_documents_count integer not null default 0 check (open_documents_count >= 0),
  pending_settlements_count integer not null default 0 check (pending_settlements_count >= 0),
  pending_adjustments_count integer not null default 0 check (pending_adjustments_count >= 0),
  unreconciled_accounts_count integer not null default 0 check (unreconciled_accounts_count >= 0),
  unposted_journals_count integer not null default 0 check (unposted_journals_count >= 0),
  requested_by uuid references public.profiles(id) on delete restrict,
  requested_at timestamptz,
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  closed_by uuid references public.profiles(id) on delete restrict,
  closed_at timestamptz,
  reopening_reason text,
  version integer not null default 1 check (version > 0),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.financial_period_close_items (
  id uuid primary key default gen_random_uuid(),
  close_run_id uuid not null references public.financial_period_close_runs(id) on delete cascade,
  item_code text not null check (item_code ~ '^[A-Z][A-Z0-9_]{2,59}$'),
  category text not null check (category in ('documents','settlements','reconciliation','tax','ledger','contracts','allocations','participations','evidence','other')),
  label text not null check (char_length(btrim(label)) between 3 and 240),
  required boolean not null default true,
  status text not null default 'pending' check (status in ('pending','completed','waived')),
  evidence_reference text,
  notes text,
  completed_by uuid references public.profiles(id) on delete restrict,
  completed_at timestamptz,
  waived_by uuid references public.profiles(id) on delete restrict,
  waived_at timestamptz,
  waiver_reason text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (close_run_id,item_code),
  check ((status<>'completed') or (completed_by is not null and completed_at is not null)),
  check ((status<>'waived') or (waived_by is not null and waived_at is not null and waiver_reason is not null))
);

create index fiscal_documents_financial_idx on public.financial_fiscal_documents(financial_document_id);
create index fiscal_documents_status_idx on public.financial_fiscal_documents(status,issued_at);
create index fiscal_documents_created_idx on public.financial_fiscal_documents(created_by);
create index fiscal_events_document_idx on public.financial_fiscal_events(fiscal_document_id,sequence_no);
create index fiscal_events_created_idx on public.financial_fiscal_events(created_by);
create index financial_adjustments_source_idx on public.financial_adjustments(source_document_id,status);
create index financial_adjustments_document_idx on public.financial_adjustments(adjustment_document_id);
create index financial_adjustments_account_idx on public.financial_adjustments(counterparty_account_id);
create index financial_adjustments_currency_idx on public.financial_adjustments(original_currency_code);
create index financial_adjustments_requested_idx on public.financial_adjustments(requested_by);
create index financial_adjustments_approved_idx on public.financial_adjustments(approved_by);
create index financial_adjustments_posted_idx on public.financial_adjustments(posted_by);
create index financial_adjustments_created_idx on public.financial_adjustments(created_by);
create index bank_imports_cash_period_idx on public.bank_statement_imports(cash_account_id,period_start,period_end);
create index bank_imports_currency_idx on public.bank_statement_imports(currency_code);
create index bank_imports_imported_idx on public.bank_statement_imports(imported_by);
create index bank_lines_import_idx on public.bank_statement_lines(statement_import_id,sequence_no);
create index bank_lines_settlement_idx on public.bank_statement_lines(matched_settlement_id);
create index bank_lines_journal_idx on public.bank_statement_lines(matched_journal_entry_id);
create index bank_lines_status_idx on public.bank_statement_lines(match_status,transaction_date);
create index bank_reconciliations_cash_idx on public.bank_reconciliations(cash_account_id,period_end);
create index bank_reconciliations_requested_idx on public.bank_reconciliations(requested_by);
create index bank_reconciliations_approved_idx on public.bank_reconciliations(approved_by);
create index bank_reconciliations_created_idx on public.bank_reconciliations(created_by);
create index period_close_runs_requested_idx on public.financial_period_close_runs(requested_by);
create index period_close_runs_approved_idx on public.financial_period_close_runs(approved_by);
create index period_close_runs_closed_idx on public.financial_period_close_runs(closed_by);
create index period_close_runs_created_idx on public.financial_period_close_runs(created_by);
create index period_close_items_run_idx on public.financial_period_close_items(close_run_id,status);
create index period_close_items_completed_idx on public.financial_period_close_items(completed_by);
create index period_close_items_waived_idx on public.financial_period_close_items(waived_by);

create or replace function private.fiscal_document_unit_code(p_id uuid) returns text
language sql stable security definer set search_path='' as $$
  select private.financial_document_unit_code(ffd.financial_document_id)
  from public.financial_fiscal_documents ffd where ffd.id=p_id
$$;

create or replace function private.adjustment_unit_code(p_id uuid) returns text
language sql stable security definer set search_path='' as $$
  select private.financial_document_unit_code(fa.source_document_id)
  from public.financial_adjustments fa where fa.id=p_id
$$;

create or replace function private.validate_fiscal_document_link() returns trigger
language plpgsql set search_path='' as $$
declare v_source text;
begin
  select source_type into v_source from public.financial_documents where id=new.financial_document_id;
  if not found or v_source not in ('invoice','fiscal_document') then
    raise exception 'Metadados fiscais exigem documento financeiro do tipo invoice ou fiscal_document.';
  end if;
  return new;
end$$;

create or replace function private.protect_fiscal_event() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' and old.event_status<>'pending' then raise exception 'Evento fiscal processado é imutável.'; end if;
  if tg_op='UPDATE' and old.event_status<>'pending' and row(new.event_type,new.event_status,new.occurred_at,new.protocol,new.reason,new.xml_bucket,new.xml_object_key,new.xml_checksum_sha256,new.response_code,new.response_message) is distinct from row(old.event_type,old.event_status,old.occurred_at,old.protocol,old.reason,old.xml_bucket,old.xml_object_key,old.xml_checksum_sha256,old.response_code,old.response_message) then raise exception 'Evento fiscal processado é imutável.'; end if;
  return coalesce(new,old);
end$$;

create or replace function private.validate_financial_adjustment() returns trigger
language plpgsql set search_path='' as $$
declare v_doc public.financial_documents;v_account_type text;v_existing numeric;
begin
  select * into v_doc from public.financial_documents where id=new.source_document_id;
  if not found or v_doc.status not in ('approved','issued','partially_settled','settled','overdue','in_dispute') then raise exception 'Documento de origem não permite ajuste.'; end if;
  if new.original_currency_code<>v_doc.original_currency_code then raise exception 'Moeda do ajuste deve corresponder ao documento de origem.'; end if;
  select coalesce(sum(original_amount),0) into v_existing from public.financial_adjustments where source_document_id=new.source_document_id and status in ('pending_approval','approved','posted') and id<>new.id;
  if v_existing+new.original_amount>v_doc.original_amount then raise exception 'Ajustes ativos excedem o valor original do documento.'; end if;
  select account_type into v_account_type from public.managerial_accounts where id=new.counterparty_account_id and status='active' and posting_allowed;
  if v_doc.document_nature='receivable' and v_account_type<>'liability' then raise exception 'Ajuste de recebível exige conta de contrapartida do passivo.'; end if;
  if v_doc.document_nature='payable' and v_account_type<>'asset' then raise exception 'Ajuste de pagável exige conta de contrapartida do ativo.'; end if;
  return new;
end$$;

create or replace function private.protect_financial_adjustment() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then
    if old.status<>'draft' then raise exception 'Somente ajuste em rascunho pode ser excluído.'; end if;
    return old;
  end if;
  if old.status<>'draft' and row(new.source_document_id,new.adjustment_type,new.counterparty_account_id,new.original_currency_code,new.original_amount,new.adjustment_date,new.due_date,new.reason,new.external_reference,new.created_by) is distinct from row(old.source_document_id,old.adjustment_type,old.counterparty_account_id,old.original_currency_code,old.original_amount,old.adjustment_date,old.due_date,old.reason,old.external_reference,old.created_by) then raise exception 'Ajuste submetido é economicamente imutável.'; end if;
  return new;
end$$;

create or replace function private.validate_bank_statement_import() returns trigger
language plpgsql set search_path='' as $$
declare v_cash public.cash_accounts;
begin
  select * into v_cash from public.cash_accounts where id=new.cash_account_id;
  if not found or v_cash.status<>'active' then raise exception 'Conta financeira inválida para o extrato.'; end if;
  if v_cash.currency_code<>new.currency_code then raise exception 'Moeda do extrato diverge da conta financeira.'; end if;
  return new;
end$$;

create or replace function private.validate_bank_statement_line() returns trigger
language plpgsql set search_path='' as $$
declare v_currency text;v_cash uuid;v_settlement public.financial_settlements;
begin
  select currency_code,cash_account_id into v_currency,v_cash from public.bank_statement_imports where id=new.statement_import_id;
  if new.currency_code<>v_currency then raise exception 'Moeda da linha diverge do extrato.'; end if;
  if new.matched_settlement_id is not null then
    select * into v_settlement from public.financial_settlements where id=new.matched_settlement_id;
    if not found or v_settlement.status<>'posted' or v_settlement.cash_account_id<>v_cash then raise exception 'Liquidação não é elegível para conciliação.'; end if;
    if round(v_settlement.original_amount,2)<>round(new.amount,2) then raise exception 'Valor da linha diverge da liquidação.'; end if;
  end if;
  return new;
end$$;

create or replace function private.protect_reconciled_bank_line() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' and old.match_status<>'unmatched' then raise exception 'Linha conciliada ou ignorada é imutável.'; end if;
  if tg_op='UPDATE' and old.match_status<>'unmatched' and row(new.statement_import_id,new.sequence_no,new.transaction_date,new.value_date,new.transaction_type,new.amount,new.currency_code,new.bank_reference,new.memo,new.counterparty_name,new.balance_after,new.match_status,new.matched_settlement_id,new.matched_journal_entry_id,new.ignored_reason) is distinct from row(old.statement_import_id,old.sequence_no,old.transaction_date,old.value_date,old.transaction_type,old.amount,old.currency_code,old.bank_reference,old.memo,old.counterparty_name,old.balance_after,old.match_status,old.matched_settlement_id,old.matched_journal_entry_id,old.ignored_reason) then raise exception 'Linha conciliada ou ignorada é imutável.'; end if;
  return coalesce(new,old);
end$$;

create or replace function private.protect_period_close_item() returns trigger
language plpgsql set search_path='' as $$
declare v_run_status text;
begin
  select status into v_run_status from public.financial_period_close_runs where id=coalesce(new.close_run_id,old.close_run_id);
  if v_run_status not in ('draft','reopened') then raise exception 'Checklist de fechamento está congelado.'; end if;
  return coalesce(new,old);
end$$;

create trigger fiscal_documents_validate before insert or update on public.financial_fiscal_documents for each row execute function private.validate_fiscal_document_link();
create trigger fiscal_documents_touch before update on public.financial_fiscal_documents for each row execute function private.touch_updated_at();
create trigger fiscal_events_protect before update or delete on public.financial_fiscal_events for each row execute function private.protect_fiscal_event();
create trigger fiscal_events_touch before update on public.financial_fiscal_events for each row execute function private.touch_updated_at();
create trigger financial_adjustments_validate before insert or update on public.financial_adjustments for each row execute function private.validate_financial_adjustment();
create trigger financial_adjustments_protect before update or delete on public.financial_adjustments for each row execute function private.protect_financial_adjustment();
create trigger financial_adjustments_touch before update on public.financial_adjustments for each row execute function private.touch_updated_at();
create trigger bank_imports_validate before insert or update on public.bank_statement_imports for each row execute function private.validate_bank_statement_import();
create trigger bank_imports_touch before update on public.bank_statement_imports for each row execute function private.touch_updated_at();
create trigger bank_lines_validate before insert or update on public.bank_statement_lines for each row execute function private.validate_bank_statement_line();
create trigger bank_lines_protect before update or delete on public.bank_statement_lines for each row execute function private.protect_reconciled_bank_line();
create trigger bank_lines_touch before update on public.bank_statement_lines for each row execute function private.touch_updated_at();
create trigger bank_reconciliations_touch before update on public.bank_reconciliations for each row execute function private.touch_updated_at();
create trigger period_close_runs_touch before update on public.financial_period_close_runs for each row execute function private.touch_updated_at();
create trigger period_close_items_protect before insert or update or delete on public.financial_period_close_items for each row execute function private.protect_period_close_item();
create trigger period_close_items_touch before update on public.financial_period_close_items for each row execute function private.touch_updated_at();

create trigger fiscal_documents_audit after insert or update or delete on public.financial_fiscal_documents for each row execute function private.audit_row_change();
create trigger fiscal_events_audit after insert or update or delete on public.financial_fiscal_events for each row execute function private.audit_row_change();
create trigger financial_adjustments_audit after insert or update or delete on public.financial_adjustments for each row execute function private.audit_row_change();
create trigger bank_imports_audit after insert or update or delete on public.bank_statement_imports for each row execute function private.audit_row_change();
create trigger bank_lines_audit after insert or update or delete on public.bank_statement_lines for each row execute function private.audit_row_change();
create trigger bank_reconciliations_audit after insert or update or delete on public.bank_reconciliations for each row execute function private.audit_row_change();
create trigger period_close_runs_audit after insert or update or delete on public.financial_period_close_runs for each row execute function private.audit_row_change();
create trigger period_close_items_audit after insert or update or delete on public.financial_period_close_items for each row execute function private.audit_row_change();

insert into public.permissions(code,module,action,description) values
 ('fiscal.read','fiscal','read','Consultar documentos e eventos fiscais'),
 ('fiscal.manage','fiscal','manage','Gerenciar metadados e eventos fiscais'),
 ('finance.adjustments.read','finance_adjustments','read','Consultar ajustes financeiros'),
 ('finance.adjustments.manage','finance_adjustments','manage','Criar e editar ajustes financeiros'),
 ('finance.adjustments.approve','finance_adjustments','approve','Aprovar ou rejeitar ajustes financeiros'),
 ('finance.adjustments.post','finance_adjustments','post','Postar ajustes no núcleo financeiro'),
 ('reconciliation.read','reconciliation','read','Consultar extratos e conciliações'),
 ('reconciliation.manage','reconciliation','manage','Importar OFX e conciliar linhas'),
 ('reconciliation.approve','reconciliation','approve','Aprovar conciliações bancárias'),
 ('period_close.read','period_close','read','Consultar fechamento financeiro'),
 ('period_close.manage','period_close','manage','Preparar e submeter fechamento'),
 ('period_close.approve','period_close','approve','Aprovar e fechar período'),
 ('period_close.reopen','period_close','reopen','Reabrir período fechado')
on conflict(code) do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.app_roles r cross join public.permissions p
where r.code in ('owner','corporate_admin') and p.module in ('fiscal','finance_adjustments','reconciliation','period_close')
on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.app_roles r cross join public.permissions p
where r.code='finance_manager' and p.code in ('fiscal.read','fiscal.manage','finance.adjustments.read','finance.adjustments.manage','finance.adjustments.approve','finance.adjustments.post','reconciliation.read','reconciliation.manage','reconciliation.approve','period_close.read','period_close.manage','period_close.approve')
on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.app_roles r cross join public.permissions p
where r.code in ('auditor','executive_readonly','readonly') and p.code in ('fiscal.read','finance.adjustments.read','reconciliation.read','period_close.read')
on conflict do nothing;

alter table public.financial_fiscal_documents enable row level security;
alter table public.financial_fiscal_events enable row level security;
alter table public.financial_adjustments enable row level security;
alter table public.bank_statement_imports enable row level security;
alter table public.bank_statement_lines enable row level security;
alter table public.bank_reconciliations enable row level security;
alter table public.financial_period_close_runs enable row level security;
alter table public.financial_period_close_items enable row level security;

create policy fiscal_documents_select on public.financial_fiscal_documents for select to authenticated using(private.current_user_has_permission('fiscal.read',private.financial_document_unit_code(financial_document_id)));
create policy fiscal_documents_insert on public.financial_fiscal_documents for insert to authenticated with check(status='draft' and private.current_user_has_permission('fiscal.manage',private.financial_document_unit_code(financial_document_id)));
create policy fiscal_documents_update on public.financial_fiscal_documents for update to authenticated using(status in ('draft','authorized','denied','corrected') and private.current_user_has_permission('fiscal.manage',private.financial_document_unit_code(financial_document_id))) with check(private.current_user_has_permission('fiscal.manage',private.financial_document_unit_code(financial_document_id)));
create policy fiscal_documents_delete on public.financial_fiscal_documents for delete to authenticated using(status='draft' and private.current_user_has_permission('fiscal.manage',private.financial_document_unit_code(financial_document_id)));
create policy fiscal_events_select on public.financial_fiscal_events for select to authenticated using(private.current_user_has_permission('fiscal.read',private.fiscal_document_unit_code(fiscal_document_id)));
create policy fiscal_events_insert on public.financial_fiscal_events for insert to authenticated with check(private.current_user_has_permission('fiscal.manage',private.fiscal_document_unit_code(fiscal_document_id)));
create policy fiscal_events_update on public.financial_fiscal_events for update to authenticated using(event_status='pending' and private.current_user_has_permission('fiscal.manage',private.fiscal_document_unit_code(fiscal_document_id))) with check(private.current_user_has_permission('fiscal.manage',private.fiscal_document_unit_code(fiscal_document_id)));
create policy fiscal_events_delete on public.financial_fiscal_events for delete to authenticated using(event_status='pending' and private.current_user_has_permission('fiscal.manage',private.fiscal_document_unit_code(fiscal_document_id)));

create policy adjustments_select on public.financial_adjustments for select to authenticated using(private.current_user_has_permission('finance.adjustments.read',private.financial_document_unit_code(source_document_id)));
create policy adjustments_insert on public.financial_adjustments for insert to authenticated with check(status='draft' and private.current_user_has_permission('finance.adjustments.manage',private.financial_document_unit_code(source_document_id)));
create policy adjustments_update on public.financial_adjustments for update to authenticated using(status='draft' and private.current_user_has_permission('finance.adjustments.manage',private.financial_document_unit_code(source_document_id))) with check(status='draft' and private.current_user_has_permission('finance.adjustments.manage',private.financial_document_unit_code(source_document_id)));
create policy adjustments_delete on public.financial_adjustments for delete to authenticated using(status='draft' and private.current_user_has_permission('finance.adjustments.manage',private.financial_document_unit_code(source_document_id)));

create policy bank_imports_select on public.bank_statement_imports for select to authenticated using(private.current_user_has_permission('reconciliation.read',null));
create policy bank_imports_insert on public.bank_statement_imports for insert to authenticated with check(status='uploaded' and private.current_user_has_permission('reconciliation.manage',null));
create policy bank_imports_update on public.bank_statement_imports for update to authenticated using(status in ('uploaded','validated') and private.current_user_has_permission('reconciliation.manage',null)) with check(private.current_user_has_permission('reconciliation.manage',null));
create policy bank_imports_delete on public.bank_statement_imports for delete to authenticated using(status='uploaded' and private.current_user_has_permission('reconciliation.manage',null));
create policy bank_lines_select on public.bank_statement_lines for select to authenticated using(private.current_user_has_permission('reconciliation.read',null));
create policy bank_lines_insert on public.bank_statement_lines for insert to authenticated with check(private.current_user_has_permission('reconciliation.manage',null));
create policy bank_lines_update on public.bank_statement_lines for update to authenticated using(match_status='unmatched' and private.current_user_has_permission('reconciliation.manage',null)) with check(private.current_user_has_permission('reconciliation.manage',null));
create policy bank_lines_delete on public.bank_statement_lines for delete to authenticated using(match_status='unmatched' and private.current_user_has_permission('reconciliation.manage',null));
create policy bank_reconciliations_select on public.bank_reconciliations for select to authenticated using(private.current_user_has_permission('reconciliation.read',null));
create policy bank_reconciliations_insert on public.bank_reconciliations for insert to authenticated with check(status='draft' and private.current_user_has_permission('reconciliation.manage',null));
create policy bank_reconciliations_update on public.bank_reconciliations for update to authenticated using(status in ('draft','reopened') and private.current_user_has_permission('reconciliation.manage',null)) with check(private.current_user_has_permission('reconciliation.manage',null));
create policy bank_reconciliations_delete on public.bank_reconciliations for delete to authenticated using(status='draft' and private.current_user_has_permission('reconciliation.manage',null));

create policy period_close_runs_select on public.financial_period_close_runs for select to authenticated using(private.current_user_has_permission('period_close.read',null));
create policy period_close_runs_insert on public.financial_period_close_runs for insert to authenticated with check(status='draft' and private.current_user_has_permission('period_close.manage',null));
create policy period_close_runs_update on public.financial_period_close_runs for update to authenticated using(status in ('draft','reopened') and private.current_user_has_permission('period_close.manage',null)) with check(private.current_user_has_permission('period_close.manage',null));
create policy period_close_runs_delete on public.financial_period_close_runs for delete to authenticated using(status='draft' and private.current_user_has_permission('period_close.manage',null));
create policy period_close_items_select on public.financial_period_close_items for select to authenticated using(private.current_user_has_permission('period_close.read',null));
create policy period_close_items_insert on public.financial_period_close_items for insert to authenticated with check(private.current_user_has_permission('period_close.manage',null));
create policy period_close_items_update on public.financial_period_close_items for update to authenticated using(private.current_user_has_permission('period_close.manage',null)) with check(private.current_user_has_permission('period_close.manage',null));
create policy period_close_items_delete on public.financial_period_close_items for delete to authenticated using(private.current_user_has_permission('period_close.manage',null));

revoke all on public.financial_fiscal_documents,public.financial_fiscal_events,public.financial_adjustments,public.bank_statement_imports,public.bank_statement_lines,public.bank_reconciliations,public.financial_period_close_runs,public.financial_period_close_items from anon;
grant select,insert,update,delete on public.financial_fiscal_documents,public.financial_fiscal_events,public.financial_adjustments,public.bank_statement_imports,public.bank_statement_lines,public.bank_reconciliations,public.financial_period_close_runs,public.financial_period_close_items to authenticated;
