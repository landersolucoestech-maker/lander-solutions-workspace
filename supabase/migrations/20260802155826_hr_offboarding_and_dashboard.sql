create or replace function public.admin_complete_hr_offboarding(
  p_process_id uuid,
  p_effective_date date,
  p_expected_version bigint,
  p_actor_user_id uuid
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_process public.offboarding_processes;
  v_employee public.employees;
  v_unit text;
  v_open_required integer;
  v_active_equipment integer;
begin
  select * into v_process from public.offboarding_processes where id=p_process_id and deleted_at is null for update;
  if not found then raise exception 'Desligamento não encontrado.' using errcode='P0002'; end if;
  if v_process.version<>p_expected_version then raise exception 'O desligamento foi alterado por outro usuário.' using errcode='40001'; end if;
  if v_process.status not in ('SOLICITADO','EM_ANDAMENTO') then raise exception 'O desligamento não está em andamento.'; end if;
  select * into v_employee from public.employees where id=v_process.employee_id and deleted_at is null for update;
  v_unit:=private.hr_employee_unit_code(v_employee.id);
  if not private.user_has_permission(p_actor_user_id,'hr.offboarding.manage',v_unit) then raise exception 'Permissão insuficiente.' using errcode='42501'; end if;
  select count(*) into v_open_required from public.offboarding_tasks
    where offboarding_process_id=p_process_id and deleted_at is null and required and status not in ('CONCLUIDA','CANCELADA');
  if v_open_required>0 then raise exception 'Existem tarefas obrigatórias pendentes.'; end if;
  select count(*) into v_active_equipment from public.equipment_assignments
    where employee_id=v_employee.id and deleted_at is null and status='ATIVO';
  if v_active_equipment>0 then raise exception 'Existem equipamentos pendentes de devolução.'; end if;
  update public.employee_accesses set status='REVOGADO',revoked_at=p_effective_date,revoked_by=p_actor_user_id,updated_by=p_actor_user_id
    where employee_id=v_employee.id and deleted_at is null and status in ('PENDENTE','ATIVO');
  update public.employment_contracts set status='ENCERRADO',end_date=coalesce(end_date,p_effective_date),updated_by=p_actor_user_id
    where employee_id=v_employee.id and deleted_at is null and status='ATIVO';
  update public.employees set status='DESLIGADO',updated_by=p_actor_user_id where id=v_employee.id;
  if v_employee.user_id is not null then update public.profiles set status='inactive' where id=v_employee.user_id; end if;
  update public.offboarding_processes set status='CONCLUIDO',effective_termination_date=p_effective_date,
    financial_pending=false,document_pending=false,equipment_pending=false,access_pending=false,
    completed_at=now(),completed_by=p_actor_user_id,updated_by=p_actor_user_id where id=p_process_id;
  return jsonb_build_object('id',p_process_id,'status','CONCLUIDO','employee_id',v_employee.id);
end;
$$;
revoke all on function public.admin_complete_hr_offboarding(uuid,date,bigint,uuid) from public,anon,authenticated;
grant execute on function public.admin_complete_hr_offboarding(uuid,date,bigint,uuid) to service_role;

create or replace function public.hr_dashboard_summary(p_unit_code text default null)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$
with visible_employees as (
  select e.*,bu.code as unit_code,bu.name as unit_name,p.birth_date
  from public.employees e
  join public.business_units bu on bu.id=e.business_unit_id
  left join public.people p on p.id=e.person_id
  where e.deleted_at is null and (p_unit_code is null or bu.code=p_unit_code)
), contract_alerts as (
  select count(*) as total from public.employment_contracts c join visible_employees e on e.id=c.employee_id
  where c.deleted_at is null and c.status='ATIVO' and c.end_date between current_date and current_date+30
), document_alerts as (
  select count(*) as total from public.employee_documents d join visible_employees e on e.id=d.employee_id
  where d.deleted_at is null and d.status='ACTIVE' and d.expires_at between current_date and current_date+30
)
select jsonb_build_object(
  'activeEmployees',(select count(*) from visible_employees where status='ATIVO'),
  'awayEmployees',(select count(*) from visible_employees where status='AFASTADO'),
  'terminatedEmployees',(select count(*) from visible_employees where status='DESLIGADO'),
  'employeesByUnit',(select coalesce(jsonb_agg(jsonb_build_object('code',unit_code,'name',unit_name,'total',total) order by unit_name),'[]'::jsonb)
    from (select unit_code,unit_name,count(*) total from visible_employees group by unit_code,unit_name) u),
  'expiringContracts',(select total from contract_alerts),
  'expiringDocuments',(select total from document_alerts),
  'upcomingLeaves',(select count(*) from public.leave_requests l join visible_employees e on e.id=l.employee_id
    where l.deleted_at is null and l.status='APROVADO' and l.start_date between current_date and current_date+30),
  'pendingOnboardings',(select count(*) from public.onboarding_processes o join visible_employees e on e.id=o.employee_id
    where o.deleted_at is null and o.status in ('PENDENTE','EM_ANDAMENTO')),
  'activeOffboardings',(select count(*) from public.offboarding_processes o join visible_employees e on e.id=o.employee_id
    where o.deleted_at is null and o.status in ('SOLICITADO','EM_ANDAMENTO')),
  'pendingEquipmentReturns',(select count(*) from public.equipment_assignments a join visible_employees e on e.id=a.employee_id
    where a.deleted_at is null and a.status='ATIVO' and a.expected_return_date is not null and a.expected_return_date<=current_date),
  'pendingPayments',(select count(*) from public.employee_payments pay join visible_employees e on e.id=pay.employee_id
    where pay.deleted_at is null and pay.status in ('PENDENTE','AGENDADO','ATRASADO')),
  'birthdaysThisMonth',(select count(*) from visible_employees where birth_date is not null and extract(month from birth_date)=extract(month from current_date))
);
$$;
grant execute on function public.hr_dashboard_summary(text) to authenticated,service_role;
