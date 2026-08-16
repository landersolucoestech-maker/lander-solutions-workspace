-- Each dropped btree has the same table, ordered key columns and predicate as
-- the retained UNIQUE index listed beside it. Removing the duplicate reduces
-- write amplification without changing uniqueness or FK-prefix coverage.

drop index if exists public.bank_lines_import_idx;
-- retained: bank_statement_lines_statement_import_id_sequence_no_key

drop index if exists public.corporate_ownership_change_lines_change_idx;
-- retained: corporate_ownership_change_lines_change_sequence_key

drop index if exists public.policy_versions_policy_idx;
-- retained: corporate_policy_versions_policy_id_version_number_key

drop index if exists public.crm_project_scope_profile_idx;
-- retained: crm_project_scope_items_project_profile_id_sequence_no_key

drop index if exists public.crm_proposal_items_version_idx;
-- retained: crm_proposal_items_proposal_version_id_sequence_no_key

drop index if exists public.financial_adjustments_document_idx;
-- retained: financial_adjustments_adjustment_document_id_key

drop index if exists public.fiscal_documents_financial_idx;
-- retained: financial_fiscal_documents_financial_document_id_key

drop index if exists public.fiscal_events_document_idx;
-- retained: financial_fiscal_events_fiscal_document_id_sequence_no_key

drop index if exists public.ip_events_asset_idx;
-- retained: intellectual_property_events_intellectual_property_id_seque_key

drop index if exists public.legal_events_matter_idx;
-- retained: legal_matter_events_legal_matter_id_sequence_no_key

drop index if exists public.payout_payments_settlement_idx;
-- retained: payout_payments_financial_settlement_uidx
