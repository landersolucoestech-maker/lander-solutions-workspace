drop policy if exists products_select_authorized on public.products;
drop policy if exists products_insert_authorized on public.products;
drop policy if exists products_update_authorized on public.products;
drop policy if exists products_delete_authorized on public.products;
create policy products_organizational_read on public.products for select to authenticated
using (private.current_user_has_permission('organizational_structure.read',private.unit_code_for_id(business_unit_id)) or private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id)));
create policy products_organizational_insert on public.products for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id)));
create policy products_organizational_update on public.products for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id)))
with check (private.current_user_has_aal2() and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id)));
create policy products_organizational_delete on public.products for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id)));

drop policy if exists service_lines_select_authorized on public.service_lines;
drop policy if exists service_lines_insert_authorized on public.service_lines;
drop policy if exists service_lines_update_authorized on public.service_lines;
drop policy if exists service_lines_delete_authorized on public.service_lines;
create policy service_lines_organizational_read on public.service_lines for select to authenticated
using (private.current_user_has_permission('organizational_structure.read',private.unit_code_for_id(business_unit_id)) or private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id)));
create policy service_lines_organizational_insert on public.service_lines for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id)));
create policy service_lines_organizational_update on public.service_lines for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id)))
with check (private.current_user_has_aal2() and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id)));
create policy service_lines_organizational_delete on public.service_lines for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id)));

drop policy if exists projects_select_authorized on public.projects;
drop policy if exists projects_insert_authorized on public.projects;
drop policy if exists projects_update_authorized on public.projects;
drop policy if exists projects_delete_authorized on public.projects;
create policy projects_organizational_read on public.projects for select to authenticated
using (private.current_user_has_permission('organizational_structure.read',private.unit_code_for_id(business_unit_id)) or private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id)));
create policy projects_organizational_insert on public.projects for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id)));
create policy projects_organizational_update on public.projects for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id)))
with check (private.current_user_has_aal2() and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id)));
create policy projects_organizational_delete on public.projects for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id)));
