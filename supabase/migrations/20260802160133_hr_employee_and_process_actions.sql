create or replace function public.admin_create_hr_employee(
  p_legal_name text,
  p_social_name text,
  p_cpf text,
  p_birth_date date,
  p_personal_email text,
  p_phone text,
  p_address_line text,
  p_city text,
  p_state text,
  p_postal_code text,
  p_emergency_contact_name text,
  p_emergency_contact_phone text,
  p_photo_path text,
  p_user_id uuid,
  p_corporate_email text,
  p_business_unit_id uuid,
  p_department_id uuid,
  p_position_id uuid,
  p_manager_employee_id uuid,
  p_hire_date date,
  p_employment_type text,
  p_work_schedule text,
  p_work_mode text,
  p_status text,
  p_internal_notes text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_unit_code text;
  v_person_id uuid;
  v_employee_id uuid;
begin
  select code into v_unit_code from public.business_units where id=p_business_unit_id and status='active';
  if v_unit_code is null then raise exception 'Unidade de negócio inválida.'; end if;
  if not private.user_has_permission(p_actor_user_id,'hr.employees.manage',v_unit_code) then
    raise exception 'Permissão insuficiente.' using errcode='42501';
  end if;
  insert into public.people(
    legal_name,social_name,cpf,birth_date,personal_email,phone,address_line,city,state,postal_code,
    emergency_contact_name,emergency_contact_phone,photo_path,created_by,updated_by
  ) values (
    btrim(p_legal_name),nullif(btrim(p_social_name),''),private.only_digits(p_cpf),p_birth_date,
    nullif(lower(btrim(p_personal_email)),''),nullif(btrim(p_phone),''),nullif(btrim(p_address_line),''),
    nullif(btrim(p_city),''),nullif(upper(btrim(p_state)),''),nullif(private.only_digits(p_postal_code),''),
    nullif(btrim(p_emergency_contact_name),''),nullif(btrim(p_emergency_contact_phone),''),nullif(btrim(p_photo_path),''),
    p_actor_user_id,p_actor_user_id
  ) returning id into v_person_id;
  insert into public.employees(
    person_id,user_id,corporate_email,business_unit_id,department_id,position_id,manager_employee_id,
    hire_date,employment_type,work_schedule,work_mode,status,internal_notes,created_by,updated_by
  ) values (
    v_person_id,p_user_id,nullif(lower(btrim(p_corporate_email)),''),p_business_unit_id,p_department_id,p_position_id,
    p_manager_employee_id,p_hire_date,p_employment_type,nullif(btrim(p_work_schedule),''),p_work_mode,p_status,
    nullif(btrim(p_internal_notes),''),p_actor_user_id,p_actor_user_id
  ) returning id into v_employee_id;
  return jsonb_build_object('personId',v_person_id,'employeeId',v_employee_id);
end;
$$;

create or replace function public.admin_update_hr_employee(
  p_employee_id uuid,
  p_employee_expected_version bigint,
  p_person_expected_version bigint,
  p_legal_name text,
  p_social_name text,
  p_birth_date date,
  p_personal_email text,
  p_phone text,
  p_address_line text,
  p_city text,
  p_state text,
  p_postal_code text,
  p_emergency_contact_name text,
  p_emergency_contact_phone text,
  p_photo_path text,
  p_user_id uuid,
  p_corporate_email text,
  p_business_unit_id uuid,
  p_department_id uuid,
  p_position_id uuid,
  p_manager_employee_id uuid,
  p_hire_date date,
  p_employment_type text,
  p_work_schedule text,
  p_work_mode text,
  p_status text,
  p_internal_notes text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_employee public.employees;
  v_unit_code text;
  v_changed integer;
begin
  select * into v_employee from public.employees where id=p_employee_id and deleted_at is null for update;
  if not found then raise exception 'Colaborador não encontrado.' using errcode='P0002'; end if;
  if v_employee.version<>p_employee_expected_version then raise exception 'O colaborador foi alterado por outro usuário.' using errcode='40001'; end if;
  v_unit_code:=private.hr_employee_unit_code(p_employee_id);
  if not private.user_has_permission(p_actor_user_id,'hr.employees.manage',v_unit_code) then
    raise exception 'Permissão insuficiente.' using errcode='42501';
  end if;
  update public.people set
    legal_name=btrim(p_legal_name),social_name=nullif(btrim(p_social_name),''),birth_date=p_birth_date,
    personal_email=nullif(lower(btrim(p_personal_email)),''),phone=nullif(btrim(p_phone),''),
    address_line=nullif(btrim(p_address_line),''),city=nullif(btrim(p_city),''),state=nullif(upper(btrim(p_state)),''),
    postal_code=nullif(private.only_digits(p_postal_code),''),emergency_contact_name=nullif(btrim(p_emergency_contact_name),''),
    emergency_contact_phone=nullif(btrim(p_emergency_contact_phone),''),photo_path=nullif(btrim(p_photo_path),''),updated_by=p_actor_user_id
  where id=v_employee.person_id and version=p_person_expected_version and deleted_at is null;
  get diagnostics v_changed=row_count;
  if v_changed<>1 then raise exception 'Os dados pessoais foram alterados por outro usuário.' using errcode='40001'; end if;
  update public.employees set
    user_id=p_user_id,corporate_email=nullif(lower(btrim(p_corporate_email)),''),business_unit_id=p_business_unit_id,
    department_id=p_department_id,position_id=p_position_id,manager_employee_id=p_manager_employee_id,
    hire_date=p_hire_date,employment_type=p_employment_type,work_schedule=nullif(btrim(p_work_schedule),''),
    work_mode=p_work_mode,status=p_status,internal_notes=nullif(btrim(p_internal_notes),''),updated_by=p_actor_user_id
  where id=p_employee_id;
  return jsonb_build_object('employeeId',p_employee_id,'personId',v_employee.person_id);
end;
$$;

create or replace function public.admin_create_hr_onboarding(
  p_employee_id uuid,
  p_expected_start_date date,
  p_responsible_user_id uuid,
  p_notes text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_unit text; v_id uuid;
begin
  v_unit:=private.hr_employee_unit_code(p_employee_id);
  if v_unit is null then raise exception 'Colaborador não encontrado.' using errcode='P0002'; end if;
  if not private.user_has_permission(p_actor_user_id,'hr.onboarding.manage',v_unit) then raise exception 'Permissão insuficiente.' using errcode='42501'; end if;
  insert into public.onboarding_processes(employee_id,expected_start_date,responsible_user_id,notes,created_by,updated_by)
  values(p_employee_id,p_expected_start_date,p_responsible_user_id,nullif(btrim(p_notes),''),p_actor_user_id,p_actor_user_id)
  returning id into v_id;
  insert into public.onboarding_tasks(onboarding_process_id,title,required,sort_order,created_by,updated_by)
  select v_id,title,true,ord,p_actor_user_id,p_actor_user_id from unnest(array[
    'Documentos recebidos','Contrato assinado','E-mail corporativo criado','Usuário do sistema criado',
    'Equipamentos entregues','Acessos liberados','Apresentação realizada','Políticas aceitas'
  ]) with ordinality as t(title,ord);
  return jsonb_build_object('id',v_id,'status','PENDENTE');
end;
$$;

create or replace function public.admin_create_hr_offboarding(
  p_employee_id uuid,
  p_last_working_day date,
  p_reason text,
  p_responsible_user_id uuid,
  p_notes text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_unit text; v_id uuid;
begin
  v_unit:=private.hr_employee_unit_code(p_employee_id);
  if v_unit is null then raise exception 'Colaborador não encontrado.' using errcode='P0002'; end if;
  if not private.user_has_permission(p_actor_user_id,'hr.offboarding.manage',v_unit) then raise exception 'Permissão insuficiente.' using errcode='42501'; end if;
  insert into public.offboarding_processes(employee_id,last_working_day,reason,responsible_user_id,notes,created_by,updated_by)
  values(p_employee_id,p_last_working_day,btrim(p_reason),p_responsible_user_id,nullif(btrim(p_notes),''),p_actor_user_id,p_actor_user_id)
  returning id into v_id;
  insert into public.offboarding_tasks(offboarding_process_id,title,required,sort_order,created_by,updated_by)
  select v_id,title,true,ord,p_actor_user_id,p_actor_user_id from unnest(array[
    'Confirmar último dia','Registrar motivo','Revogar acesso ao sistema','Revogar acessos externos',
    'Recolher equipamentos','Verificar pendências','Anexar documentos finais','Marcar colaborador como desligado'
  ]) with ordinality as t(title,ord);
  return jsonb_build_object('id',v_id,'status','SOLICITADO');
end;
$$;

revoke all on function public.admin_create_hr_employee(text,text,text,date,text,text,text,text,text,text,text,text,text,uuid,text,uuid,uuid,uuid,uuid,date,text,text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.admin_update_hr_employee(uuid,bigint,bigint,text,text,date,text,text,text,text,text,text,text,text,text,uuid,text,uuid,uuid,uuid,uuid,date,text,text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.admin_create_hr_onboarding(uuid,date,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.admin_create_hr_offboarding(uuid,date,text,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_create_hr_employee(text,text,text,date,text,text,text,text,text,text,text,text,text,uuid,text,uuid,uuid,uuid,uuid,date,text,text,text,text,text,uuid) to service_role;
grant execute on function public.admin_update_hr_employee(uuid,bigint,bigint,text,text,date,text,text,text,text,text,text,text,text,text,uuid,text,uuid,uuid,uuid,uuid,date,text,text,text,text,text,uuid) to service_role;
grant execute on function public.admin_create_hr_onboarding(uuid,date,uuid,text,uuid) to service_role;
grant execute on function public.admin_create_hr_offboarding(uuid,date,text,uuid,text,uuid) to service_role;
