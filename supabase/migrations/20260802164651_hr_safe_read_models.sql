create or replace function public.hr_employee_directory(p_unit_code text default null)
returns table (
  employee_id uuid,
  display_name text,
  corporate_email text,
  business_unit_id uuid,
  unit_code text,
  unit_name text,
  department_id uuid,
  department_name text,
  position_id uuid,
  position_name text,
  manager_employee_id uuid,
  manager_name text,
  hire_date date,
  employment_type text,
  work_mode text,
  status text,
  employee_version bigint
)
language sql
stable
security definer
set search_path=''
as $$
  select
    e.id,
    coalesce(nullif(p.social_name,''), p.legal_name),
    e.corporate_email,
    e.business_unit_id,
    bu.code,
    bu.name,
    e.department_id,
    d.name,
    e.position_id,
    pos.name,
    e.manager_employee_id,
    coalesce(nullif(mp.social_name,''), mp.legal_name),
    e.hire_date,
    e.employment_type,
    e.work_mode,
    e.status,
    e.version
  from public.employees e
  join public.people p on p.id=e.person_id and p.deleted_at is null
  join public.business_units bu on bu.id=e.business_unit_id
  left join public.departments d on d.id=e.department_id
  left join public.positions pos on pos.id=e.position_id and pos.deleted_at is null
  left join public.employees me on me.id=e.manager_employee_id and me.deleted_at is null
  left join public.people mp on mp.id=me.person_id and mp.deleted_at is null
  where e.deleted_at is null
    and (p_unit_code is null or bu.code=p_unit_code)
    and (
      public.has_permission('hr.employees.read',bu.code)
      or e.user_id=auth.uid()
      or private.hr_is_manager_of(e.id)
    )
  order by coalesce(nullif(p.social_name,''),p.legal_name);
$$;

create or replace function public.hr_employee_sensitive_detail(p_employee_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_unit_code text;
  v_is_self boolean;
  v_result jsonb;
begin
  select bu.code, e.user_id=auth.uid()
    into v_unit_code,v_is_self
  from public.employees e
  join public.business_units bu on bu.id=e.business_unit_id
  where e.id=p_employee_id and e.deleted_at is null;

  if v_unit_code is null then
    raise exception 'Colaborador não encontrado.' using errcode='P0002';
  end if;

  if not v_is_self and not public.has_permission('hr.employees.sensitive',v_unit_code) then
    raise exception 'Permissão insuficiente.' using errcode='42501';
  end if;

  select jsonb_build_object(
    'employeeId',e.id,
    'employeeVersion',e.version,
    'personId',p.id,
    'personVersion',p.version,
    'legalName',p.legal_name,
    'socialName',p.social_name,
    'cpf',p.cpf,
    'birthDate',p.birth_date,
    'personalEmail',p.personal_email,
    'phone',p.phone,
    'addressLine',p.address_line,
    'city',p.city,
    'state',p.state,
    'postalCode',p.postal_code,
    'emergencyContactName',p.emergency_contact_name,
    'emergencyContactPhone',p.emergency_contact_phone,
    'photoPath',p.photo_path,
    'userId',e.user_id,
    'corporateEmail',e.corporate_email,
    'businessUnitId',e.business_unit_id,
    'departmentId',e.department_id,
    'positionId',e.position_id,
    'managerEmployeeId',e.manager_employee_id,
    'hireDate',e.hire_date,
    'employmentType',e.employment_type,
    'workSchedule',e.work_schedule,
    'workMode',e.work_mode,
    'status',e.status,
    'internalNotes',case when public.has_permission('hr.employees.sensitive',v_unit_code) then e.internal_notes else null end
  ) into v_result
  from public.employees e
  join public.people p on p.id=e.person_id
  where e.id=p_employee_id and e.deleted_at is null and p.deleted_at is null;

  return v_result;
end;
$$;

revoke all on function public.hr_employee_directory(text) from public,anon;
revoke all on function public.hr_employee_sensitive_detail(uuid) from public,anon;
grant execute on function public.hr_employee_directory(text) to authenticated,service_role;
grant execute on function public.hr_employee_sensitive_detail(uuid) to authenticated,service_role;
