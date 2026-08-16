drop policy if exists bank_lines_select on public.bank_statement_lines;
create policy bank_lines_select
on public.bank_statement_lines
for select
to authenticated
using (
  private.current_user_has_permission(
    'reconciliation.read',
    private.unit_code_for_id(business_unit_id)
  )
);

drop policy if exists cash_accounts_select on public.cash_accounts;
create policy cash_accounts_select
on public.cash_accounts
for select
to authenticated
using (
  private.current_user_has_permission(
    'finance.read',
    private.unit_code_for_id(business_unit_id)
  )
);

drop policy if exists crm_lead_diagnostics_manage on public.crm_lead_diagnostic_requests;

create policy crm_lead_diagnostics_insert
on public.crm_lead_diagnostic_requests
for insert
to authenticated
with check (
  exists (
    select 1
    from public.crm_leads l
    where l.id = crm_lead_diagnostic_requests.lead_id
      and private.current_user_has_permission(
        'crm.leads.manage',
        private.unit_code_for_id(l.business_unit_id)
      )
  )
);

create policy crm_lead_diagnostics_update
on public.crm_lead_diagnostic_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.crm_leads l
    where l.id = crm_lead_diagnostic_requests.lead_id
      and private.current_user_has_permission(
        'crm.leads.manage',
        private.unit_code_for_id(l.business_unit_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.crm_leads l
    where l.id = crm_lead_diagnostic_requests.lead_id
      and private.current_user_has_permission(
        'crm.leads.manage',
        private.unit_code_for_id(l.business_unit_id)
      )
  )
);

create policy crm_lead_diagnostics_delete
on public.crm_lead_diagnostic_requests
for delete
to authenticated
using (
  exists (
    select 1
    from public.crm_leads l
    where l.id = crm_lead_diagnostic_requests.lead_id
      and private.current_user_has_permission(
        'crm.leads.manage',
        private.unit_code_for_id(l.business_unit_id)
      )
  )
);

drop policy if exists crm_lead_services_manage on public.crm_lead_services;

create policy crm_lead_services_insert
on public.crm_lead_services
for insert
to authenticated
with check (
  exists (
    select 1
    from public.crm_leads l
    where l.id = crm_lead_services.lead_id
      and private.current_user_has_permission(
        'crm.leads.manage',
        private.unit_code_for_id(l.business_unit_id)
      )
  )
);

create policy crm_lead_services_update
on public.crm_lead_services
for update
to authenticated
using (
  exists (
    select 1
    from public.crm_leads l
    where l.id = crm_lead_services.lead_id
      and private.current_user_has_permission(
        'crm.leads.manage',
        private.unit_code_for_id(l.business_unit_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.crm_leads l
    where l.id = crm_lead_services.lead_id
      and private.current_user_has_permission(
        'crm.leads.manage',
        private.unit_code_for_id(l.business_unit_id)
      )
  )
);

create policy crm_lead_services_delete
on public.crm_lead_services
for delete
to authenticated
using (
  exists (
    select 1
    from public.crm_leads l
    where l.id = crm_lead_services.lead_id
      and private.current_user_has_permission(
        'crm.leads.manage',
        private.unit_code_for_id(l.business_unit_id)
      )
  )
);

notify pgrst, 'reload schema';
