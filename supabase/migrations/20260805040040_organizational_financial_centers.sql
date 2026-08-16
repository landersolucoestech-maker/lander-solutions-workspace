-- Cost and revenue centers are organizational masters. Finance keeps read-only
-- consumer access for classification, allocation and reporting.

drop policy if exists cost_centers_select_authorized on public.cost_centers;
drop policy if exists cost_centers_insert_authorized on public.cost_centers;
drop policy if exists cost_centers_update_authorized on public.cost_centers;
drop policy if exists cost_centers_delete_authorized on public.cost_centers;
create policy cost_centers_organizational_read on public.cost_centers for select to authenticated
using (
  private.current_user_has_permission('organizational_structure.read',private.unit_code_for_id(business_unit_id))
  or private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id))
  or private.current_user_has_permission('finance.read',private.unit_code_for_id(business_unit_id))
  or private.current_user_has_permission('finance.manage',private.unit_code_for_id(business_unit_id))
);
create policy cost_centers_organizational_insert on public.cost_centers for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id)));
create policy cost_centers_organizational_update on public.cost_centers for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id)))
with check (private.current_user_has_aal2() and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id)));
create policy cost_centers_organizational_delete on public.cost_centers for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id)));

drop policy if exists revenue_centers_select_authorized on public.revenue_centers;
drop policy if exists revenue_centers_insert_authorized on public.revenue_centers;
drop policy if exists revenue_centers_update_authorized on public.revenue_centers;
drop policy if exists revenue_centers_delete_authorized on public.revenue_centers;
create policy revenue_centers_organizational_read on public.revenue_centers for select to authenticated
using (
  private.current_user_has_permission('organizational_structure.read',private.unit_code_for_id(business_unit_id))
  or private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id))
  or private.current_user_has_permission('finance.read',private.unit_code_for_id(business_unit_id))
  or private.current_user_has_permission('finance.manage',private.unit_code_for_id(business_unit_id))
);
create policy revenue_centers_organizational_insert on public.revenue_centers for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id)));
create policy revenue_centers_organizational_update on public.revenue_centers for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id)))
with check (private.current_user_has_aal2() and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id)));
create policy revenue_centers_organizational_delete on public.revenue_centers for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id)));

comment on table public.cost_centers
is 'Organizational management master consumed by finance for cost classification and allocation.';
comment on table public.revenue_centers
is 'Organizational management master consumed by finance for revenue classification.';
