-- Every index below is the leading-key support for one existing foreign key.
-- Nullable workflow/audit references use partial indexes so null-heavy rows do
-- not add entries while PostgreSQL can still validate referenced parent rows.

-- Scheduling: parent filtering and referential checks for event ownership.
create index if not exists agenda_attendees_created_by_idx
  on public.agenda_event_attendees(created_by);
create index if not exists agenda_attendees_party_idx
  on public.agenda_event_attendees(party_id) where party_id is not null;
create index if not exists agenda_events_created_by_idx
  on public.agenda_events(created_by);
create index if not exists agenda_events_legal_entity_idx
  on public.agenda_events(legal_entity_id) where legal_entity_id is not null;

-- Compliance: assignee/state actors are independent foreign-key lookup paths.
create index if not exists compliance_occurrences_completed_by_idx
  on public.compliance_occurrences(completed_by) where completed_by is not null;
create index if not exists compliance_occurrences_created_by_idx
  on public.compliance_occurrences(created_by);
create index if not exists compliance_occurrences_responsible_user_idx
  on public.compliance_occurrences(responsible_user_id) where responsible_user_id is not null;
create index if not exists compliance_occurrences_waived_by_idx
  on public.compliance_occurrences(waived_by) where waived_by is not null;

-- Corporate ownership: ledger and workflow relationships are expected to grow
-- append-only and are traversed independently by integrity/RLS workflows.
create index if not exists corporate_contributions_structure_idx
  on public.corporate_capital_contributions(capital_structure_id);
create index if not exists corporate_contributions_created_by_idx
  on public.corporate_capital_contributions(created_by);
create index if not exists corporate_contributions_currency_idx
  on public.corporate_capital_contributions(currency_code);
create index if not exists corporate_contributions_evidence_idx
  on public.corporate_capital_contributions(evidence_document_id);
create index if not exists corporate_contributions_change_idx
  on public.corporate_capital_contributions(ownership_change_id);
create index if not exists corporate_contributions_reversed_by_idx
  on public.corporate_capital_contributions(reversed_by) where reversed_by is not null;
create index if not exists corporate_contributions_share_class_idx
  on public.corporate_capital_contributions(share_class_id) where share_class_id is not null;
create index if not exists corporate_contributions_updated_by_idx
  on public.corporate_capital_contributions(updated_by) where updated_by is not null;

create index if not exists corporate_structures_applied_by_idx
  on public.corporate_capital_structures(applied_by) where applied_by is not null;
create index if not exists corporate_structures_approved_by_idx
  on public.corporate_capital_structures(approved_by) where approved_by is not null;
create index if not exists corporate_structures_created_by_idx
  on public.corporate_capital_structures(created_by);
create index if not exists corporate_structures_currency_idx
  on public.corporate_capital_structures(currency_code);
create index if not exists corporate_structures_updated_by_idx
  on public.corporate_capital_structures(updated_by) where updated_by is not null;

create index if not exists corporate_change_lines_counterparty_idx
  on public.corporate_ownership_change_lines(counterparty_party_id)
  where counterparty_party_id is not null;
create index if not exists corporate_change_lines_created_by_idx
  on public.corporate_ownership_change_lines(created_by);
create index if not exists corporate_change_lines_holder_idx
  on public.corporate_ownership_change_lines(holder_party_id) where holder_party_id is not null;
create index if not exists corporate_change_lines_share_class_idx
  on public.corporate_ownership_change_lines(share_class_id) where share_class_id is not null;
create index if not exists corporate_change_lines_source_position_idx
  on public.corporate_ownership_change_lines(source_position_id) where source_position_id is not null;

create index if not exists corporate_changes_applied_by_idx
  on public.corporate_ownership_changes(applied_by) where applied_by is not null;
create index if not exists corporate_changes_approved_by_idx
  on public.corporate_ownership_changes(approved_by) where approved_by is not null;
create index if not exists corporate_changes_created_by_idx
  on public.corporate_ownership_changes(created_by);
create index if not exists corporate_changes_evidence_idx
  on public.corporate_ownership_changes(evidence_document_id) where evidence_document_id is not null;
create index if not exists corporate_changes_requested_by_idx
  on public.corporate_ownership_changes(requested_by);
create index if not exists corporate_changes_resolution_idx
  on public.corporate_ownership_changes(resolution_id) where resolution_id is not null;
create index if not exists corporate_changes_result_structure_idx
  on public.corporate_ownership_changes(resulting_capital_structure_id)
  where resulting_capital_structure_id is not null;
create index if not exists corporate_changes_reversed_by_idx
  on public.corporate_ownership_changes(reversed_by) where reversed_by is not null;
create index if not exists corporate_changes_source_structure_idx
  on public.corporate_ownership_changes(source_capital_structure_id)
  where source_capital_structure_id is not null;
create index if not exists corporate_changes_updated_by_idx
  on public.corporate_ownership_changes(updated_by) where updated_by is not null;

create index if not exists corporate_positions_created_by_idx
  on public.corporate_ownership_positions(created_by);
create index if not exists corporate_positions_evidence_idx
  on public.corporate_ownership_positions(evidence_document_id) where evidence_document_id is not null;
create index if not exists corporate_positions_share_class_idx
  on public.corporate_ownership_positions(share_class_id);
create index if not exists corporate_positions_updated_by_idx
  on public.corporate_ownership_positions(updated_by) where updated_by is not null;

create index if not exists corporate_roles_created_by_idx
  on public.corporate_ownership_roles(created_by);
create index if not exists corporate_roles_evidence_idx
  on public.corporate_ownership_roles(evidence_document_id) where evidence_document_id is not null;
create index if not exists corporate_roles_position_idx
  on public.corporate_ownership_roles(ownership_position_id) where ownership_position_id is not null;
create index if not exists corporate_roles_party_idx
  on public.corporate_ownership_roles(party_id);
create index if not exists corporate_roles_updated_by_idx
  on public.corporate_ownership_roles(updated_by) where updated_by is not null;

create index if not exists corporate_resolutions_approved_by_idx
  on public.corporate_resolutions(approved_by) where approved_by is not null;
create index if not exists corporate_resolutions_created_by_idx
  on public.corporate_resolutions(created_by);
create index if not exists corporate_resolutions_evidence_idx
  on public.corporate_resolutions(evidence_document_id) where evidence_document_id is not null;
create index if not exists corporate_resolutions_updated_by_idx
  on public.corporate_resolutions(updated_by) where updated_by is not null;

create index if not exists corporate_share_classes_created_by_idx
  on public.corporate_share_classes(created_by);
create index if not exists corporate_share_classes_updated_by_idx
  on public.corporate_share_classes(updated_by) where updated_by is not null;

-- Legal: support both sides of the Legal/IP junction and immutable provenance.
create index if not exists legal_matter_events_created_by_idx
  on public.legal_matter_events(created_by);
create index if not exists legal_matter_ip_assets_ip_asset_idx
  on public.legal_matter_intellectual_property_assets(intellectual_property_asset_id);
create index if not exists legal_matter_ip_assets_created_by_idx
  on public.legal_matter_intellectual_property_assets(created_by);
