alter table public.people add constraint people_cpf_valid check (private.is_valid_cpf(cpf)) not valid;
alter table public.people validate constraint people_cpf_valid;

create or replace function private.validate_hr_employee_links()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  v_manager_status text;
  v_manager_unit uuid;
  v_department_unit uuid;
  v_position_unit uuid;
begin
  if new.manager_employee_id is not null then
    select e.status,e.business_unit_id into v_manager_status,v_manager_unit
    from public.employees e where e.id=new.manager_employee_id and e.deleted_at is null;
    if v_manager_status is null or v_manager_status <> 'ATIVO' then
      raise exception 'O gestor deve ser um colaborador ativo.' using errcode='23514';
    end if;
    if v_manager_unit <> new.business_unit_id then
      raise exception 'O gestor deve pertencer à mesma unidade de negócio.' using errcode='23514';
    end if;
  end if;
  if new.department_id is not null then
    select d.business_unit_id into v_department_unit from public.departments d where d.id=new.department_id;
    if v_department_unit is not null and v_department_unit <> new.business_unit_id then
      raise exception 'O departamento não pertence à unidade informada.' using errcode='23514';
    end if;
  end if;
  if new.position_id is not null then
    select p.business_unit_id into v_position_unit from public.positions p where p.id=new.position_id and p.deleted_at is null;
    if v_position_unit is not null and v_position_unit <> new.business_unit_id then
      raise exception 'O cargo não pertence à unidade informada.' using errcode='23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger employees_validate_links before insert or update of manager_employee_id,business_unit_id,department_id,position_id
on public.employees for each row execute function private.validate_hr_employee_links();

create or replace function private.validate_leave_decision()
returns trigger
language plpgsql
set search_path=''
as $$
declare v_employee_user uuid;
begin
  if new.status in ('APROVADO','RECUSADO') and old.status is distinct from new.status then
    select e.user_id into v_employee_user from public.employees e where e.id=new.employee_id;
    if new.approver_user_id = v_employee_user then
      raise exception 'O solicitante não pode aprovar ou recusar a própria solicitação.' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger leave_requests_validate_decision before update of status on public.leave_requests
for each row execute function private.validate_leave_decision();

create or replace function private.recalculate_onboarding_progress(p_process_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_total integer;
  v_done integer;
  v_required_open integer;
  v_percentage numeric(5,2);
begin
  select count(*) filter (where status<>'CANCELADA'),
         count(*) filter (where status='CONCLUIDA'),
         count(*) filter (where required and status not in ('CONCLUIDA','CANCELADA'))
  into v_total,v_done,v_required_open
  from public.onboarding_tasks
  where onboarding_process_id=p_process_id and deleted_at is null;
  v_percentage := case when v_total=0 then 0 else round((v_done::numeric/v_total::numeric)*100,2) end;
  update public.onboarding_processes
  set completion_percentage=v_percentage,
      status=case
        when status='CANCELADO' then status
        when v_total>0 and v_required_open=0 then 'CONCLUIDO'
        when v_done>0 then 'EM_ANDAMENTO'
        else 'PENDENTE'
      end,
      completed_at=case when v_total>0 and v_required_open=0 then coalesce(completed_at,now()) else null end
  where id=p_process_id and deleted_at is null;
end;
$$;

create or replace function private.sync_onboarding_progress()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  perform private.recalculate_onboarding_progress(coalesce(new.onboarding_process_id,old.onboarding_process_id));
  return coalesce(new,old);
end;
$$;
create trigger onboarding_tasks_sync_progress after insert or update on public.onboarding_tasks
for each row execute function private.sync_onboarding_progress();

create or replace function private.sync_equipment_assignment_status()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.status='ATIVO' then
    update public.equipment set status='ATRIBUIDO', condition=new.delivery_condition where id=new.equipment_id;
  elsif new.status='DEVOLVIDO' then
    update public.equipment set status='DEVOLVIDO', condition=new.return_condition where id=new.equipment_id;
  end if;
  return new;
end;
$$;
create trigger equipment_assignments_sync_equipment after insert or update of status,return_condition on public.equipment_assignments
for each row execute function private.sync_equipment_assignment_status();
