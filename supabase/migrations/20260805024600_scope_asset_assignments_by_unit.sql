-- Scope canonical equipment assets and assignments by business unit.

create or replace function private.asset_unit_code(p_asset_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select bu.code
  from public.corporate_assets a
  left join public.business_units bu on bu.id = a.business_unit_id
  where a.id = p_asset_id
$$;

revoke all on function private.asset_unit_code(uuid) from public;
grant execute on function private.asset_unit_code(uuid) to authenticated;
grant execute on function private.asset_unit_code(uuid) to service_role;

drop policy asset_assignments_read on public.asset_assignments;
drop policy asset_assignments_manage on public.asset_assignments;

create policy asset_assignments_read
on public.asset_assignments for select to authenticated
using (
  private.current_user_has_permission('assets.read', private.asset_unit_code(asset_id))
  or private.current_user_has_permission('assets.manage', private.asset_unit_code(asset_id))
  or private.current_user_has_permission('assets.approve_events', private.asset_unit_code(asset_id))
  or private.current_user_has_permission('hr.equipment.manage', private.asset_unit_code(asset_id))
);

create policy asset_assignments_manage
on public.asset_assignments for all to authenticated
using (
  private.current_user_has_permission('assets.manage', private.asset_unit_code(asset_id))
  or private.current_user_has_permission('hr.equipment.manage', private.asset_unit_code(asset_id))
)
with check (
  private.current_user_has_permission('assets.manage', private.asset_unit_code(asset_id))
  or private.current_user_has_permission('hr.equipment.manage', private.asset_unit_code(asset_id))
);

create policy corporate_assets_hr_equipment_select
on public.corporate_assets for select to authenticated
using (
  asset_category = 'equipment'
  and private.current_user_has_permission('hr.equipment.manage', private.governance_unit_code(business_unit_id))
);

create policy corporate_assets_hr_equipment_insert
on public.corporate_assets for insert to authenticated
with check (
  asset_category = 'equipment'
  and private.current_user_has_permission('hr.equipment.manage', private.governance_unit_code(business_unit_id))
);

create policy corporate_assets_hr_equipment_update
on public.corporate_assets for update to authenticated
using (
  asset_category = 'equipment'
  and private.current_user_has_permission('hr.equipment.manage', private.governance_unit_code(business_unit_id))
)
with check (
  asset_category = 'equipment'
  and private.current_user_has_permission('hr.equipment.manage', private.governance_unit_code(business_unit_id))
);
