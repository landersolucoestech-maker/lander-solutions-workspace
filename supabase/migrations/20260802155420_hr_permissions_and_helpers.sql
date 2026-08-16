-- RH roles, permissions and security helper functions.

insert into public.app_roles (code, name, description, is_system)
values
  ('hr_manager', 'RH', 'Gestão operacional de recursos humanos.', true),
  ('employee', 'Colaborador', 'Acesso restrito aos próprios registros permitidos.', true)
on conflict (code) do update set name=excluded.name, description=excluded.description;

insert into public.permissions (code, module, action, description)
values
  ('hr.module.access','hr','access','Acessar o módulo de RH.'),
  ('hr.dashboard.read','hr','read_dashboard','Visualizar indicadores de RH.'),
  ('hr.employees.read','hr','read_employees','Visualizar dados profissionais de colaboradores.'),
  ('hr.employees.manage','hr','manage_employees','Cadastrar e atualizar colaboradores.'),
  ('hr.employees.sensitive','hr','read_sensitive_employee_data','Visualizar dados pessoais sensíveis.'),
  ('hr.contracts.read','hr','read_contracts','Visualizar contratos.'),
  ('hr.contracts.manage','hr','manage_contracts','Criar e alterar contratos.'),
  ('hr.contracts.financial','hr','read_contract_financials','Visualizar valores contratuais.'),
  ('hr.documents.read','hr','read_documents','Visualizar metadados de documentos.'),
  ('hr.documents.manage','hr','manage_documents','Enviar, substituir e excluir logicamente documentos.'),
  ('hr.documents.sensitive','hr','read_sensitive_documents','Visualizar documentos pessoais restritos.'),
  ('hr.documents.download','hr','download_documents','Gerar download temporário de documentos.'),
  ('hr.leave.read','hr','read_leave','Visualizar férias e ausências.'),
  ('hr.leave.manage','hr','manage_leave','Criar e atualizar férias e ausências.'),
  ('hr.leave.approve','hr','approve_leave','Aprovar ou recusar férias e ausências.'),
  ('hr.payments.read','hr','read_payments','Visualizar pagamentos administrativos.'),
  ('hr.payments.manage','hr','manage_payments','Criar e atualizar pagamentos administrativos.'),
  ('hr.onboarding.read','hr','read_onboarding','Visualizar onboardings.'),
  ('hr.onboarding.manage','hr','manage_onboarding','Gerenciar onboardings e tarefas.'),
  ('hr.offboarding.read','hr','read_offboarding','Visualizar desligamentos.'),
  ('hr.offboarding.manage','hr','manage_offboarding','Gerenciar e concluir desligamentos.'),
  ('hr.equipment.read','hr','read_equipment','Visualizar equipamentos e atribuições.'),
  ('hr.equipment.manage','hr','manage_equipment','Gerenciar equipamentos e atribuições.'),
  ('hr.accesses.read','hr','read_accesses','Visualizar registros de acessos externos.'),
  ('hr.accesses.manage','hr','manage_accesses','Conceder e revogar registros de acesso.'),
  ('hr.settings.manage','hr','manage_settings','Gerenciar configurações básicas do RH.'),
  ('hr.audit.read','hr','read_audit','Consultar auditoria do RH.')
on conflict (code) do update set module=excluded.module, action=excluded.action, description=excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.app_roles r cross join public.permissions p
where r.code in ('owner','corporate_admin','hr_manager') and p.module='hr'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.app_roles r join public.permissions p on p.code = any(array[
  'hr.module.access','hr.dashboard.read','hr.employees.read','hr.leave.read','hr.leave.approve',
  'hr.onboarding.read','hr.equipment.read','hr.accesses.read'
]) where r.code='unit_manager' on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.app_roles r join public.permissions p on p.code = any(array[
  'hr.module.access','hr.contracts.read','hr.contracts.financial','hr.payments.read','hr.payments.manage',
  'hr.documents.read','hr.documents.download'
]) where r.code in ('finance_manager','accounts_payable') on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.app_roles r join public.permissions p on p.code = any(array[
  'hr.module.access','hr.dashboard.read','hr.employees.read','hr.contracts.read','hr.documents.read',
  'hr.leave.read','hr.payments.read','hr.onboarding.read','hr.offboarding.read','hr.equipment.read',
  'hr.accesses.read','hr.audit.read'
]) where r.code in ('auditor','readonly','executive_readonly') on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.app_roles r join public.permissions p on p.code = any(array[
  'hr.module.access','hr.dashboard.read','hr.leave.read','hr.onboarding.read','hr.equipment.read','hr.accesses.read'
]) where r.code='employee' on conflict do nothing;

create or replace function private.hr_employee_unit_code(p_employee_id uuid)
returns text language sql stable security definer set search_path=''
as $$
  select bu.code from public.employees e
  join public.business_units bu on bu.id=e.business_unit_id
  where e.id=p_employee_id and e.deleted_at is null;
