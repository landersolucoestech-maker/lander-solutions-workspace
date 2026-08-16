create or replace function public.admin_calculate_participation(
  p_calculation_id uuid,p_expected_version integer,p_actor_user_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_calc public.participation_calculations;v_unit text;v_part record;v_base numeric;v_gross numeric;v_ret numeric;v_net numeric;v_seq integer:=0;v_count integer:=0;
begin
  select * into v_calc from public.participation_calculations where id=p_calculation_id for update;
  if not found or v_calc.version<>p_expected_version then return null;end if;
  v_unit:=private.unit_code_for_id(v_calc.business_unit_id);
  if not private.user_has_permission(p_actor_user_id,'participation.manage',v_unit) then raise exception 'Permissão insuficiente para calcular participações.';end if;
  if v_calc.status not in('draft','calculated') then raise exception 'A apuração não pode ser recalculada neste estado.';end if;
  delete from public.participation_calculation_lines where participation_calculation_id=v_calc.id;
  v_base:=greatest(v_calc.distributable_base,0);
  for v_part in select * from public.contract_version_participants where contract_version_id=v_calc.contract_version_id and status='active' order by priority,id loop
    v_seq:=v_seq+1;v_count:=v_count+1;
    v_gross:=round(v_base*v_part.percentage/100,2);
    if v_part.minimum_amount is not null then v_gross:=greatest(v_gross,v_part.minimum_amount);end if;
    if v_part.maximum_amount is not null then v_gross:=least(v_gross,v_part.maximum_amount);end if;
    v_ret:=round(v_gross*coalesce(v_part.retention_percentage,0)/100,2);
    v_net:=greatest(round(v_gross-v_ret,2),0);
    insert into public.participation_calculation_lines(
      participation_calculation_id,contract_participant_id,party_id,sequence_no,percentage,
      calculation_base,gross_share,retention_percentage,retention_amount,net_payable,
      calculation_memory,status
    ) values(
      v_calc.id,v_part.id,v_part.party_id,v_seq,v_part.percentage,v_base,v_gross,
      coalesce(v_part.retention_percentage,0),v_ret,v_net,
      jsonb_build_object('contract_version_id',v_calc.contract_version_id,'participant_id',v_part.id,'base',v_base,'percentage',v_part.percentage,'minimum',v_part.minimum_amount,'maximum',v_part.maximum_amount,'retention_percentage',coalesce(v_part.retention_percentage,0)),
      case when v_net=0 then 'held' else 'calculated' end
    );
  end loop;
  if v_count=0 then raise exception 'A versão contratual não possui participantes ativos.';end if;
  update public.participation_calculations set status='calculated' where id=v_calc.id and version=p_expected_version returning * into v_calc;
  return to_jsonb(v_calc);
end$$;

create or replace function public.admin_submit_participation(
  p_calculation_id uuid,p_expected_version integer,p_actor_user_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_calc public.participation_calculations;v_unit text;v_count integer;v_total numeric;
begin
 select * into v_calc from public.participation_calculations where id=p_calculation_id for update;
 if not found or v_calc.version<>p_expected_version then return null;end if;
 v_unit:=private.unit_code_for_id(v_calc.business_unit_id);
 if not private.user_has_permission(p_actor_user_id,'participation.manage',v_unit) then raise exception 'Permissão insuficiente para submeter apuração.';end if;
 if v_calc.status<>'calculated' then raise exception 'Somente apuração calculada pode ser submetida.';end if;
 select count(*),coalesce(sum(net_payable),0) into v_count,v_total from public.participation_calculation_lines where participation_calculation_id=v_calc.id and status<>'cancelled';
 if v_count=0 then raise exception 'A apuração não possui memória por participante.';end if;
 if v_total>greatest(v_calc.distributable_base,0) then raise exception 'O total líquido dos participantes excede a base distribuível.';end if;
 update public.participation_calculations set status='pending_approval',requested_by=p_actor_user_id,requested_at=now() where id=v_calc.id and version=p_expected_version returning * into v_calc;
 insert into public.participation_approvals(participation_calculation_id,requester_id) values(v_calc.id,p_actor_user_id);
 return to_jsonb(v_calc);
end$$;

create or replace function public.admin_decide_participation(
  p_calculation_id uuid,p_expected_version integer,p_actor_user_id uuid,p_approve boolean,p_reason text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_calc public.participation_calculations;v_unit text;
begin
 select * into v_calc from public.participation_calculations where id=p_calculation_id for update;
 if not found or v_calc.version<>p_expected_version then return null;end if;
 v_unit:=private.unit_code_for_id(v_calc.business_unit_id);
 if not private.user_has_permission(p_actor_user_id,'participation.approve',v_unit) then raise exception 'Permissão insuficiente para decidir apuração.';end if;
 if v_calc.status<>'pending_approval' then raise exception 'Apuração não está aguardando aprovação.';end if;
 if v_calc.requested_by=p_actor_user_id or v_calc.created_by=p_actor_user_id then raise exception 'O criador ou solicitante não pode aprovar a própria apuração.';end if;
 update public.participation_approvals set approver_id=p_actor_user_id,decision=case when p_approve then 'approved' else 'rejected' end,reason=p_reason,decided_at=now()
 where id=(select id from public.participation_approvals where participation_calculation_id=v_calc.id and decision='pending' order by requested_at desc limit 1);
 update public.participation_calculations set status=case when p_approve then 'approved' else 'calculated' end,approved_by=case when p_approve then p_actor_user_id else null end,approved_at=case when p_approve then now() else null end where id=v_calc.id and version=p_expected_version returning * into v_calc;
 return to_jsonb(v_calc);
end$$;

revoke all on function public.admin_calculate_participation(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.admin_submit_participation(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.admin_decide_participation(uuid,integer,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.admin_calculate_participation(uuid,integer,uuid),public.admin_submit_participation(uuid,integer,uuid),public.admin_decide_participation(uuid,integer,uuid,boolean,text) to service_role;