drop policy if exists departments_select_authorized on public.departments;
drop policy if exists departments_insert_authorized on public.departments;
drop policy if exists departments_update_authorized on public.departments;
drop policy if exists departments_delete_authorized on public.departments;

create policy departments_organizational_read
on public.departments for select to authenticated
using (
  private.current_user_has_permission('organizational_structure.read',private.unit_code_for_id(business_unit_id))
  or private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id))
);

create policy departments_organizational_insert
on public.departments for insert to authenticated
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id))
);

create policy departments_organizational_update
on public.departments for update to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id))
)
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id))
);

create policy departments_organizational_delete
on public.departments for delete to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id))
);
