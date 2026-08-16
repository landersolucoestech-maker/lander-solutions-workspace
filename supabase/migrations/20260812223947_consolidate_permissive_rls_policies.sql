-- Split ALL policies away from SELECT. The canonical read policies already
-- include manage/workflow permissions, so evaluating an ALL policy as a second
-- permissive SELECT branch only adds RLS work without granting distinct access.

drop policy if exists asset_assignments_manage on public.asset_assignments;
create policy asset_assignments_insert on public.asset_assignments
for insert to authenticated
with check (private.current_user_has_permission('assets.manage',private.asset_unit_code(asset_id)));
create policy asset_assignments_update on public.asset_assignments
for update to authenticated
using (private.current_user_has_permission('assets.manage',private.asset_unit_code(asset_id)))
with check (private.current_user_has_permission('assets.manage',private.asset_unit_code(asset_id)));
create policy asset_assignments_delete on public.asset_assignments
for delete to authenticated
using (private.current_user_has_permission('assets.manage',private.asset_unit_code(asset_id)));

drop policy if exists compliance_occurrences_manage on public.compliance_occurrences;
create policy compliance_occurrences_insert on public.compliance_occurrences
for insert to authenticated
with check (exists (
  select 1 from public.compliance_obligations obligation
  where obligation.id=compliance_occurrences.compliance_obligation_id
    and private.current_user_has_permission(
      'compliance.manage',private.governance_unit_code(obligation.business_unit_id)
    )
));
create policy compliance_occurrences_update on public.compliance_occurrences
for update to authenticated
using (exists (
  select 1 from public.compliance_obligations obligation
  where obligation.id=compliance_occurrences.compliance_obligation_id
    and private.current_user_has_permission(
      'compliance.manage',private.governance_unit_code(obligation.business_unit_id)
    )
))
with check (exists (
  select 1 from public.compliance_obligations obligation
  where obligation.id=compliance_occurrences.compliance_obligation_id
    and private.current_user_has_permission(
      'compliance.manage',private.governance_unit_code(obligation.business_unit_id)
    )
));
create policy compliance_occurrences_delete on public.compliance_occurrences
for delete to authenticated
using (exists (
  select 1 from public.compliance_obligations obligation
  where obligation.id=compliance_occurrences.compliance_obligation_id
    and private.current_user_has_permission(
      'compliance.manage',private.governance_unit_code(obligation.business_unit_id)
    )
));

drop policy if exists corporate_capital_structures_draft_manage on public.corporate_capital_structures;
create policy corporate_capital_structures_draft_insert on public.corporate_capital_structures
for insert to authenticated
with check (
  status='draft' and private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
);
create policy corporate_capital_structures_draft_update on public.corporate_capital_structures
for update to authenticated
using (
  status='draft' and private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
)
with check (
  status='draft' and private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
);
create policy corporate_capital_structures_draft_delete on public.corporate_capital_structures
for delete to authenticated
using (
  status='draft' and private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
);

drop policy if exists corporate_resolutions_draft_manage on public.corporate_resolutions;
create policy corporate_resolutions_draft_insert on public.corporate_resolutions
for insert to authenticated
with check (
  status='draft' and private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
);
create policy corporate_resolutions_draft_update on public.corporate_resolutions
for update to authenticated
using (
  status='draft' and private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
)
with check (
  status='draft' and private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
);
create policy corporate_resolutions_draft_delete on public.corporate_resolutions
for delete to authenticated
using (
  status='draft' and private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
);

drop policy if exists corporate_share_classes_draft_manage on public.corporate_share_classes;
create policy corporate_share_classes_draft_insert on public.corporate_share_classes
for insert to authenticated
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
  and exists (
    select 1 from public.corporate_capital_structures structure
    where structure.id=corporate_share_classes.capital_structure_id
      and structure.status='draft'
  )
);
create policy corporate_share_classes_draft_update on public.corporate_share_classes
for update to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
  and exists (
    select 1 from public.corporate_capital_structures structure
    where structure.id=corporate_share_classes.capital_structure_id
      and structure.status='draft'
  )
)
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
  and exists (
    select 1 from public.corporate_capital_structures structure
    where structure.id=corporate_share_classes.capital_structure_id
      and structure.status='draft'
  )
);
create policy corporate_share_classes_draft_delete on public.corporate_share_classes
for delete to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
  and exists (
    select 1 from public.corporate_capital_structures structure
    where structure.id=corporate_share_classes.capital_structure_id
      and structure.status='draft'
  )
);

