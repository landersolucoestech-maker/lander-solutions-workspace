create or replace view public.reporting_posted_ledger_lines
with (security_invoker = true)
as
select
  jl.id as journal_line_id,
  je.id as journal_entry_id,
  je.entry_number,
  je.competence_date,
  je.posting_date,
  je.description as entry_description,
  jl.line_no,
  jl.description as line_description,
  ma.id as managerial_account_id,
  ma.code as account_code,
  ma.name as account_name,
  ma.account_type,
  ma.normal_balance,
  jl.business_unit_id,
  bu.code as business_unit_code,
  bu.name as business_unit_name,
  jl.product_id,
  jl.service_line_id,
  jl.project_id,
  jl.contract_id,
  jl.party_id,
  jl.cost_center_id,
  jl.revenue_center_id,
  jl.category_id,
  jl.debit_amount,
  jl.credit_amount,
  case
    when ma.normal_balance = 'credit' then jl.credit_amount - jl.debit_amount
    else jl.debit_amount - jl.credit_amount
  end as signed_amount,
  jl.original_currency_code,
  jl.original_amount,
  jl.fx_rate
from public.journal_lines jl
join public.journal_entries je on je.id = jl.journal_entry_id
join public.managerial_accounts ma on ma.id = jl.managerial_account_id
left join public.business_units bu on bu.id = jl.business_unit_id
where je.status = 'posted';

create or replace view public.reporting_posted_cash_movements
with (security_invoker = true)
as
select
  fs.id as settlement_id,
  fs.financial_document_id,
  fs.settlement_date,
  fs.functional_amount,
  fs.bank_fee_functional,
  fd.document_nature,
  fd.document_number,
  fd.description,
  fd.business_unit_id,
  bu.code as business_unit_code,
  bu.name as business_unit_name,
  fd.party_id,
  p.legal_name as party_legal_name,
  p.trade_name as party_trade_name
from public.financial_settlements fs
join public.financial_documents fd on fd.id = fs.financial_document_id
left join public.business_units bu on bu.id = fd.business_unit_id
left join public.parties p on p.id = fd.party_id
where fs.status = 'posted';

create or replace view public.reporting_financial_documents
with (security_invoker = true)
as
select
  fd.id,
  fd.document_nature,
  fd.document_number,
  fd.description,
  fd.issue_date,
  fd.competence_date,
  fd.due_date,
  fd.original_currency_code,
  fd.original_amount,
  fd.fx_rate,
  fd.functional_currency_code,
  fd.functional_amount,
  fd.tax_amount_functional,
  fd.fee_amount_functional,
  fd.status,
  fd.business_unit_id,
  bu.code as business_unit_code,
  bu.name as business_unit_name,
  fd.product_id,
  fd.service_line_id,
  fd.project_id,
  fd.contract_id,
  fd.party_id,
  p.legal_name as party_legal_name,
  p.trade_name as party_trade_name,
  fd.cost_center_id,
  fd.revenue_center_id,
  fd.category_id,
  fd.external_reference
from public.financial_documents fd
left join public.business_units bu on bu.id = fd.business_unit_id
left join public.parties p on p.id = fd.party_id;

revoke all on public.reporting_posted_ledger_lines from public, anon;
revoke all on public.reporting_posted_cash_movements from public, anon;
revoke all on public.reporting_financial_documents from public, anon;

grant select on public.reporting_posted_ledger_lines to authenticated, service_role;
grant select on public.reporting_posted_cash_movements to authenticated, service_role;
grant select on public.reporting_financial_documents to authenticated, service_role;
