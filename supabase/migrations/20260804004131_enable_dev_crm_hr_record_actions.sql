create or replace function public.dev_get_contact_form(p_party_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.admin_get_contact_form(p_party_id);
$$;

create or replace function public.dev_save_contact_form(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
begin
  select id into v_actor
  from public.profiles
  where status = 'active'
  order by created_at, id
  limit 1;

  if v_actor is null then
    raise exception 'Usuário de desenvolvimento não encontrado.';
  end if;

  return public.admin_save_contact_form(p_payload, v_actor);
end;
$$;

create or replace function public.dev_update_hr_employee(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_result jsonb;
begin
  select id into v_actor
  from public.profiles
  where status = 'active'
  order by created_at, id
  limit 1;

  if v_actor is null then
    raise exception 'Usuário de desenvolvimento não encontrado.';
  end if;

  select to_jsonb(result_row) into v_result
  from public.admin_update_hr_employee(
    (p_payload ->> 'employeeId')::uuid,
    (p_payload ->> 'employeeExpectedVersion')::bigint,
    (p_payload ->> 'personExpectedVersion')::bigint,
    p_payload ->> 'legalName',
    nullif(p_payload ->> 'socialName', ''),
    (p_payload ->> 'birthDate')::date,
    nullif(p_payload ->> 'personalEmail', ''),
    nullif(p_payload ->> 'phone', ''),
    nullif(p_payload ->> 'addressLine', ''),
    nullif(p_payload ->> 'city', ''),
    nullif(p_payload ->> 'state', ''),
    nullif(p_payload ->> 'postalCode', ''),
    nullif(p_payload ->> 'emergencyContactName', ''),
    nullif(p_payload ->> 'emergencyContactPhone', ''),
    nullif(p_payload ->> 'photoPath', ''),
    nullif(p_payload ->> 'userId', '')::uuid,
    nullif(p_payload ->> 'corporateEmail', ''),
    (p_payload ->> 'businessUnitId')::uuid,
    nullif(p_payload ->> 'departmentId', '')::uuid,
    nullif(p_payload ->> 'positionId', '')::uuid,
    nullif(p_payload ->> 'managerEmployeeId', '')::uuid,
    (p_payload ->> 'hireDate')::date,
    p_payload ->> 'employmentType',
    nullif(p_payload ->> 'workSchedule', ''),
    p_payload ->> 'workMode',
    p_payload ->> 'status',
    nullif(p_payload ->> 'internalNotes', ''),
    v_actor
  ) as result_row;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

create or replace function public.dev_update_hr_payment(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_row public.employee_payments%rowtype;
begin
  select id into v_actor
  from public.profiles
  where status = 'active'
  order by created_at, id
  limit 1;
  if v_actor is null then
    raise exception 'Usuário de desenvolvimento não encontrado.';
  end if;

  update public.employee_payments
  set employee_id = (p_payload ->> 'employeeId')::uuid,
      contract_id = nullif(p_payload ->> 'contractId', '')::uuid,
      competence = (p_payload ->> 'competence')::date,
      description = btrim(p_payload ->> 'description'),
      base_amount = (p_payload ->> 'baseAmount')::numeric,
      additions = coalesce(nullif(p_payload ->> 'additions', '')::numeric, 0),
      informational_deductions = coalesce(
        nullif(p_payload ->> 'informationalDeductions', '')::numeric,
        0
      ),
      expected_date = (p_payload ->> 'expectedDate')::date,
      payment_date = nullif(p_payload ->> 'paymentDate', '')::date,
      payment_method = nullif(btrim(p_payload ->> 'paymentMethod'), ''),
      status = p_payload ->> 'status',
      notes = nullif(btrim(p_payload ->> 'notes'), ''),
      updated_by = v_actor
  where id = (p_payload ->> 'id')::uuid
    and version = (p_payload ->> 'expectedVersion')::bigint
    and deleted_at is null
    and status <> 'PAGO'
  returning * into v_row;

  if not found then
    raise exception 'O pagamento foi alterado, pago ou removido.';
  end if;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.dev_update_hr_leave(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_row public.leave_requests%rowtype;
begin
  select id into v_actor
  from public.profiles
  where status = 'active'
  order by created_at, id
  limit 1;
  if v_actor is null then
    raise exception 'Usuário de desenvolvimento não encontrado.';
  end if;

  update public.leave_requests
  set leave_type_id = (p_payload ->> 'leaveTypeId')::uuid,
      start_date = (p_payload ->> 'startDate')::date,
      end_date = (p_payload ->> 'endDate')::date,
      reason = nullif(btrim(p_payload ->> 'reason'), ''),
      manager_employee_id = nullif(p_payload ->> 'managerEmployeeId', '')::uuid,
      status = p_payload ->> 'status',
      notes = nullif(btrim(p_payload ->> 'notes'), ''),
      updated_by = v_actor
  where id = (p_payload ->> 'id')::uuid
    and version = (p_payload ->> 'expectedVersion')::bigint
    and deleted_at is null
    and status in ('RASCUNHO', 'SOLICITADO', 'RECUSADO', 'CANCELADO')
  returning * into v_row;

  if not found then
    raise exception 'A solicitação foi alterada, aprovada ou removida.';
  end if;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.dev_update_hr_document(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_row public.employee_documents%rowtype;
begin
  select id into v_actor
  from public.profiles
  where status = 'active'
  order by created_at, id
  limit 1;
  if v_actor is null then
    raise exception 'Usuário de desenvolvimento não encontrado.';
  end if;

  update public.employee_documents
  set document_type_id = (p_payload ->> 'documentTypeId')::uuid,
      name = btrim(p_payload ->> 'name'),
      issued_at = nullif(p_payload ->> 'issuedAt', '')::date,
      expires_at = nullif(p_payload ->> 'expiresAt', '')::date,
      visibility = p_payload ->> 'visibility',
      status = p_payload ->> 'status',
      notes = nullif(btrim(p_payload ->> 'notes'), ''),
      updated_by = v_actor
  where id = (p_payload ->> 'id')::uuid
    and version = (p_payload ->> 'expectedVersion')::bigint
    and deleted_at is null
  returning * into v_row;

  if not found then
    raise exception 'O documento foi alterado ou removido.';
  end if;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.dev_delete_hr_record(
  p_entity text,
  p_id uuid,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_result jsonb;
begin
  select id into v_actor
  from public.profiles
  where status = 'active'
  order by created_at, id
  limit 1;
  if v_actor is null then
    raise exception 'Usuário de desenvolvimento não encontrado.';
  end if;

  if p_entity = 'employee' then
    update public.employees
    set status = 'DESLIGADO',
        deleted_at = now(),
        updated_by = v_actor
    where id = p_id
      and version = p_expected_version
      and deleted_at is null
    returning to_jsonb(employees.*) into v_result;
  elsif p_entity = 'payment' then
    update public.employee_payments
    set status = 'CANCELADO',
        deleted_at = now(),
        updated_by = v_actor
    where id = p_id
      and version = p_expected_version
      and deleted_at is null
      and status <> 'PAGO'
    returning to_jsonb(employee_payments.*) into v_result;
  elsif p_entity = 'leave' then
    update public.leave_requests
    set status = 'CANCELADO',
        deleted_at = now(),
        updated_by = v_actor
    where id = p_id
      and version = p_expected_version
      and deleted_at is null
      and status <> 'APROVADO'
    returning to_jsonb(leave_requests.*) into v_result;
  elsif p_entity = 'document' then
    update public.employee_documents
    set status = 'DELETED',
        deleted_at = now(),
        updated_by = v_actor
    where id = p_id
      and version = p_expected_version
      and deleted_at is null
    returning to_jsonb(employee_documents.*) into v_result;
  else
    raise exception 'Tipo de registro de RH inválido.';
  end if;

  if v_result is null then
    raise exception 'O registro foi alterado, protegido ou removido.';
  end if;
  return v_result;
end;
$$;

revoke all on function public.dev_get_contact_form(uuid) from public;
revoke all on function public.dev_save_contact_form(jsonb) from public;
revoke all on function public.dev_update_hr_employee(jsonb) from public;
revoke all on function public.dev_update_hr_payment(jsonb) from public;
revoke all on function public.dev_update_hr_leave(jsonb) from public;
revoke all on function public.dev_update_hr_document(jsonb) from public;
revoke all on function public.dev_delete_hr_record(text, uuid, bigint) from public;

grant execute on function public.dev_get_contact_form(uuid) to anon, authenticated;
grant execute on function public.dev_save_contact_form(jsonb) to anon, authenticated;
grant execute on function public.dev_update_hr_employee(jsonb) to anon, authenticated;
grant execute on function public.dev_update_hr_payment(jsonb) to anon, authenticated;
grant execute on function public.dev_update_hr_leave(jsonb) to anon, authenticated;
grant execute on function public.dev_update_hr_document(jsonb) to anon, authenticated;
grant execute on function public.dev_delete_hr_record(text, uuid, bigint) to anon, authenticated;

comment on function public.dev_get_contact_form(uuid) is
  'DEV ONLY: reads the real CRM contact form while application authentication is deferred.';
comment on function public.dev_save_contact_form(jsonb) is
  'DEV ONLY: persists the real CRM contact form using the development actor.';
comment on function public.dev_update_hr_employee(jsonb) is
  'DEV ONLY: updates an employee through the canonical HR domain function.';
comment on function public.dev_update_hr_payment(jsonb) is
  'DEV ONLY: updates a non-paid HR payment with optimistic concurrency.';
comment on function public.dev_update_hr_leave(jsonb) is
  'DEV ONLY: updates an editable HR leave request with optimistic concurrency.';
comment on function public.dev_update_hr_document(jsonb) is
  'DEV ONLY: updates HR document metadata without fabricating storage objects.';
comment on function public.dev_delete_hr_record(text, uuid, bigint) is
  'DEV ONLY: soft deletes editable HR records with optimistic concurrency.';
