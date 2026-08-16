-- RLS and grants for the canonical corporate ownership domain.

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'corporate_capital_structures','corporate_share_classes','corporate_ownership_roles',
    'corporate_ownership_positions','corporate_ownership_changes','corporate_ownership_change_lines',
    'corporate_resolutions','corporate_capital_contributions'
  ] loop
    execute format('alter table public.%I enable row level security',v_table);
    execute format('drop policy if exists dev_public_read on public.%I',v_table);
    execute format('revoke all on public.%I from anon',v_table);
    execute format('revoke all on public.%I from authenticated',v_table);
  end loop;
end;
$$;

drop policy if exists corporate_capital_structures_manage on public.corporate_capital_structures;
drop policy if exists corporate_capital_structures_read on public.corporate_capital_structures;
drop policy if exists corporate_capital_structures_draft_manage on public.corporate_capital_structures;
create policy corporate_capital_structures_read on public.corporate_capital_structures
for select to authenticated using (
  private.current_user_has_permission('corporate_ownership.read',null)
  or private.current_user_has_permission('corporate_ownership.manage',null)
  or private.current_user_has_permission('corporate_ownership.apply_changes',null)
);
create policy corporate_capital_structures_draft_manage on public.corporate_capital_structures
for all to authenticated
using (
  status='draft'
  and private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
)
with check (
  status='draft'
  and private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
);

drop policy if exists corporate_share_classes_manage on public.corporate_share_classes;
drop policy if exists corporate_share_classes_read on public.corporate_share_classes;
drop policy if exists corporate_share_classes_draft_manage on public.corporate_share_classes;
create policy corporate_share_classes_read on public.corporate_share_classes
for select to authenticated using (
  private.current_user_has_permission('corporate_ownership.read',null)
  or private.current_user_has_permission('corporate_ownership.manage',null)
  or private.current_user_has_permission('corporate_ownership.apply_changes',null)
);
create policy corporate_share_classes_draft_manage on public.corporate_share_classes
for all to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
  and exists (
    select 1 from public.corporate_capital_structures structure
    where structure.id=capital_structure_id and structure.status='draft'
  )
)
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
  and exists (
    select 1 from public.corporate_capital_structures structure
    where structure.id=capital_structure_id and structure.status='draft'
  )
);

drop policy if exists corporate_ownership_roles_manage on public.corporate_ownership_roles;
drop policy if exists corporate_ownership_roles_read on public.corporate_ownership_roles;
create policy corporate_ownership_roles_read on public.corporate_ownership_roles
for select to authenticated using (
  private.current_user_has_permission('corporate_ownership.read',null)
  or private.current_user_has_permission('corporate_ownership.manage',null)
  or private.current_user_has_permission('corporate_ownership.apply_changes',null)
);

drop policy if exists corporate_ownership_positions_manage on public.corporate_ownership_positions;
drop policy if exists corporate_ownership_positions_read on public.corporate_ownership_positions;
create policy corporate_ownership_positions_read on public.corporate_ownership_positions
for select to authenticated using (
  private.current_user_has_permission('corporate_ownership.read',null)
  or private.current_user_has_permission('corporate_ownership.manage',null)
  or private.current_user_has_permission('corporate_ownership.apply_changes',null)
);

drop policy if exists corporate_ownership_changes_read on public.corporate_ownership_changes;
drop policy if exists corporate_ownership_changes_insert on public.corporate_ownership_changes;
drop policy if exists corporate_ownership_changes_update on public.corporate_ownership_changes;
drop policy if exists corporate_ownership_changes_delete on public.corporate_ownership_changes;
drop policy if exists corporate_ownership_changes_update_draft on public.corporate_ownership_changes;
drop policy if exists corporate_ownership_changes_delete_draft on public.corporate_ownership_changes;
create policy corporate_ownership_changes_read on public.corporate_ownership_changes
for select to authenticated using (
  private.current_user_has_permission('corporate_ownership.read',null)
  or private.current_user_has_permission('corporate_ownership.manage',null)
  or private.current_user_has_permission('corporate_ownership.apply_changes',null)
);
create policy corporate_ownership_changes_insert on public.corporate_ownership_changes
for insert to authenticated with check (
  status='draft'
  and requested_by=auth.uid()
  and created_by=auth.uid()
  and private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
);
create policy corporate_ownership_changes_update_draft on public.corporate_ownership_changes
for update to authenticated
using (
  status='draft'
  and private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
)
with check (
  status='draft'
  and private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
);
create policy corporate_ownership_changes_delete_draft on public.corporate_ownership_changes
for delete to authenticated
using (
  status='draft'
  and private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
);

