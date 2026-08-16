create index if not exists role_permissions_permission_idx
  on public.role_permissions(permission_id);

create index if not exists user_role_assignments_granted_by_idx
  on public.user_role_assignments(granted_by)
  where granted_by is not null;

create index if not exists user_role_assignments_revoked_by_idx
  on public.user_role_assignments(revoked_by)
  where revoked_by is not null;

drop policy if exists profiles_select_own_or_authorized on public.profiles;
create policy profiles_select_own_or_authorized
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or private.current_user_has_permission('access.users.read', null)
);

drop policy if exists assignments_select_own_or_authorized on public.user_role_assignments;
create policy assignments_select_own_or_authorized
on public.user_role_assignments
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.current_user_has_permission('access.users.read', unit_code)
);

drop policy if exists app_roles_manage_authorized on public.app_roles;
create policy app_roles_insert_authorized
on public.app_roles
for insert
to authenticated
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('access.roles.manage', null)
);
create policy app_roles_update_authorized
on public.app_roles
for update
to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('access.roles.manage', null)
)
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('access.roles.manage', null)
);
create policy app_roles_delete_authorized
on public.app_roles
for delete
to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('access.roles.manage', null)
);

drop policy if exists permissions_manage_authorized on public.permissions;
create policy permissions_insert_authorized
on public.permissions
for insert
to authenticated
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('access.roles.manage', null)
);
create policy permissions_update_authorized
on public.permissions
for update
to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('access.roles.manage', null)
)
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('access.roles.manage', null)
);
create policy permissions_delete_authorized
on public.permissions
for delete
to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('access.roles.manage', null)
);

drop policy if exists role_permissions_manage_authorized on public.role_permissions;
create policy role_permissions_insert_authorized
on public.role_permissions
for insert
to authenticated
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('access.roles.manage', null)
);
create policy role_permissions_delete_authorized
on public.role_permissions
for delete
to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('access.roles.manage', null)
);

drop policy if exists assignments_manage_authorized on public.user_role_assignments;
create policy assignments_insert_authorized
on public.user_role_assignments
for insert
to authenticated
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('access.roles.manage', unit_code)
);
create policy assignments_update_authorized
on public.user_role_assignments
for update
to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('access.roles.manage', unit_code)
)
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('access.roles.manage', unit_code)
);
create policy assignments_delete_authorized
on public.user_role_assignments
for delete
to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('access.roles.manage', unit_code)
);
