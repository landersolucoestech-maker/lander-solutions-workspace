-- Migrate every active HR equipment consumer to the canonical asset domain.
-- The public RPC names are kept temporarily as API compatibility contracts only.
-- They exclusively read and write corporate_assets and asset_assignments.
-- Planned removal of legacy-named RPC aliases: 2026-11-30.

do $$
begin
  if to_regclass('public.corporate_assets') is null
     or to_regclass('public.asset_assignments') is null then
    raise exception 'Estruturas patrimoniais canônicas não encontradas.';
  end if;

  if exists (
    select 1
    from public.equipment e
    left join public.corporate_assets a
      on a.legacy_source = 'equipment'
     and a.legacy_source_id = e.id
    where a.id is null
  ) then
    raise exception 'Existem equipamentos legados sem correspondência canônica.';
  end if;

  if exists (
    select 1
    from public.equipment_assignments ea
    left join public.asset_assignments aa
      on aa.legacy_source = 'equipment_assignments'
     and aa.legacy_source_id = ea.id
    where aa.id is null
  ) then
    raise exception 'Existem atribuições legadas sem correspondência canônica.';
  end if;
end;
$$;

create or replace function public.admin_create_hr_equipment(
  p_business_unit_id uuid,
  p_equipment_type text,
  p_name text,
  p_manufacturer text,
  p_model text,
  p_serial_number text,
  p_asset_number text,
  p_condition text,
  p_status text,
  p_notes text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset_id uuid := gen_random_uuid();
  v_legal_entity_id uuid;
  v_unit_code text;
  v_asset_type text;
  v_condition text;
  v_status text;
begin
  select bu.legal_entity_id, bu.code
    into v_legal_entity_id, v_unit_code
  from public.business_units bu
  where bu.id = p_business_unit_id
    and bu.status = 'active';

  if v_legal_entity_id is null then
    raise exception 'Unidade de negócio ativa com entidade jurídica não encontrada.' using errcode = 'P0002';
  end if;

  if not private.user_has_permission(p_actor_user_id, 'hr.equipment.manage', v_unit_code) then
    raise exception 'Permissão insuficiente.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_actor_user_id) then
    raise exception 'Perfil do responsável não encontrado.' using errcode = 'P0002';
  end if;

  v_asset_type := case upper(btrim(coalesce(p_equipment_type, '')))
    when 'NOTEBOOK' then 'computer'
    when 'DESKTOP' then 'computer'
    when 'COMPUTER' then 'computer'
    when 'MONITOR' then 'computer'
    when 'CELULAR' then 'mobile_device'
    when 'SMARTPHONE' then 'mobile_device'
    when 'TABLET' then 'mobile_device'
    when 'MOBILE_DEVICE' then 'mobile_device'
    when 'CAMERA' then 'audiovisual_equipment'
    when 'AUDIO' then 'audiovisual_equipment'
    when 'VIDEO' then 'audiovisual_equipment'
    when 'HEADSET' then 'audiovisual_equipment'
    when 'MICROFONE' then 'audiovisual_equipment'
    else 'equipment'
  end;

  v_condition := case upper(btrim(coalesce(p_condition, '')))
    when 'NOVO' then 'new'
    when 'NEW' then 'new'
    when 'BOM' then 'good'
    when 'GOOD' then 'good'
    when 'REGULAR' then 'fair'
    when 'FAIR' then 'fair'
    when 'DANIFICADO' then 'damaged'
    when 'DAMAGED' then 'damaged'
    else 'unknown'
  end;

  v_status := case upper(btrim(coalesce(p_status, 'DISPONIVEL')))
    when 'EM_MANUTENCAO' then 'maintenance'
    when 'MAINTENANCE' then 'maintenance'
    when 'INATIVO' then 'inactive'
    when 'INACTIVE' then 'inactive'
    when 'BAIXADO' then 'disposed'
    when 'DISPOSED' then 'disposed'
    when 'PERDIDO' then 'lost'
    when 'LOST' then 'lost'
    when 'CANCELADO' then 'cancelled'
    when 'CANCELLED' then 'cancelled'
    else 'active'
  end;

  insert into public.corporate_assets (
    id,
    legal_entity_id,
    business_unit_id,
    code,
    name,
    description,
    asset_type,
    ownership_type,
    status,
    serial_number,
    asset_category,
    asset_tag,
    quantity,
    current_value,
    depreciation_method,
    manufacturer,
    model,
    equipment_type,
    operational_condition,
    notes,
    created_by
  ) values (
    v_asset_id,
    v_legal_entity_id,
    p_business_unit_id,
    'ATV-EQ-' || upper(left(replace(v_asset_id::text, '-', ''), 8)),
    btrim(p_name),
    concat_ws(' · ', nullif(btrim(coalesce(p_manufacturer, '')), ''), nullif(btrim(coalesce(p_model, '')), '')),
    v_asset_type,
    'owned',
    v_status,
    nullif(btrim(coalesce(p_serial_number, '')), ''),
    'equipment',
    nullif(btrim(coalesce(p_asset_number, '')), ''),
    1,
    0,
    'none',
    nullif(btrim(coalesce(p_manufacturer, '')), ''),
    nullif(btrim(coalesce(p_model, '')), ''),
    upper(btrim(p_equipment_type)),
    v_condition,
    nullif(btrim(coalesce(p_notes, '')), ''),
    p_actor_user_id
  );

  return jsonb_build_object(
    'id', v_asset_id,
    'status', v_status,
    'asset_category', 'equipment'
  );
end;
$$;

create or replace function public.admin_assign_hr_equipment(
  p_equipment_id uuid,
  p_employee_id uuid,
  p_delivered_at date,
  p_expected_return_date date,
  p_delivery_condition text,
  p_notes text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment_id uuid;
  v_asset_status text;
  v_asset_category text;
  v_asset_unit_id uuid;
  v_asset_unit_code text;
  v_employee_status text;
  v_employee_unit_id uuid;
  v_employee_user_id uuid;
  v_condition text;
begin
  select a.status, a.asset_category, a.business_unit_id, bu.code
    into v_asset_status, v_asset_category, v_asset_unit_id, v_asset_unit_code
  from public.corporate_assets a
  left join public.business_units bu on bu.id = a.business_unit_id
  where a.id = p_equipment_id
  for update of a;

  if v_asset_status is null then
    raise exception 'Equipamento não encontrado.' using errcode = 'P0002';
  end if;
  if v_asset_category <> 'equipment' then
    raise exception 'O ativo informado não é um equipamento.';
  end if;
  if v_asset_status <> 'active' then
    raise exception 'Equipamento indisponível para atribuição.';
  end if;
  if v_asset_unit_id is null or v_asset_unit_code is null then
    raise exception 'Equipamento sem unidade de negócio válida.';
  end if;

  select e.status, e.business_unit_id, e.user_id
    into v_employee_status, v_employee_unit_id, v_employee_user_id
  from public.employees e
  where e.id = p_employee_id
    and e.deleted_at is null;

  if v_employee_status is null then
    raise exception 'Colaborador não encontrado.' using errcode = 'P0002';
  end if;
  if v_employee_status not in ('ATIVO', 'AFASTADO') then
    raise exception 'Colaborador não pode receber equipamento.';
  end if;
  if v_employee_unit_id <> v_asset_unit_id then
    raise exception 'Equipamento e colaborador pertencem a unidades diferentes.';
  end if;
  if not private.user_has_permission(p_actor_user_id, 'hr.equipment.manage', v_asset_unit_code) then
    raise exception 'Permissão insuficiente.' using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.asset_assignments aa
    where aa.asset_id = p_equipment_id
      and aa.status = 'active'
  ) then
    raise exception 'Equipamento já possui uma atribuição ativa.';
  end if;

  v_condition := case upper(btrim(coalesce(p_delivery_condition, '')))
    when 'NOVO' then 'new'
    when 'NEW' then 'new'
    when 'BOM' then 'good'
    when 'GOOD' then 'good'
    when 'REGULAR' then 'fair'
    when 'FAIR' then 'fair'
    when 'DANIFICADO' then 'damaged'
    when 'DAMAGED' then 'damaged'
    else 'unknown'
  end;

  insert into public.asset_assignments (
    asset_id,
    employee_id,
    delivered_at,
    expected_return_date,
    delivery_condition,
    assigned_by,
    notes,
    created_by,
    updated_by
  ) values (
    p_equipment_id,
    p_employee_id,
    p_delivered_at,
    p_expected_return_date,
    v_condition,
    p_actor_user_id,
    nullif(btrim(coalesce(p_notes, '')), ''),
    p_actor_user_id,
    p_actor_user_id
  )
  returning id into v_assignment_id;

  update public.corporate_assets
  set custodian_user_id = v_employee_user_id,
      responsible_user_id = v_employee_user_id,
      operational_condition = v_condition
  where id = p_equipment_id;

  return jsonb_build_object(
    'id', v_assignment_id,
    'status', 'active',
    'asset_id', p_equipment_id
  );
end;
$$;

create or replace function public.admin_return_hr_equipment(
  p_assignment_id uuid,
  p_returned_at date,
  p_return_condition text,
  p_notes text,
  p_expected_version bigint,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.asset_assignments;
  v_unit_code text;
  v_condition text;
begin
  select aa.* into v_assignment
  from public.asset_assignments aa
  where aa.id = p_assignment_id
  for update;

  if not found then
    raise exception 'Atribuição não encontrada.' using errcode = 'P0002';
  end if;
  if v_assignment.version <> p_expected_version then
    raise exception 'A atribuição foi alterada por outro usuário.' using errcode = '40001';
  end if;
  if v_assignment.status <> 'active' then
    raise exception 'A atribuição já foi encerrada.';
  end if;
  if p_returned_at < v_assignment.delivered_at then
    raise exception 'A data de devolução não pode anteceder a entrega.';
  end if;

  select bu.code into v_unit_code
  from public.corporate_assets a
  join public.business_units bu on bu.id = a.business_unit_id
  where a.id = v_assignment.asset_id;

  if v_unit_code is null then
    raise exception 'Unidade do equipamento não encontrada.' using errcode = 'P0002';
  end if;
  if not private.user_has_permission(p_actor_user_id, 'hr.equipment.manage', v_unit_code) then
    raise exception 'Permissão insuficiente.' using errcode = '42501';
  end if;

  v_condition := case upper(btrim(coalesce(p_return_condition, '')))
    when 'NOVO' then 'new'
    when 'NEW' then 'new'
    when 'BOM' then 'good'
    when 'GOOD' then 'good'
    when 'REGULAR' then 'fair'
    when 'FAIR' then 'fair'
    when 'DANIFICADO' then 'damaged'
    when 'DAMAGED' then 'damaged'
    else 'unknown'
  end;

  update public.asset_assignments
  set status = 'returned',
      returned_at = p_returned_at,
      return_condition = v_condition,
      returned_by = p_actor_user_id,
      notes = coalesce(nullif(btrim(coalesce(p_notes, '')), ''), notes),
      updated_by = p_actor_user_id
  where id = p_assignment_id;

  update public.corporate_assets
  set custodian_user_id = null,
      responsible_user_id = null,
      operational_condition = v_condition,
      status = case when v_condition = 'damaged' then 'maintenance' else 'active' end
  where id = v_assignment.asset_id;

  return jsonb_build_object(
    'id', p_assignment_id,
    'status', 'returned',
    'asset_id', v_assignment.asset_id
  );
end;
$$;

create or replace function public.admin_complete_hr_offboarding(
  p_process_id uuid,
  p_effective_date date,
  p_expected_version bigint,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_process public.offboarding_processes;
  v_employee public.employees;
  v_unit text;
  v_open_required integer;
  v_active_equipment integer;
begin
  select * into v_process
  from public.offboarding_processes
  where id = p_process_id and deleted_at is null
  for update;

  if not found then raise exception 'Desligamento não encontrado.' using errcode = 'P0002'; end if;
  if v_process.version <> p_expected_version then
    raise exception 'O desligamento foi alterado por outro usuário.' using errcode = '40001';
  end if;
  if v_process.status not in ('SOLICITADO', 'EM_ANDAMENTO') then
    raise exception 'O desligamento não está em andamento.';
  end if;

  select * into v_employee
  from public.employees
  where id = v_process.employee_id and deleted_at is null
  for update;

  v_unit := private.hr_employee_unit_code(v_employee.id);
  if not private.user_has_permission(p_actor_user_id, 'hr.offboarding.manage', v_unit) then
    raise exception 'Permissão insuficiente.' using errcode = '42501';
  end if;

  select count(*) into v_open_required
  from public.offboarding_tasks
  where offboarding_process_id = p_process_id
    and deleted_at is null
    and required
    and status not in ('CONCLUIDA', 'CANCELADA');

  if v_open_required > 0 then raise exception 'Existem tarefas obrigatórias pendentes.'; end if;

  select count(*) into v_active_equipment
  from public.asset_assignments
  where employee_id = v_employee.id
    and status = 'active';

  if v_active_equipment > 0 then raise exception 'Existem equipamentos pendentes de devolução.'; end if;

  update public.employee_accesses
  set status = 'REVOGADO',
      revoked_at = p_effective_date,
      revoked_by = p_actor_user_id,
      updated_by = p_actor_user_id
  where employee_id = v_employee.id
    and deleted_at is null
    and status in ('PENDENTE', 'ATIVO');

  update public.employment_contracts
  set status = 'ENCERRADO',
      end_date = coalesce(end_date, p_effective_date),
      updated_by = p_actor_user_id
  where employee_id = v_employee.id
    and deleted_at is null
    and status = 'ATIVO';

  update public.employees
  set status = 'DESLIGADO', updated_by = p_actor_user_id
  where id = v_employee.id;

  if v_employee.user_id is not null then
    update public.profiles set status = 'inactive' where id = v_employee.user_id;
  end if;

  update public.offboarding_processes
  set status = 'CONCLUIDO',
      effective_termination_date = p_effective_date,
      financial_pending = false,
      document_pending = false,
      equipment_pending = false,
      access_pending = false,
      completed_at = now(),
      completed_by = p_actor_user_id,
      updated_by = p_actor_user_id
  where id = p_process_id;

  return jsonb_build_object('id', p_process_id, 'status', 'CONCLUIDO', 'employee_id', v_employee.id);
end;
$$;

create or replace function public.hr_dashboard_summary(p_unit_code text default null)
returns jsonb
language sql
stable
set search_path = ''
as $$
with visible_employees as (
  select e.*, bu.code as unit_code, bu.name as unit_name, p.birth_date
  from public.employees e
  join public.business_units bu on bu.id = e.business_unit_id
  left join public.people p on p.id = e.person_id
  where e.deleted_at is null
    and (p_unit_code is null or bu.code = p_unit_code)
), contract_alerts as (
  select count(*) as total
  from public.employment_contracts c
  join visible_employees e on e.id = c.employee_id
  where c.deleted_at is null
    and c.status = 'ATIVO'
    and c.end_date between current_date and current_date + 30
), document_alerts as (
  select count(*) as total
  from public.employee_documents d
  join visible_employees e on e.id = d.employee_id
  where d.deleted_at is null
    and d.status = 'ACTIVE'
    and d.expires_at between current_date and current_date + 30
)
select jsonb_build_object(
  'activeEmployees', (select count(*) from visible_employees where status = 'ATIVO'),
  'awayEmployees', (select count(*) from visible_employees where status = 'AFASTADO'),
  'terminatedEmployees', (select count(*) from visible_employees where status = 'DESLIGADO'),
  'employeesByUnit', (
    select coalesce(
      jsonb_agg(jsonb_build_object('code', unit_code, 'name', unit_name, 'total', total) order by unit_name),
      '[]'::jsonb
    )
    from (
      select unit_code, unit_name, count(*) total
      from visible_employees
      group by unit_code, unit_name
    ) u
  ),
  'expiringContracts', (select total from contract_alerts),
  'expiringDocuments', (select total from document_alerts),
  'upcomingLeaves', (
    select count(*)
    from public.leave_requests l
    join visible_employees e on e.id = l.employee_id
    where l.deleted_at is null
      and l.status = 'APROVADO'
      and l.start_date between current_date and current_date + 30
  ),
  'pendingOnboardings', (
    select count(*)
    from public.onboarding_processes o
    join visible_employees e on e.id = o.employee_id
    where o.deleted_at is null and o.status in ('PENDENTE', 'EM_ANDAMENTO')
  ),
  'activeOffboardings', (
    select count(*)
    from public.offboarding_processes o
    join visible_employees e on e.id = o.employee_id
    where o.deleted_at is null and o.status in ('SOLICITADO', 'EM_ANDAMENTO')
  ),
  'pendingEquipmentReturns', (
    select count(*)
    from public.asset_assignments a
    join visible_employees e on e.id = a.employee_id
    where a.status = 'active'
      and a.expected_return_date is not null
      and a.expected_return_date <= current_date
  ),
  'pendingPayments', (
    select count(*)
    from public.employee_payments pay
    join visible_employees e on e.id = pay.employee_id
    where pay.deleted_at is null and pay.status in ('PENDENTE', 'AGENDADO', 'ATRASADO')
  ),
  'birthdaysThisMonth', (
    select count(*)
    from visible_employees
    where birth_date is not null
      and extract(month from birth_date) = extract(month from current_date)
  )
);
$$;

-- Retire the obsolete legacy status synchronizer. The legacy tables remain read-only.
drop trigger if exists equipment_assignments_sync_equipment on public.equipment_assignments;
drop function if exists private.sync_equipment_assignment_status();

-- Remove anonymous visibility from both canonical and legacy equipment structures.
drop policy if exists dev_public_read on public.corporate_assets;
drop policy if exists dev_public_read on public.asset_assignments;
drop policy if exists dev_public_read on public.equipment;
drop policy if exists dev_public_read on public.equipment_assignments;

revoke all on public.corporate_assets from anon;
revoke all on public.asset_assignments from anon;
revoke all on public.equipment from anon;
revoke all on public.equipment_assignments from anon;

revoke all on function public.admin_create_hr_equipment(uuid,text,text,text,text,text,text,text,text,text,uuid) from public, anon;
revoke all on function public.admin_assign_hr_equipment(uuid,uuid,date,date,text,text,uuid) from public, anon;
revoke all on function public.admin_return_hr_equipment(uuid,date,text,text,bigint,uuid) from public, anon;
revoke all on function public.admin_complete_hr_offboarding(uuid,date,bigint,uuid) from public, anon;
revoke all on function public.hr_dashboard_summary(text) from public, anon;

grant execute on function public.admin_create_hr_equipment(uuid,text,text,text,text,text,text,text,text,text,uuid) to authenticated;
grant execute on function public.admin_assign_hr_equipment(uuid,uuid,date,date,text,text,uuid) to authenticated;
grant execute on function public.admin_return_hr_equipment(uuid,date,text,text,bigint,uuid) to authenticated;
grant execute on function public.admin_complete_hr_offboarding(uuid,date,bigint,uuid) to authenticated;
grant execute on function public.hr_dashboard_summary(text) to authenticated;

comment on function public.admin_create_hr_equipment(uuid,text,text,text,text,text,text,text,text,text,uuid)
is 'Creates HR-managed equipment in corporate_assets, the canonical Patrimônio e Licenças master.';

comment on function public.admin_assign_hr_equipment(uuid,uuid,date,date,text,text,uuid)
is 'Temporary API-compatible RPC name. Writes exclusively to asset_assignments. Remove alias naming by 2026-11-30.';

comment on function public.admin_return_hr_equipment(uuid,date,text,text,bigint,uuid)
is 'Temporary API-compatible RPC name. Writes exclusively to asset_assignments and corporate_assets. Remove alias naming by 2026-11-30.';

do $$
begin
  if exists (
    select 1
    from public.asset_assignments aa
    left join public.corporate_assets a on a.id = aa.asset_id
    left join public.employees e on e.id = aa.employee_id
    where a.id is null or e.id is null
  ) then
    raise exception 'Existem atribuições patrimoniais órfãs.';
  end if;

  if exists (
    select 1
    from public.asset_assignments aa
    join public.corporate_assets a on a.id = aa.asset_id
    where a.asset_category <> 'equipment'
  ) then
    raise exception 'Existe atribuição de colaborador para ativo que não é equipamento.';
  end if;

  if exists (
    select asset_id
    from public.asset_assignments
    where status = 'active'
    group by asset_id
    having count(*) > 1
  ) then
    raise exception 'Existe equipamento com mais de uma atribuição ativa.';
  end if;
end;
$$;