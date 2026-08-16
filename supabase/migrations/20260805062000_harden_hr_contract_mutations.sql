create or replace function public.create_hr_contract(
  p_employee_id uuid,
  p_legal_entity_id uuid,
  p_position_id uuid,
  p_contract_type text,
  p_start_date date,
  p_end_date date,
  p_amount numeric,
  p_payment_frequency text,
  p_payment_method text,
  p_work_schedule text,
  p_work_mode text,
  p_status text,
  p_file_path text,
  p_notes text,
  p_is_primary boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_business_unit_id uuid;
  v_unit_code text;
  v_contract public.employment_contracts;
begin
  if v_actor_user_id is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501';
  end if;

  if not public.has_aal2() then
    raise exception 'A operação exige MFA aal2.' using errcode = '42501';
  end if;

  select employee.business_unit_id, unit.code
    into v_business_unit_id, v_unit_code
  from public.employees employee
  join public.business_units unit on unit.id = employee.business_unit_id
  where employee.id = p_employee_id
    and employee.deleted_at is null;

  if v_business_unit_id is null or v_unit_code is null then
    raise exception 'Colaborador não encontrado.' using errcode = 'P0002';
  end if;

  if not private.user_has_permission(
    v_actor_user_id,
    'hr.contracts.manage',
    v_unit_code
  ) then
    raise exception 'Permissão insuficiente.' using errcode = '42501';
  end if;

  begin
    insert into public.employment_contracts (
      employee_id,
      legal_entity_id,
      business_unit_id,
      position_id,
      contract_type,
      start_date,
      end_date,
      amount,
      payment_frequency,
      payment_method,
      work_schedule,
      work_mode,
      status,
      file_path,
      notes,
      is_primary,
      created_by,
      updated_by
    )
    values (
      p_employee_id,
      p_legal_entity_id,
      v_business_unit_id,
      p_position_id,
      p_contract_type,
      p_start_date,
      p_end_date,
      p_amount,
      nullif(btrim(p_payment_frequency), ''),
      nullif(btrim(p_payment_method), ''),
      nullif(btrim(p_work_schedule), ''),
      p_work_mode,
      p_status,
      nullif(btrim(p_file_path), ''),
      nullif(btrim(p_notes), ''),
      coalesce(p_is_primary, true),
      v_actor_user_id,
      v_actor_user_id
    )
    returning * into v_contract;
  exception
    when unique_violation then
      raise exception 'Já existe contrato principal ativo para este colaborador e empresa.';
  end;

  return jsonb_build_object(
    'id', v_contract.id,
    'status', v_contract.status,
    'version', v_contract.version
  );
end;
$function$;

create or replace function public.update_hr_contract(
  p_contract_id uuid,
  p_expected_version bigint,
  p_position_id uuid,
  p_contract_type text,
  p_start_date date,
  p_end_date date,
  p_amount numeric,
  p_payment_frequency text,
  p_payment_method text,
  p_work_schedule text,
  p_work_mode text,
  p_status text,
  p_file_path text,
  p_notes text,
  p_is_primary boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_unit_code text;
  v_contract public.employment_contracts;
begin
  if v_actor_user_id is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501';
  end if;

  if not public.has_aal2() then
    raise exception 'A operação exige MFA aal2.' using errcode = '42501';
  end if;

  select contract.*
    into v_contract
  from public.employment_contracts contract
  where contract.id = p_contract_id
    and contract.deleted_at is null
  for update;

  if not found then
    raise exception 'Contrato não encontrado.' using errcode = 'P0002';
  end if;

  if v_contract.version <> p_expected_version then
    raise exception 'O contrato foi alterado por outro usuário.' using errcode = '40001';
  end if;

  v_unit_code := private.hr_employee_unit_code(v_contract.employee_id);
  if v_unit_code is null then
    raise exception 'Colaborador não encontrado.' using errcode = 'P0002';
  end if;

  if not private.user_has_permission(
    v_actor_user_id,
    'hr.contracts.manage',
    v_unit_code
  ) then
    raise exception 'Permissão insuficiente.' using errcode = '42501';
  end if;

  begin
    update public.employment_contracts
    set position_id = p_position_id,
        contract_type = p_contract_type,
        start_date = p_start_date,
        end_date = p_end_date,
        amount = p_amount,
        payment_frequency = nullif(btrim(p_payment_frequency), ''),
        payment_method = nullif(btrim(p_payment_method), ''),
        work_schedule = nullif(btrim(p_work_schedule), ''),
        work_mode = p_work_mode,
        status = p_status,
        file_path = nullif(btrim(p_file_path), ''),
        notes = nullif(btrim(p_notes), ''),
        is_primary = coalesce(p_is_primary, true),
        updated_by = v_actor_user_id
    where id = p_contract_id
    returning * into v_contract;
  exception
    when unique_violation then
      raise exception 'Já existe contrato principal ativo para este colaborador e empresa.';
  end;

  return jsonb_build_object(
    'id', v_contract.id,
    'status', v_contract.status,
    'version', v_contract.version
  );
end;
$function$;

create or replace function public.close_hr_contract(
  p_contract_id uuid,
  p_end_date date,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_unit_code text;
  v_contract public.employment_contracts;
begin
  if v_actor_user_id is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501';
  end if;

  if not public.has_aal2() then
    raise exception 'A operação exige MFA aal2.' using errcode = '42501';
  end if;

  select contract.*
    into v_contract
  from public.employment_contracts contract
  where contract.id = p_contract_id
    and contract.deleted_at is null
  for update;

  if not found then
    raise exception 'Contrato não encontrado.' using errcode = 'P0002';
  end if;

  if v_contract.version <> p_expected_version then
    raise exception 'O contrato foi alterado por outro usuário.' using errcode = '40001';
  end if;

  v_unit_code := private.hr_employee_unit_code(v_contract.employee_id);
  if v_unit_code is null then
    raise exception 'Colaborador não encontrado.' using errcode = 'P0002';
  end if;

  if not private.user_has_permission(
    v_actor_user_id,
    'hr.contracts.manage',
    v_unit_code
  ) then
    raise exception 'Permissão insuficiente.' using errcode = '42501';
  end if;

  update public.employment_contracts
  set status = 'ENCERRADO',
      end_date = p_end_date,
      updated_by = v_actor_user_id
  where id = p_contract_id
  returning * into v_contract;

  return jsonb_build_object(
    'id', v_contract.id,
    'status', v_contract.status,
    'version', v_contract.version
  );
end;
$function$;

revoke all on function public.create_hr_contract(
  uuid, uuid, uuid, text, date, date, numeric, text, text, text, text, text, text, text, boolean
) from public, anon, authenticated, service_role;
revoke all on function public.update_hr_contract(
  uuid, bigint, uuid, text, date, date, numeric, text, text, text, text, text, text, text, boolean
) from public, anon, authenticated, service_role;
revoke all on function public.close_hr_contract(uuid, date, bigint)
  from public, anon, authenticated, service_role;

grant execute on function public.create_hr_contract(
  uuid, uuid, uuid, text, date, date, numeric, text, text, text, text, text, text, text, boolean
) to authenticated;
grant execute on function public.update_hr_contract(
  uuid, bigint, uuid, text, date, date, numeric, text, text, text, text, text, text, text, boolean
) to authenticated;
grant execute on function public.close_hr_contract(uuid, date, bigint)
  to authenticated;

comment on function public.create_hr_contract(
  uuid, uuid, uuid, text, date, date, numeric, text, text, text, text, text, text, text, boolean
) is 'Caller-scoped employment contract creation with MFA and unit authorization.';
comment on function public.update_hr_contract(
  uuid, bigint, uuid, text, date, date, numeric, text, text, text, text, text, text, text, boolean
) is 'Caller-scoped employment contract update with MFA, unit authorization, and optimistic concurrency.';
comment on function public.close_hr_contract(uuid, date, bigint)
  is 'Caller-scoped employment contract closing with MFA, unit authorization, and optimistic concurrency.';
