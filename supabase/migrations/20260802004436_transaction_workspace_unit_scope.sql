begin;

alter table public.business_units
  drop constraint if exists business_units_code_check,
  add constraint business_units_code_check check (code ~ '^[A-Z][A-Z0-9_-]*$');

alter table public.business_units disable trigger business_units_protect_system;

update public.business_units
set code = 'LANDERDISPATCH',
    name = 'Serviços de Dispatch',
    description = 'Serviços operacionais de dispatch.',
    unit_type = 'services',
    version = version + 1,
    updated_at = now()
where code = 'DICADECRIA';

update public.business_units
set code = 'DJSTAY-EAD',
    name = 'Plataforma DJ Stay',
    description = 'Plataforma exclusiva do DJ Stay.',
    unit_type = 'product',
    version = version + 1,
    updated_at = now()
where code = 'LANDERSERVICES';

alter table public.business_units enable trigger business_units_protect_system;

alter table public.cash_accounts
  add column if not exists business_unit_id uuid,
  add column if not exists integration_status text not null default 'manual',
  add column if not exists last_synced_at timestamptz,
  add column if not exists sync_error text,
  add column if not exists current_balance numeric(20,4) not null default 0;

update public.cash_accounts ca
set business_unit_id = bu.id
from public.business_units bu
where ca.business_unit_id is null
  and bu.legal_entity_id = ca.legal_entity_id
  and bu.code = 'CORPORATIVO';

alter table public.cash_accounts
  alter column business_unit_id set not null;

alter table public.cash_accounts
  drop constraint if exists cash_accounts_business_unit_id_fkey,
  add constraint cash_accounts_business_unit_id_fkey
    foreign key (business_unit_id) references public.business_units(id) on delete restrict,
  drop constraint if exists cash_accounts_integration_status_check,
  add constraint cash_accounts_integration_status_check
    check (integration_status = any (array['manual','connected','syncing','error','disconnected'])),
  drop constraint if exists cash_accounts_current_balance_check,
  add constraint cash_accounts_current_balance_check
    check (current_balance between -9999999999999999.9999 and 9999999999999999.9999),
  drop constraint if exists cash_accounts_sync_error_check,
  add constraint cash_accounts_sync_error_check
    check (sync_error is null or char_length(sync_error) <= 1000);

create index if not exists cash_accounts_business_unit_idx
  on public.cash_accounts (business_unit_id, status);

alter table public.financial_documents
  add column if not exists attachment_reference text,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid,
  add column if not exists deleted_reason text;

alter table public.financial_documents
  drop constraint if exists financial_documents_deleted_by_fkey,
  add constraint financial_documents_deleted_by_fkey
    foreign key (deleted_by) references auth.users(id) on delete set null,
  drop constraint if exists financial_documents_deleted_state_check,
  add constraint financial_documents_deleted_state_check
    check (
      (deleted_at is null and deleted_by is null and deleted_reason is null)
      or
      (deleted_at is not null and deleted_reason is not null and char_length(btrim(deleted_reason)) between 3 and 1000)
    ),
  drop constraint if exists financial_documents_attachment_reference_check,
  add constraint financial_documents_attachment_reference_check
    check (attachment_reference is null or char_length(attachment_reference) <= 2000);

create index if not exists financial_documents_deleted_idx
  on public.financial_documents (deleted_at, business_unit_id, competence_date);

alter table public.bank_statement_lines
  add column if not exists business_unit_id uuid,
  add column if not exists category_id uuid,
  add column if not exists party_id uuid,
  add column if not exists financial_document_id uuid,
  add column if not exists notes text,
  add column if not exists attachment_reference text,
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by uuid,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid,
  add column if not exists deleted_reason text;

update public.bank_statement_lines line
set business_unit_id = account.business_unit_id
from public.bank_statement_imports import
join public.cash_accounts account on account.id = import.cash_account_id
where line.statement_import_id = import.id
  and line.business_unit_id is null;

alter table public.bank_statement_lines
  alter column business_unit_id set not null;

