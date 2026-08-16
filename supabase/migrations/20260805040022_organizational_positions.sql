drop policy if exists positions_organizational_read on public.positions;
drop policy if exists positions_organizational_insert on public.positions;
drop policy if exists positions_organizational_update on public.positions;
drop policy if exists positions_organizational_delete on public.positions;

create policy positions_organizational_read
on public.positions for select to authenticated
using (
  deleted_at is null
  and (
    private.current_user_has_permission('organizational_structure.read',private.unit_code_for_id(business_unit_id))
    or private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id))
  )
);

create policy positions_organizational_insert
on public.positions for insert to authenticated
with check (
  private.current_user_has_aal2()
  and deleted_at is null
  and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id))
);

create policy positions_organizational_update
on public.positions for update to authenticated
using (
  private.current_user_has_aal2()
  and deleted_at is null
  and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id))
)
with check (
  private.current_user_has_aal2()
  and deleted_at is null
  and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id))
);

create policy positions_organizational_delete
on public.positions for delete to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('organizational_structure.manage',private.unit_code_for_id(business_unit_id))
);

comment on table public.positions
is 'Organizational positions. HR consumes this master but does not own a duplicate position registry.';