drop policy if exists corporate_ownership_change_lines_manage on public.corporate_ownership_change_lines;
drop policy if exists corporate_ownership_change_lines_read on public.corporate_ownership_change_lines;
drop policy if exists corporate_ownership_change_lines_insert on public.corporate_ownership_change_lines;
drop policy if exists corporate_ownership_change_lines_update on public.corporate_ownership_change_lines;
drop policy if exists corporate_ownership_change_lines_delete on public.corporate_ownership_change_lines;
create policy corporate_ownership_change_lines_read on public.corporate_ownership_change_lines
for select to authenticated using (
  private.current_user_has_permission('corporate_ownership.read',null)
  or private.current_user_has_permission('corporate_ownership.manage',null)
  or private.current_user_has_permission('corporate_ownership.apply_changes',null)
);
create policy corporate_ownership_change_lines_insert on public.corporate_ownership_change_lines
for insert to authenticated with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
  and created_by=auth.uid()
  and exists (
    select 1 from public.corporate_ownership_changes ownership_change
    where ownership_change.id=change_id and ownership_change.status='draft'
  )
);
create policy corporate_ownership_change_lines_update on public.corporate_ownership_change_lines
for update to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
  and exists (
    select 1 from public.corporate_ownership_changes ownership_change
    where ownership_change.id=change_id and ownership_change.status='draft'
  )
)
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
  and exists (
    select 1 from public.corporate_ownership_changes ownership_change
    where ownership_change.id=change_id and ownership_change.status='draft'
  )
);
create policy corporate_ownership_change_lines_delete on public.corporate_ownership_change_lines
for delete to authenticated using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
  and exists (
    select 1 from public.corporate_ownership_changes ownership_change
    where ownership_change.id=change_id and ownership_change.status='draft'
  )
);

drop policy if exists corporate_resolutions_manage on public.corporate_resolutions;
drop policy if exists corporate_resolutions_read on public.corporate_resolutions;
create policy corporate_resolutions_read on public.corporate_resolutions
for select to authenticated using (
  private.current_user_has_permission('corporate_ownership.read',null)
  or private.current_user_has_permission('corporate_ownership.manage',null)
  or private.current_user_has_permission('corporate_ownership.apply_changes',null)
);
create policy corporate_resolutions_manage on public.corporate_resolutions
for all to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
)
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
);

drop policy if exists corporate_capital_contributions_read on public.corporate_capital_contributions;
create policy corporate_capital_contributions_read on public.corporate_capital_contributions
for select to authenticated using (
  private.current_user_has_permission('corporate_ownership.read',null)
  or private.current_user_has_permission('corporate_ownership.manage',null)
  or private.current_user_has_permission('corporate_ownership.apply_changes',null)
);

drop policy if exists governance_documents_corporate_ownership_read on public.governance_documents;
create policy governance_documents_corporate_ownership_read on public.governance_documents
for select to authenticated using (
  (
    private.current_user_has_permission('corporate_ownership.read',null)
    or private.current_user_has_permission('corporate_ownership.manage',null)
    or private.current_user_has_permission('corporate_ownership.apply_changes',null)
  )
  and (
    num_nonnulls(asset_id,legal_matter_id,compliance_obligation_id)=0
    or exists (select 1 from public.corporate_ownership_changes ownership_change where ownership_change.evidence_document_id=governance_documents.id)
    or exists (select 1 from public.corporate_resolutions resolution where resolution.evidence_document_id=governance_documents.id)
    or exists (select 1 from public.corporate_ownership_positions position where position.evidence_document_id=governance_documents.id)
    or exists (select 1 from public.corporate_ownership_roles ownership_role where ownership_role.evidence_document_id=governance_documents.id)
    or exists (select 1 from public.corporate_capital_contributions contribution where contribution.evidence_document_id=governance_documents.id)
  )
);

grant select,insert,update,delete on public.corporate_capital_structures to authenticated;
grant select,insert,update,delete on public.corporate_share_classes to authenticated;
grant select on public.corporate_ownership_roles to authenticated;
grant select on public.corporate_ownership_positions to authenticated;
grant select,insert,update,delete on public.corporate_ownership_changes to authenticated;
grant select,insert,update,delete on public.corporate_ownership_change_lines to authenticated;
grant select,insert,update,delete on public.corporate_resolutions to authenticated;
grant select on public.corporate_capital_contributions to authenticated;
