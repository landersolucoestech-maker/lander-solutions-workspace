drop policy allocation_targets_manage on public.allocation_rule_targets;
create policy allocation_targets_insert on public.allocation_rule_targets
for insert to authenticated
with check (private.current_user_has_permission('allocation.manage',private.allocation_version_unit_code(allocation_rule_version_id)));
create policy allocation_targets_update on public.allocation_rule_targets
for update to authenticated
using (private.current_user_has_permission('allocation.manage',private.allocation_version_unit_code(allocation_rule_version_id)))
with check (private.current_user_has_permission('allocation.manage',private.allocation_version_unit_code(allocation_rule_version_id)));
create policy allocation_targets_delete on public.allocation_rule_targets
for delete to authenticated
using (private.current_user_has_permission('allocation.manage',private.allocation_version_unit_code(allocation_rule_version_id)));

drop policy allocation_drivers_manage on public.allocation_driver_values;
create policy allocation_drivers_insert on public.allocation_driver_values
for insert to authenticated
with check (private.current_user_has_permission('allocation.manage',private.allocation_version_unit_code(allocation_rule_version_id)));
create policy allocation_drivers_update on public.allocation_driver_values
for update to authenticated
using (private.current_user_has_permission('allocation.manage',private.allocation_version_unit_code(allocation_rule_version_id)))
with check (private.current_user_has_permission('allocation.manage',private.allocation_version_unit_code(allocation_rule_version_id)));
create policy allocation_drivers_delete on public.allocation_driver_values
for delete to authenticated
using (private.current_user_has_permission('allocation.manage',private.allocation_version_unit_code(allocation_rule_version_id)));

drop policy allocation_sources_manage on public.allocation_run_sources;
create policy allocation_sources_insert on public.allocation_run_sources
for insert to authenticated
with check (private.current_user_has_permission('allocation.manage',private.allocation_run_unit_code(allocation_run_id)));
create policy allocation_sources_update on public.allocation_run_sources
for update to authenticated
using (private.current_user_has_permission('allocation.manage',private.allocation_run_unit_code(allocation_run_id)))
with check (private.current_user_has_permission('allocation.manage',private.allocation_run_unit_code(allocation_run_id)));
create policy allocation_sources_delete on public.allocation_run_sources
for delete to authenticated
using (private.current_user_has_permission('allocation.manage',private.allocation_run_unit_code(allocation_run_id)));
