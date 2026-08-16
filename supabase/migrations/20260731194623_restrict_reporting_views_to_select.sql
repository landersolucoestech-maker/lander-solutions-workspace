revoke all privileges on public.reporting_posted_ledger_lines from authenticated, service_role;
revoke all privileges on public.reporting_posted_cash_movements from authenticated, service_role;
revoke all privileges on public.reporting_financial_documents from authenticated, service_role;

grant select on public.reporting_posted_ledger_lines to authenticated, service_role;
grant select on public.reporting_posted_cash_movements to authenticated, service_role;
grant select on public.reporting_financial_documents to authenticated, service_role;
