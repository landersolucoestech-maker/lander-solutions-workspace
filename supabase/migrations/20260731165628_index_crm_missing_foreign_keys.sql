create index crm_leads_created_by_idx on public.crm_leads(created_by);
create index crm_leads_currency_idx on public.crm_leads(preferred_currency_code);
create index crm_opportunities_created_by_idx on public.crm_opportunities(created_by);
create index crm_opportunities_currency_idx on public.crm_opportunities(currency_code);
create index crm_opportunities_stage_idx on public.crm_opportunities(stage_id);
create index crm_proposals_created_by_idx on public.crm_proposals(created_by);