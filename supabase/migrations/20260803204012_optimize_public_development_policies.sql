create index if not exists contract_templates_created_by_idx
  on public.contract_templates (created_by);

create index if not exists contract_templates_updated_by_idx
  on public.contract_templates (updated_by);

create index if not exists financial_fiscal_documents_party_idx
  on public.financial_fiscal_documents (party_id);

-- The broad dev_public_read policy introduced by the authentication-disabled
-- development runtime supersedes these narrower anonymous SELECT policies.
-- Keep mutation and Storage policies unchanged.
drop policy if exists dev_public_fiscal_documents_select
  on public.financial_fiscal_documents;
drop policy if exists dev_public_fiscal_events_select
  on public.financial_fiscal_events;
drop policy if exists dev_public_fiscal_items_select
  on public.financial_fiscal_document_items;
drop policy if exists dev_public_financial_documents_select
  on public.financial_documents;
drop policy if exists dev_public_parties_select
  on public.parties;
drop policy if exists dev_public_party_contacts_select
  on public.party_contacts;
drop policy if exists dev_public_party_addresses_select
  on public.party_addresses;
drop policy if exists dev_public_business_units_select
  on public.business_units;
drop policy if exists dev_public_legal_entities_select
  on public.legal_entities;
