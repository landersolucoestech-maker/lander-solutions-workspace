insert into public.permissions (code,module,action,description)
values
  ('organizational_structure.read','organizational_structure','read','Consultar entidades, unidades, departamentos, cargos, produtos, serviços, projetos e centros.'),
  ('organizational_structure.manage','organizational_structure','manage','Administrar a estrutura organizacional e seus períodos de vigência.')
on conflict (code) do update
set module=excluded.module,action=excluded.action,description=excluded.description;

insert into public.role_permissions (role_id,permission_id)
select distinct rp.role_id,target.id
from public.role_permissions rp
join public.permissions source on source.id=rp.permission_id
join public.permissions target on target.code='organizational_structure.read'
where source.code in ('corporate.read','corporate.manage')
on conflict do nothing;

insert into public.role_permissions (role_id,permission_id)
select distinct rp.role_id,target.id
from public.role_permissions rp
join public.permissions source on source.id=rp.permission_id
join public.permissions target on target.code='organizational_structure.manage'
where source.code='corporate.manage'
on conflict do nothing;

drop policy if exists legal_entities_select_authorized on public.legal_entities;
drop policy if exists legal_entities_insert_authorized on public.legal_entities;
drop policy if exists legal_entities_update_authorized on public.legal_entities;
drop policy if exists legal_entities_delete_authorized on public.legal_entities;
create policy legal_entities_organizational_read
on public.legal_entities for select to authenticated
using (
  private.current_user_has_permission('organizational_structure.read',null)
  or private.current_user_has_permission('organizational_structure.manage',null)
);
create policy legal_entities_organizational_insert
on public.legal_entities for insert to authenticated
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('organizational_structure.manage',null)
);
create policy legal_entities_organizational_update
on public.legal_entities for update to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('organizational_structure.manage',null)
)
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('organizational_structure.manage',null)
);
create policy legal_entities_organizational_delete
on public.legal_entities for delete to authenticated
using (
  not is_system
  and private.current_user_has_aal2()
  and private.current_user_has_permission('organizational_structure.manage',null)
);

drop policy if exists business_units_select_authorized on public.business_units;
drop policy if exists business_units_insert_authorized on public.business_units;
drop policy if exists business_units_update_authorized on public.business_units;
drop policy if exists business_units_delete_authorized on public.business_units;
create policy business_units_organizational_read
on public.business_units for select to authenticated
using (
  private.current_user_has_permission('organizational_structure.read',code)
  or private.current_user_has_permission('organizational_structure.manage',code)
);
create policy business_units_organizational_insert
on public.business_units for insert to authenticated
with check (
  private.current_user_has_aal2()
  and (
    private.current_user_has_permission('organizational_structure.manage',code)
    or private.current_user_has_permission('organizational_structure.manage',null)
  )
);
create policy business_units_organizational_update
on public.business_units for update to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('organizational_structure.manage',code)
)
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('organizational_structure.manage',code)
);
create policy business_units_organizational_delete
on public.business_units for delete to authenticated
using (
  not is_system
  and private.current_user_has_aal2()
  and private.current_user_has_permission('organizational_structure.manage',code)
);

comment on table public.business_units
is 'Organizational business units under a legal entity; not an ownership or equity structure.';
