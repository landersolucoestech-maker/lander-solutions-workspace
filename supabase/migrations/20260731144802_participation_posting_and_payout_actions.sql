create or replace function public.admin_post_participation(
  p_calculation_id uuid,p_expected_version integer,p_actor_user_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_calc public.participation_calculations;v_unit text;v_period uuid;v_entry uuid;v_expense uuid;v_liability uuid;v_line record;v_total numeric;v_line_no integer:=0;v_due date;
begin
 select * into v_calc from public.participation_calculations where id=p_calculation_id for update;
 if not found or v_calc.version<>p_expected_version then return null;end if;
 v_unit:=private.unit_code_for_id(v_calc.business_unit_id);
 if not private.user_has_permission(p_actor_user_id,'participation.post',v_unit) then raise exception 'Permissão insuficiente para consolidar apuração.';end if;
 if v_calc.status<>'approved' then raise exception 'Somente apuração aprovada pode ser consolidada.';end if;
 select coalesce(sum(net_payable),0) into v_total from public.participation_calculation_lines where participation_calculation_id=v_calc.id and status<>'cancelled';
 if v_total<=0 then raise exception 'Não existe valor líquido a consolidar.';end if;
 select id into v_expense from public.managerial_accounts where code='6200' and status='active';
 select id into v_liability from public.managerial_accounts where code='2200' and status='active';
 if v_expense is null or v_liability is null then raise exception 'Contas gerenciais de participação não configuradas.';end if;
 v_period:=private.open_financial_period(v_calc.legal_entity_id,v_calc.competence_end);
 if v_period is null then raise exception 'Não existe período financeiro aberto para a competência.';end if;
 insert into public.journal_entries(legal_entity_id,financial_period_id,source_type,source_id,competence_date,description,status,created_by,validated_by)
 values(v_calc.legal_entity_id,v_period,'participation',v_calc.id,v_calc.competence_end,concat('Apuração ',v_calc.code),'draft',v_calc.created_by,v_calc.approved_by) returning id into v_entry;
 v_line_no:=1;
 insert into public.journal_lines(journal_entry_id,line_no,managerial_account_id,business_unit_id,product_id,service_line_id,contract_id,debit_amount,credit_amount,description)
 values(v_entry,v_line_no,v_expense,v_calc.business_unit_id,v_calc.product_id,v_calc.service_line_id,v_calc.contract_id,v_total,0,'Participações econômicas do período');
 for v_line in select pcl.*,cv.payment_term_days from public.participation_calculation_lines pcl join public.participation_calculations pc on pc.id=pcl.participation_calculation_id join public.contract_versions cv on cv.id=pc.contract_version_id where pcl.participation_calculation_id=v_calc.id and pcl.status<>'cancelled' and pcl.net_payable>0 order by pcl.sequence_no loop
   v_line_no:=v_line_no+1;
   insert into public.journal_lines(journal_entry_id,line_no,managerial_account_id,business_unit_id,product_id,service_line_id,contract_id,party_id,debit_amount,credit_amount,description)
   values(v_entry,v_line_no,v_liability,v_calc.business_unit_id,v_calc.product_id,v_calc.service_line_id,v_calc.contract_id,v_line.party_id,0,v_line.net_payable,'Valor devido ao participante');
   v_due:=v_calc.competence_end+coalesce(v_line.payment_term_days,0);
   insert into public.payout_obligations(participation_calculation_line_id,participation_calculation_id,party_id,business_unit_id,contract_id,currency_code,amount,due_date,status)
   values(v_line.id,v_calc.id,v_line.party_id,v_calc.business_unit_id,v_calc.contract_id,v_calc.currency_code,v_line.net_payable,v_due,case when v_line.status='held' then 'held' else 'open' end);
   update public.participation_calculation_lines set status=case when status='held' then 'held' else 'payable' end where id=v_line.id;
 end loop;
 update public.journal_entries set status='posted',posting_date=current_date,posted_by=p_actor_user_id,posted_at=now() where id=v_entry and total_debit=total_credit and total_debit>0;
 if not found then raise exception 'O lançamento de participação não está balanceado.';end if;
 update public.participation_calculations set status='posted',posted_by=p_actor_user_id,posted_at=now(),journal_entry_id=v_entry where id=v_calc.id and version=p_expected_version returning * into v_calc;
 return to_jsonb(v_calc);
end$$;

create or replace function public.admin_post_payout_payment(
 p_payment_id uuid,p_expected_version integer,p_actor_user_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_payment public.payout_payments;v_obligation public.payout_obligations;v_settlement public.financial_settlements;v_unit text;v_remaining numeric;
begin
 select * into v_payment from public.payout_payments where id=p_payment_id for update;
 if not found or v_payment.version<>p_expected_version then return null;end if;
 select * into v_obligation from public.payout_obligations where id=v_payment.payout_obligation_id for update;
 v_unit:=private.unit_code_for_id(v_obligation.business_unit_id);
 if not private.user_has_permission(p_actor_user_id,'payout.manage',v_unit) then raise exception 'Permissão insuficiente para registrar pagamento.';end if;
 if v_payment.status<>'draft' then raise exception 'Pagamento já consolidado.';end if;
 if v_payment.financial_settlement_id is null then raise exception 'Pagamento deve estar vinculado a uma liquidação financeira postada.';end if;
 select * into v_settlement from public.financial_settlements where id=v_payment.financial_settlement_id;
 if not found or v_settlement.status<>'posted' then raise exception 'Liquidação financeira não está postada.';end if;
 if v_payment.currency_code<>v_obligation.currency_code then raise exception 'Moeda do pagamento diverge da obrigação.';end if;
 v_remaining:=v_obligation.amount-v_obligation.paid_amount;
 if v_payment.amount>v_remaining then raise exception 'Pagamento excede o saldo da obrigação.';end if;
 update public.payout_payments set status='posted',posted_by=p_actor_user_id,posted_at=now() where id=v_payment.id and version=p_expected_version returning * into v_payment;
 return to_jsonb(v_payment);
end$$;

revoke all on function public.admin_post_participation(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.admin_post_payout_payment(uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.admin_post_participation(uuid,integer,uuid),public.admin_post_payout_payment(uuid,integer,uuid) to service_role;