drop policy if exists legal_matter_events_manage on public.legal_matter_events;
create policy legal_matter_events_insert on public.legal_matter_events
for insert to authenticated
with check (exists (
  select 1 from public.legal_matters matter
  where matter.id=legal_matter_events.legal_matter_id
    and private.current_user_has_permission(
      'legal.manage',private.governance_unit_code(matter.business_unit_id)
    )
));
create policy legal_matter_events_update on public.legal_matter_events
for update to authenticated
using (exists (
  select 1 from public.legal_matters matter
  where matter.id=legal_matter_events.legal_matter_id
    and private.current_user_has_permission(
      'legal.manage',private.governance_unit_code(matter.business_unit_id)
    )
))
with check (exists (
  select 1 from public.legal_matters matter
  where matter.id=legal_matter_events.legal_matter_id
    and private.current_user_has_permission(
      'legal.manage',private.governance_unit_code(matter.business_unit_id)
    )
));
create policy legal_matter_events_delete on public.legal_matter_events
for delete to authenticated
using (exists (
  select 1 from public.legal_matters matter
  where matter.id=legal_matter_events.legal_matter_id
    and private.current_user_has_permission(
      'legal.manage',private.governance_unit_code(matter.business_unit_id)
    )
));

drop policy if exists legal_matter_ip_assets_manage on public.legal_matter_intellectual_property_assets;
drop policy if exists legal_matter_ip_assets_read on public.legal_matter_intellectual_property_assets;
create policy legal_matter_ip_assets_read on public.legal_matter_intellectual_property_assets
for select to authenticated
using (exists (
  select 1 from public.legal_matters matter
  where matter.id=legal_matter_intellectual_property_assets.legal_matter_id
    and (
      private.current_user_has_permission(
        'legal.read',private.governance_unit_code(matter.business_unit_id)
      )
      or private.current_user_has_permission(
        'legal.manage',private.governance_unit_code(matter.business_unit_id)
      )
    )
));
create policy legal_matter_ip_assets_insert on public.legal_matter_intellectual_property_assets
for insert to authenticated
with check (exists (
  select 1 from public.legal_matters matter
  where matter.id=legal_matter_intellectual_property_assets.legal_matter_id
    and private.current_user_has_permission(
      'legal.manage',private.governance_unit_code(matter.business_unit_id)
    )
));
create policy legal_matter_ip_assets_update on public.legal_matter_intellectual_property_assets
for update to authenticated
using (exists (
  select 1 from public.legal_matters matter
  where matter.id=legal_matter_intellectual_property_assets.legal_matter_id
    and private.current_user_has_permission(
      'legal.manage',private.governance_unit_code(matter.business_unit_id)
    )
))
with check (exists (
  select 1 from public.legal_matters matter
  where matter.id=legal_matter_intellectual_property_assets.legal_matter_id
    and private.current_user_has_permission(
      'legal.manage',private.governance_unit_code(matter.business_unit_id)
    )
));
create policy legal_matter_ip_assets_delete on public.legal_matter_intellectual_property_assets
for delete to authenticated
using (exists (
  select 1 from public.legal_matters matter
  where matter.id=legal_matter_intellectual_property_assets.legal_matter_id
    and private.current_user_has_permission(
      'legal.manage',private.governance_unit_code(matter.business_unit_id)
    )
));

-- Governance documents are truly shared. Consolidate each command into one
-- policy whose expression is the exact OR of the domain and ownership paths.
drop policy if exists governance_documents_corporate_ownership_read on public.governance_documents;
drop policy if exists governance_documents_corporate_ownership_insert on public.governance_documents;
drop policy if exists governance_documents_corporate_ownership_update on public.governance_documents;
drop policy if exists governance_documents_corporate_ownership_delete on public.governance_documents;
drop policy if exists governance_documents_select on public.governance_documents;
drop policy if exists governance_documents_insert on public.governance_documents;
drop policy if exists governance_documents_update on public.governance_documents;
drop policy if exists governance_documents_delete on public.governance_documents;