alter table public.bank_statement_lines
  drop constraint if exists bank_statement_lines_business_unit_id_fkey,
  add constraint bank_statement_lines_business_unit_id_fkey
    foreign key (business_unit_id) references public.business_units(id) on delete restrict,
  drop constraint if exists bank_statement_lines_category_id_fkey,
  add constraint bank_statement_lines_category_id_fkey
    foreign key (category_id) references public.financial_categories(id) on delete restrict,
  drop constraint if exists bank_statement_lines_party_id_fkey,
  add constraint bank_statement_lines_party_id_fkey
    foreign key (party_id) references public.parties(id) on delete restrict,
  drop constraint if exists bank_statement_lines_financial_document_id_fkey,
  add constraint bank_statement_lines_financial_document_id_fkey
    foreign key (financial_document_id) references public.financial_documents(id) on delete restrict,
  drop constraint if exists bank_statement_lines_confirmed_by_fkey,
  add constraint bank_statement_lines_confirmed_by_fkey
    foreign key (confirmed_by) references auth.users(id) on delete set null,
  drop constraint if exists bank_statement_lines_deleted_by_fkey,
  add constraint bank_statement_lines_deleted_by_fkey
    foreign key (deleted_by) references auth.users(id) on delete set null,
  drop constraint if exists bank_statement_lines_notes_check,
  add constraint bank_statement_lines_notes_check
    check (notes is null or char_length(notes) <= 4000),
  drop constraint if exists bank_statement_lines_attachment_reference_check,
  add constraint bank_statement_lines_attachment_reference_check
    check (attachment_reference is null or char_length(attachment_reference) <= 2000),
  drop constraint if exists bank_statement_lines_deleted_state_check,
  add constraint bank_statement_lines_deleted_state_check
    check (
      (deleted_at is null and deleted_by is null and deleted_reason is null)
      or
      (deleted_at is not null and deleted_reason is not null and char_length(btrim(deleted_reason)) between 3 and 1000)
    );

create index if not exists bank_statement_lines_business_unit_idx
  on public.bank_statement_lines (business_unit_id, transaction_date);
create index if not exists bank_statement_lines_category_idx
  on public.bank_statement_lines (category_id);
create index if not exists bank_statement_lines_party_idx
  on public.bank_statement_lines (party_id);
create index if not exists bank_statement_lines_document_idx
  on public.bank_statement_lines (financial_document_id);
create index if not exists bank_statement_lines_deleted_idx
  on public.bank_statement_lines (deleted_at, business_unit_id, transaction_date);

create or replace function private.assign_bank_statement_line_unit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  expected_unit_id uuid;
begin
  select account.business_unit_id
    into expected_unit_id
  from public.bank_statement_imports import
  join public.cash_accounts account on account.id = import.cash_account_id
  where import.id = new.statement_import_id;

  if expected_unit_id is null then
    raise exception 'A conta financeira do extrato não possui unidade de negócio válida.';
  end if;

  if new.business_unit_id is not null and new.business_unit_id <> expected_unit_id then
    raise exception 'A unidade da movimentação deve ser a mesma unidade da conta financeira.';
  end if;

  new.business_unit_id := expected_unit_id;
  return new;
end;
$$;

revoke all on function private.assign_bank_statement_line_unit() from public, anon, authenticated;
grant execute on function private.assign_bank_statement_line_unit() to service_role;

drop trigger if exists bank_lines_assign_unit on public.bank_statement_lines;
create trigger bank_lines_assign_unit
before insert or update of statement_import_id, business_unit_id
on public.bank_statement_lines
for each row execute function private.assign_bank_statement_line_unit();

drop policy if exists cash_accounts_select on public.cash_accounts;
create policy cash_accounts_select on public.cash_accounts
for select using (
  private.current_user_has_permission('finance.read', private.unit_code_for_id(business_unit_id))
);

drop policy if exists cash_accounts_insert on public.cash_accounts;
create policy cash_accounts_insert on public.cash_accounts
for insert with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('finance.cash.manage', private.unit_code_for_id(business_unit_id))
);

drop policy if exists cash_accounts_update on public.cash_accounts;
create policy cash_accounts_update on public.cash_accounts
for update using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('finance.cash.manage', private.unit_code_for_id(business_unit_id))
) with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('finance.cash.manage', private.unit_code_for_id(business_unit_id))
);

drop policy if exists cash_accounts_delete on public.cash_accounts;
create policy cash_accounts_delete on public.cash_accounts
for delete using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('finance.cash.manage', private.unit_code_for_id(business_unit_id))
);

drop policy if exists bank_lines_select on public.bank_statement_lines;
create policy bank_lines_select on public.bank_statement_lines
for select using (
  private.current_user_has_permission('reconciliation.read', private.unit_code_for_id(business_unit_id))
);

drop policy if exists bank_lines_insert on public.bank_statement_lines;
create policy bank_lines_insert on public.bank_statement_lines
for insert with check (
  private.current_user_has_permission('reconciliation.manage', private.unit_code_for_id(business_unit_id))
);

drop policy if exists bank_lines_update on public.bank_statement_lines;
create policy bank_lines_update on public.bank_statement_lines
for update using (
  match_status = 'unmatched'
  and private.current_user_has_permission('reconciliation.manage', private.unit_code_for_id(business_unit_id))
) with check (
  private.current_user_has_permission('reconciliation.manage', private.unit_code_for_id(business_unit_id))
);

drop policy if exists bank_lines_delete on public.bank_statement_lines;
create policy bank_lines_delete on public.bank_statement_lines
for delete using (
  match_status = 'unmatched'
  and private.current_user_has_permission('reconciliation.manage', private.unit_code_for_id(business_unit_id))
);

commit;