$$;

create or replace function private.hr_current_employee_id()
returns uuid language sql stable security definer set search_path=''
as $$
  select e.id from public.employees e
  where e.user_id=auth.uid() and e.deleted_at is null
  order by case e.status when 'ATIVO' then 0 when 'AFASTADO' then 1 else 2 end limit 1;
$$;

create or replace function private.hr_is_manager_of(p_employee_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(select 1 from public.employees e
    where e.id=p_employee_id and e.manager_employee_id=private.hr_current_employee_id() and e.deleted_at is null);
$$;

create or replace function private.hr_has_unit_permission(p_permission text, p_employee_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select public.has_permission(p_permission, private.hr_employee_unit_code(p_employee_id));
$$;

revoke all on function private.hr_employee_unit_code(uuid) from public, anon;
revoke all on function private.hr_current_employee_id() from public, anon;
revoke all on function private.hr_is_manager_of(uuid) from public, anon;
revoke all on function private.hr_has_unit_permission(text,uuid) from public, anon;
grant execute on function private.hr_employee_unit_code(uuid) to authenticated, service_role;
grant execute on function private.hr_current_employee_id() to authenticated, service_role;
grant execute on function private.hr_is_manager_of(uuid) to authenticated, service_role;
grant execute on function private.hr_has_unit_permission(text,uuid) to authenticated, service_role;
grant execute on function private.unit_code_for_id(uuid) to authenticated, service_role;

create or replace function private.hr_redact_row(p_table text, p_row jsonb)
returns jsonb language plpgsql immutable set search_path=''
as $$
begin
  if p_row is null then return null; end if;
  case p_table
    when 'people' then return p_row || jsonb_build_object(
      'cpf','***REDACTED***','personal_email','***REDACTED***','phone','***REDACTED***',
      'address_line','***REDACTED***','postal_code','***REDACTED***','emergency_contact_name','***REDACTED***',
      'emergency_contact_phone','***REDACTED***','photo_path','***REDACTED***');
    when 'employment_contracts' then return p_row || jsonb_build_object('amount','***REDACTED***','file_path','***REDACTED***');
    when 'employee_documents' then return p_row || jsonb_build_object('storage_path','***REDACTED***','original_file_name','***REDACTED***','notes','***REDACTED***');
    when 'employee_payments' then return p_row || jsonb_build_object(
      'base_amount','***REDACTED***','additions','***REDACTED***','informational_deductions','***REDACTED***',
      'final_amount','***REDACTED***','proof_storage_path','***REDACTED***');
    when 'employee_accesses' then return p_row || jsonb_build_object('account_identifier','***REDACTED***','notes','***REDACTED***');
    else return p_row - array['notes','internal_notes','document_storage_path','final_documents_storage_path'];
  end case;
end;
$$;

create or replace function private.audit_hr_row_change()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_before jsonb; v_after jsonb; v_entity_id text; v_employee_id uuid; v_unit_code text; v_session_id uuid;
begin
  if tg_op='INSERT' then v_before:=null; v_after:=to_jsonb(new);
  elsif tg_op='UPDATE' then v_before:=to_jsonb(old); v_after:=to_jsonb(new);
  else v_before:=to_jsonb(old); v_after:=null; end if;
  v_entity_id:=coalesce(v_after->>'id',v_before->>'id');
  begin v_employee_id:=nullif(coalesce(v_after->>'employee_id',v_before->>'employee_id'),'')::uuid;
  exception when others then v_employee_id:=null; end;
  if tg_table_name='employees' then
    begin v_employee_id:=v_entity_id::uuid; exception when others then v_employee_id:=null; end;
  end if;
  if tg_table_name='people' then
    select e.id into v_employee_id from public.employees e
    where e.person_id=coalesce((v_after->>'id')::uuid,(v_before->>'id')::uuid) and e.deleted_at is null limit 1;
  end if;
  v_unit_code:=case when v_employee_id is not null then private.hr_employee_unit_code(v_employee_id) else null end;
  begin v_session_id:=nullif(auth.jwt()->>'session_id','')::uuid; exception when others then v_session_id:=null; end;
  insert into public.audit_events(actor_user_id,actor_session_id,action,entity_schema,entity_table,entity_id,before_data,after_data,metadata)
  values(auth.uid(),v_session_id,lower(tg_op),tg_table_schema,tg_table_name,v_entity_id,
    private.hr_redact_row(tg_table_name,v_before),private.hr_redact_row(tg_table_name,v_after),
    jsonb_strip_nulls(jsonb_build_object('module','hr','unit_code',v_unit_code)));
  return coalesce(new,old);
end;
$$;

create or replace function private.prevent_hr_physical_delete()
returns trigger language plpgsql set search_path=''
as $$
begin
  raise exception 'Exclusão física não permitida para registros de RH.' using errcode='42501';
end;
$$;