create policy governance_documents_select on public.governance_documents
for select to authenticated
using (
  private.current_user_has_permission('assets.read',private.governance_document_unit_code(id))
  or private.current_user_has_permission('legal.read',private.governance_document_unit_code(id))
  or private.current_user_has_permission('compliance.read',private.governance_document_unit_code(id))
  or (
    (
      private.current_user_has_permission('corporate_ownership.read',null)
      or private.current_user_has_permission('corporate_ownership.manage',null)
      or private.current_user_has_permission('corporate_ownership.apply_changes',null)
    )
    and (
      num_nonnulls(asset_id,legal_matter_id,compliance_obligation_id)=0
      or exists (select 1 from public.corporate_ownership_changes item where item.evidence_document_id=governance_documents.id)
      or exists (select 1 from public.corporate_resolutions item where item.evidence_document_id=governance_documents.id)
      or exists (select 1 from public.corporate_ownership_positions item where item.evidence_document_id=governance_documents.id)
      or exists (select 1 from public.corporate_ownership_roles item where item.evidence_document_id=governance_documents.id)
      or exists (select 1 from public.corporate_capital_contributions item where item.evidence_document_id=governance_documents.id)
    )
  )
);

create policy governance_documents_insert on public.governance_documents
for insert to authenticated
with check (
  private.current_user_has_permission('governance.documents.manage',private.governance_unit_code(business_unit_id))
  or (
    num_nonnulls(asset_id,legal_matter_id,compliance_obligation_id)=0
    and private.current_user_has_aal2()
    and private.current_user_has_permission('corporate_ownership.manage',null)
    and created_by=auth.uid()
  )
);

create policy governance_documents_update on public.governance_documents
for update to authenticated
using (
  private.current_user_has_permission('governance.documents.manage',private.governance_document_unit_code(id))
  or (
    num_nonnulls(asset_id,legal_matter_id,compliance_obligation_id)=0
    and status in ('draft','active')
    and private.current_user_has_aal2()
    and private.current_user_has_permission('corporate_ownership.manage',null)
  )
)
with check (
  private.current_user_has_permission('governance.documents.manage',private.governance_unit_code(business_unit_id))
  or (
    num_nonnulls(asset_id,legal_matter_id,compliance_obligation_id)=0
    and status in ('draft','active')
    and private.current_user_has_aal2()
    and private.current_user_has_permission('corporate_ownership.manage',null)
  )
);

create policy governance_documents_delete on public.governance_documents
for delete to authenticated
using (
  (
    status in ('draft','expired','superseded','cancelled')
    and private.current_user_has_permission('governance.documents.manage',private.governance_document_unit_code(id))
  )
  or (
    num_nonnulls(asset_id,legal_matter_id,compliance_obligation_id)=0
    and status in ('draft','cancelled')
    and private.current_user_has_aal2()
    and private.current_user_has_permission('corporate_ownership.manage',null)
    and not exists (select 1 from public.corporate_ownership_changes item where item.evidence_document_id=governance_documents.id)
    and not exists (select 1 from public.corporate_resolutions item where item.evidence_document_id=governance_documents.id)
    and not exists (select 1 from public.corporate_ownership_positions item where item.evidence_document_id=governance_documents.id)
    and not exists (select 1 from public.corporate_ownership_roles item where item.evidence_document_id=governance_documents.id)
    and not exists (select 1 from public.corporate_capital_contributions item where item.evidence_document_id=governance_documents.id)
  )
);

drop policy if exists positions_organizational_read on public.positions;
drop policy if exists positions_select_hr on public.positions;
create policy positions_read on public.positions
for select to authenticated
using (
  deleted_at is null
  and (
    private.current_user_has_permission(
      'organizational_structure.read',private.unit_code_for_id(business_unit_id)
    )
    or private.current_user_has_permission(
      'organizational_structure.manage',private.unit_code_for_id(business_unit_id)
    )
    or development_private.has_permission(
      'hr.employees.read',private.unit_code_for_id(business_unit_id)
    )
    or development_private.has_permission(
      'hr.settings.manage',private.unit_code_for_id(business_unit_id)
    )
    or business_unit_id is null
  )
);
