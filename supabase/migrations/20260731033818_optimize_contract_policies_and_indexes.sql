create index contracts_created_by_idx on public.contracts(created_by);

drop policy contract_formula_components_manage on public.contract_formula_components;
create policy contract_formula_components_insert on public.contract_formula_components
for insert to authenticated
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('contracts.update_draft', private.contract_version_unit_code(contract_version_id))
);
create policy contract_formula_components_update on public.contract_formula_components
for update to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('contracts.update_draft', private.contract_version_unit_code(contract_version_id))
)
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('contracts.update_draft', private.contract_version_unit_code(contract_version_id))
);
create policy contract_formula_components_delete on public.contract_formula_components
for delete to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('contracts.update_draft', private.contract_version_unit_code(contract_version_id))
);

drop policy contract_version_participants_manage on public.contract_version_participants;
create policy contract_version_participants_insert on public.contract_version_participants
for insert to authenticated
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('contracts.update_draft', private.contract_version_unit_code(contract_version_id))
);
create policy contract_version_participants_update on public.contract_version_participants
for update to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('contracts.update_draft', private.contract_version_unit_code(contract_version_id))
)
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('contracts.update_draft', private.contract_version_unit_code(contract_version_id))
);
create policy contract_version_participants_delete on public.contract_version_participants
for delete to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('contracts.update_draft', private.contract_version_unit_code(contract_version_id))
);

drop policy contract_obligations_manage on public.contract_obligations;
create policy contract_obligations_insert on public.contract_obligations
for insert to authenticated
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('contracts.update_draft', private.contract_version_unit_code(contract_version_id))
);
create policy contract_obligations_update on public.contract_obligations
for update to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('contracts.update_draft', private.contract_version_unit_code(contract_version_id))
)
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('contracts.update_draft', private.contract_version_unit_code(contract_version_id))
);
create policy contract_obligations_delete on public.contract_obligations
for delete to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('contracts.update_draft', private.contract_version_unit_code(contract_version_id))
);

drop policy contract_documents_manage on public.contract_documents;
create policy contract_documents_insert on public.contract_documents
for insert to authenticated
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('contracts.documents.manage', private.contract_version_unit_code(contract_version_id))
);
create policy contract_documents_update on public.contract_documents
for update to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('contracts.documents.manage', private.contract_version_unit_code(contract_version_id))
)
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('contracts.documents.manage', private.contract_version_unit_code(contract_version_id))
);
create policy contract_documents_delete on public.contract_documents
for delete to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('contracts.documents.manage', private.contract_version_unit_code(contract_version_id))
);
