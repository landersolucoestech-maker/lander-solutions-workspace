-- Separate Corporate Policies permissions from Compliance permissions.

insert into public.permissions (code,module,action,description)
values ('policies.read','policies','read','Consultar políticas corporativas e suas versões.')
on conflict (code) do update
set module=excluded.module,action=excluded.action,description=excluded.description;

insert into public.role_permissions (role_id,permission_id)
select distinct source_roles.role_id,target.id
from public.role_permissions source_roles
join public.permissions source on source.id=source_roles.permission_id
join public.permissions target on target.code='policies.read'
where source.code in ('policies.manage','policies.approve','policies.publish','compliance.manage','compliance.read')
on conflict do nothing;

insert into public.role_permissions (role_id,permission_id)
select distinct source_roles.role_id,target.id
from public.role_permissions source_roles
join public.permissions source on source.id=source_roles.permission_id
join public.permissions target on target.code='policies.manage'
where source.code='compliance.manage'
on conflict do nothing;

drop policy if exists corporate_policies_all on public.corporate_policies;
create policy corporate_policies_read
on public.corporate_policies for select to authenticated
using (
  private.current_user_has_permission('policies.read',private.governance_unit_code(business_unit_id))
  or private.current_user_has_permission('policies.manage',private.governance_unit_code(business_unit_id))
  or private.current_user_has_permission('policies.approve',private.governance_unit_code(business_unit_id))
  or private.current_user_has_permission('policies.publish',private.governance_unit_code(business_unit_id))
);
create policy corporate_policies_insert
on public.corporate_policies for insert to authenticated
with check (
  status='draft'
  and private.current_user_has_permission('policies.manage',private.governance_unit_code(business_unit_id))
);
create policy corporate_policies_update
on public.corporate_policies for update to authenticated
using (
  status in ('draft','active','inactive','archived')
  and private.current_user_has_permission('policies.manage',private.governance_unit_code(business_unit_id))
)
with check (
  private.current_user_has_permission('policies.manage',private.governance_unit_code(business_unit_id))
);
create policy corporate_policies_delete
on public.corporate_policies for delete to authenticated
using (
  status in ('draft','archived')
  and current_version_id is null
  and private.current_user_has_permission('policies.manage',private.governance_unit_code(business_unit_id))
);

drop policy if exists policy_versions_all on public.corporate_policy_versions;
create policy corporate_policy_versions_read
on public.corporate_policy_versions for select to authenticated
using (
  exists (
    select 1 from public.corporate_policies p
    where p.id=corporate_policy_versions.policy_id
      and (
        private.current_user_has_permission('policies.read',private.governance_unit_code(p.business_unit_id))
        or private.current_user_has_permission('policies.manage',private.governance_unit_code(p.business_unit_id))
        or private.current_user_has_permission('policies.approve',private.governance_unit_code(p.business_unit_id))
        or private.current_user_has_permission('policies.publish',private.governance_unit_code(p.business_unit_id))
      )
  )
);
create policy corporate_policy_versions_insert
on public.corporate_policy_versions for insert to authenticated
with check (
  status='draft'
  and exists (
    select 1 from public.corporate_policies p
    where p.id=corporate_policy_versions.policy_id
      and private.current_user_has_permission('policies.manage',private.governance_unit_code(p.business_unit_id))
  )
);
create policy corporate_policy_versions_update
on public.corporate_policy_versions for update to authenticated
using (
  status in ('draft','rejected')
  and exists (
    select 1 from public.corporate_policies p
    where p.id=corporate_policy_versions.policy_id
      and private.current_user_has_permission('policies.manage',private.governance_unit_code(p.business_unit_id))
  )
)
with check (
  status in ('draft','rejected')
  and exists (
    select 1 from public.corporate_policies p
    where p.id=corporate_policy_versions.policy_id
      and private.current_user_has_permission('policies.manage',private.governance_unit_code(p.business_unit_id))
  )
);
create policy corporate_policy_versions_delete
on public.corporate_policy_versions for delete to authenticated
using (
  status in ('draft','rejected')
  and exists (
    select 1 from public.corporate_policies p
    where p.id=corporate_policy_versions.policy_id
      and private.current_user_has_permission('policies.manage',private.governance_unit_code(p.business_unit_id))
  )
);

revoke all on public.corporate_policies from anon;
revoke all on public.corporate_policy_versions from anon;
