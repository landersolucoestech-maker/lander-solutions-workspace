-- Propriedade Intelectual owns its authorization independently from Legal.
insert into public.permissions (code,module,action,description) values
  ('ip.read','ip','read','Consultar ativos e eventos de propriedade intelectual'),
  ('ip.manage','ip','manage','Criar, editar e excluir ativos e eventos de propriedade intelectual')
on conflict (code) do update set
  module=excluded.module,
  action=excluded.action,
  description=excluded.description;

update public.permissions
set
  module='ip',
  action='approve',
  description='Aprovar ou rejeitar eventos de propriedade intelectual'
where code='ip.approve';

-- Preserve legitimate PI administration explicitly. The finance_manager role
-- is intentionally excluded: its historical legal.manage grant is not PI ownership.
insert into public.role_permissions (role_id,permission_id)
select r.id,p.id
from public.app_roles r
cross join public.permissions p
where r.code in ('owner','corporate_admin','legal')
  and p.code in ('ip.read','ip.manage')
on conflict do nothing;

-- Preserve the existing approval assignment without broadening approvers.
insert into public.role_permissions (role_id,permission_id)
select r.id,p.id
from public.app_roles r
cross join public.permissions p
where r.code in ('owner','corporate_admin')
  and p.code='ip.approve'
on conflict do nothing;

drop policy if exists ip_assets_all on public.intellectual_property_assets;
drop policy if exists ip_events_all on public.intellectual_property_events;

create policy ip_assets_select
on public.intellectual_property_assets
for select to authenticated
using (
  private.current_user_has_permission(
    'ip.read',
    private.governance_unit_code(business_unit_id)
  )
  or private.current_user_has_permission(
    'ip.manage',
    private.governance_unit_code(business_unit_id)
  )
);

create policy ip_assets_insert
on public.intellectual_property_assets
for insert to authenticated
with check (
  private.current_user_has_permission(
    'ip.manage',
    private.governance_unit_code(business_unit_id)
  )
);

create policy ip_assets_update
on public.intellectual_property_assets
for update to authenticated
using (
  private.current_user_has_permission(
    'ip.manage',
    private.governance_unit_code(business_unit_id)
  )
)
with check (
  private.current_user_has_permission(
    'ip.manage',
    private.governance_unit_code(business_unit_id)
  )
);

create policy ip_assets_delete
on public.intellectual_property_assets
for delete to authenticated
using (
  private.current_user_has_permission(
    'ip.manage',
    private.governance_unit_code(business_unit_id)
  )
);

create policy ip_events_select
on public.intellectual_property_events
for select to authenticated
using (
  exists (
    select 1
    from public.intellectual_property_assets asset
    where asset.id=intellectual_property_id
      and (
        private.current_user_has_permission(
          'ip.read',
          private.governance_unit_code(asset.business_unit_id)
        )
        or private.current_user_has_permission(
          'ip.manage',
          private.governance_unit_code(asset.business_unit_id)
        )
      )
  )
);

create policy ip_events_insert
on public.intellectual_property_events
for insert to authenticated
with check (
  exists (
    select 1
    from public.intellectual_property_assets asset
    where asset.id=intellectual_property_id
      and private.current_user_has_permission(
        'ip.manage',
        private.governance_unit_code(asset.business_unit_id)
      )
  )
);

create policy ip_events_update
on public.intellectual_property_events
for update to authenticated
using (
  exists (
    select 1
    from public.intellectual_property_assets asset
    where asset.id=intellectual_property_id
      and private.current_user_has_permission(
        'ip.manage',
        private.governance_unit_code(asset.business_unit_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.intellectual_property_assets asset
    where asset.id=intellectual_property_id
      and private.current_user_has_permission(
        'ip.manage',
        private.governance_unit_code(asset.business_unit_id)
      )
  )
);

create policy ip_events_delete
on public.intellectual_property_events
for delete to authenticated
using (
  exists (
    select 1
    from public.intellectual_property_assets asset
    where asset.id=intellectual_property_id
      and private.current_user_has_permission(
        'ip.manage',
        private.governance_unit_code(asset.business_unit_id)
      )
  )
);

comment on table public.intellectual_property_assets is
  'Canonical IP master protected by ip.read and ip.manage; Legal permissions do not grant access.';
comment on table public.intellectual_property_events is
  'IP event history protected by ip.read/ip.manage; workflow decisions additionally require ip.approve.';
