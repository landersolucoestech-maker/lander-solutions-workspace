create or replace function public.admin_decide_hr_leave(
  p_request_id uuid,
  p_decision text,
  p_rejection_reason text,
  p_expected_version bigint,
  p_actor_user_id uuid
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_request public.leave_requests; v_unit text;
begin
  if p_decision not in ('APROVADO','RECUSADO') then raise exception 'Decisão inválida.'; end if;
  select * into v_request from public.leave_requests where id=p_request_id and deleted_at is null for update;
  if not found then raise exception 'Solicitação não encontrada.' using errcode='P0002'; end if;
  if v_request.version<>p_expected_version then raise exception 'A solicitação foi alterada por outro usuário.' using errcode='40001'; end if;
  if v_request.status<>'SOLICITADO' then raise exception 'Somente solicitações pendentes podem receber decisão.'; end if;
  v_unit:=private.hr_employee_unit_code(v_request.employee_id);
  if not private.user_has_permission(p_actor_user_id,'hr.leave.approve',v_unit) then raise exception 'Permissão insuficiente.' using errcode='42501'; end if;
  if p_decision='RECUSADO' and btrim(coalesce(p_rejection_reason,''))='' then raise exception 'O motivo da recusa é obrigatório.'; end if;
  update public.leave_requests set status=p_decision,approver_user_id=p_actor_user_id,decision_at=now(),
    rejection_reason=case when p_decision='RECUSADO' then btrim(p_rejection_reason) else null end,updated_by=p_actor_user_id
  where id=p_request_id;
  return jsonb_build_object('id',p_request_id,'status',p_decision);
end;
$$;

create or replace function public.admin_mark_hr_payment_paid(
  p_payment_id uuid,
  p_payment_date date,
  p_payment_method text,
  p_proof_storage_path text,
  p_expected_version bigint,
  p_actor_user_id uuid
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_payment public.employee_payments; v_unit text;
begin
  select * into v_payment from public.employee_payments where id=p_payment_id and deleted_at is null for update;
  if not found then raise exception 'Pagamento não encontrado.' using errcode='P0002'; end if;
  if v_payment.version<>p_expected_version then raise exception 'O pagamento foi alterado por outro usuário.' using errcode='40001'; end if;
  v_unit:=private.hr_employee_unit_code(v_payment.employee_id);
  if not private.user_has_permission(p_actor_user_id,'hr.payments.manage',v_unit) then raise exception 'Permissão insuficiente.' using errcode='42501'; end if;
  if p_payment_date is null then raise exception 'A data de pagamento é obrigatória.'; end if;
  update public.employee_payments set status='PAGO',payment_date=p_payment_date,payment_method=nullif(btrim(p_payment_method),''),
    proof_storage_path=nullif(btrim(p_proof_storage_path),''),updated_by=p_actor_user_id where id=p_payment_id;
  return jsonb_build_object('id',p_payment_id,'status','PAGO');
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
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_unit text; v_assignment_id uuid; v_equipment_status text; v_employee_status text;
begin
  select status into v_equipment_status from public.equipment where id=p_equipment_id and deleted_at is null for update;
  if v_equipment_status is null then raise exception 'Equipamento não encontrado.' using errcode='P0002'; end if;
  if v_equipment_status not in ('DISPONIVEL','DEVOLVIDO') then raise exception 'Equipamento indisponível para atribuição.'; end if;
  select status into v_employee_status from public.employees where id=p_employee_id and deleted_at is null;
  if v_employee_status not in ('ATIVO','AFASTADO') then raise exception 'Colaborador não pode receber equipamento.'; end if;
  v_unit:=private.hr_employee_unit_code(p_employee_id);
  if not private.user_has_permission(p_actor_user_id,'hr.equipment.manage',v_unit) then raise exception 'Permissão insuficiente.' using errcode='42501'; end if;
  insert into public.equipment_assignments(equipment_id,employee_id,delivered_at,expected_return_date,delivery_condition,assigned_by,notes,created_by,updated_by)
  values(p_equipment_id,p_employee_id,p_delivered_at,p_expected_return_date,p_delivery_condition,p_actor_user_id,nullif(btrim(p_notes),''),p_actor_user_id,p_actor_user_id)
  returning id into v_assignment_id;
  return jsonb_build_object('id',v_assignment_id,'status','ATIVO');
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
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_assignment public.equipment_assignments; v_unit text;
begin
  select * into v_assignment from public.equipment_assignments where id=p_assignment_id and deleted_at is null for update;
  if not found then raise exception 'Atribuição não encontrada.' using errcode='P0002'; end if;
  if v_assignment.version<>p_expected_version then raise exception 'A atribuição foi alterada por outro usuário.' using errcode='40001'; end if;
  if v_assignment.status<>'ATIVO' then raise exception 'A atribuição já foi encerrada.'; end if;
  v_unit:=private.hr_employee_unit_code(v_assignment.employee_id);
  if not private.user_has_permission(p_actor_user_id,'hr.equipment.manage',v_unit) then raise exception 'Permissão insuficiente.' using errcode='42501'; end if;
  update public.equipment_assignments set status='DEVOLVIDO',returned_at=p_returned_at,return_condition=p_return_condition,
    returned_by=p_actor_user_id,notes=coalesce(nullif(btrim(p_notes),''),notes),updated_by=p_actor_user_id where id=p_assignment_id;
  return jsonb_build_object('id',p_assignment_id,'status','DEVOLVIDO');
end;
$$;

revoke all on function public.admin_decide_hr_leave(uuid,text,text,bigint,uuid) from public,anon,authenticated;
revoke all on function public.admin_mark_hr_payment_paid(uuid,date,text,text,bigint,uuid) from public,anon,authenticated;
revoke all on function public.admin_assign_hr_equipment(uuid,uuid,date,date,text,text,uuid) from public,anon,authenticated;
revoke all on function public.admin_return_hr_equipment(uuid,date,text,text,bigint,uuid) from public,anon,authenticated;
grant execute on function public.admin_decide_hr_leave(uuid,text,text,bigint,uuid) to service_role;
grant execute on function public.admin_mark_hr_payment_paid(uuid,date,text,text,bigint,uuid) to service_role;
grant execute on function public.admin_assign_hr_equipment(uuid,uuid,date,date,text,text,uuid) to service_role;
grant execute on function public.admin_return_hr_equipment(uuid,date,text,text,bigint,uuid) to service_role;
