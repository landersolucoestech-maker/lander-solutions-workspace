create or replace function public.admin_post_participation(
  p_calculation_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_calc public.participation_calculations;
  v_unit text;
  v_period uuid;
  v_entry uuid;
  v_expense uuid;
  v_liability uuid;
  v_line record;
  v_total_functional numeric := 0;
  v_line_no integer := 0;
  v_due date;
  v_document uuid;
  v_document_number text;
  v_functional_currency text;
  v_fx_rate numeric;
  v_fx_date date;
  v_fx_source text;
  v_functional_amount numeric;
begin
  select * into v_calc
  from public.participation_calculations
  where id=p_calculation_id
  for update;

  if not found or v_calc.version<>p_expected_version then
    return null;
  end if;

  v_unit:=private.unit_code_for_id(v_calc.business_unit_id);
  if not private.user_has_permission(p_actor_user_id,'participation.post',v_unit) then
    raise exception 'Permissão insuficiente para consolidar apuração.';
  end if;
  if v_calc.status<>'approved' then
    raise exception 'Somente apuração aprovada pode ser consolidada.';
  end if;
  if exists (
    select 1 from public.payout_obligations
    where participation_calculation_id=v_calc.id
  ) then
    raise exception 'A apuração já possui obrigações de repasse.';
  end if;

  select id into v_expense
  from public.managerial_accounts
  where code='6200' and status='active' and posting_allowed;

  select id into v_liability
  from public.managerial_accounts
  where code='2200' and status='active' and posting_allowed;

  if v_expense is null or v_liability is null then
    raise exception 'Contas gerenciais de participação não configuradas.';
  end if;

  select functional_currency_code into v_functional_currency
  from public.legal_entities
  where id=v_calc.legal_entity_id;

  if v_functional_currency is null then
    raise exception 'Moeda funcional da pessoa jurídica não configurada.';
  end if;

  if v_calc.currency_code=v_functional_currency then
    v_fx_rate:=1;
    v_fx_date:=v_calc.competence_end;
    v_fx_source:='functional_currency';
  else
    select er.rate,er.rate_date,er.source
    into v_fx_rate,v_fx_date,v_fx_source
    from public.exchange_rates er
    where er.base_currency_code=v_calc.currency_code
      and er.quote_currency_code=v_functional_currency
      and er.status='active'
      and er.rate_date<=v_calc.competence_end
    order by er.rate_date desc,er.created_at desc
    limit 1;

    if v_fx_rate is null then
      raise exception 'Não existe cotação ativa de % para % até a competência.',v_calc.currency_code,v_functional_currency;
    end if;
  end if;

  select coalesce(sum(round(net_payable*v_fx_rate,2)),0)
  into v_total_functional
  from public.participation_calculation_lines
  where participation_calculation_id=v_calc.id
    and status<>'cancelled';

  if v_total_functional<=0 then
    raise exception 'Não existe valor líquido a consolidar.';
  end if;

  v_period:=private.open_financial_period(v_calc.legal_entity_id,v_calc.competence_end);
  if v_period is null then
    raise exception 'Não existe período financeiro aberto para a competência.';
  end if;

  insert into public.journal_entries(
    legal_entity_id,financial_period_id,source_type,source_id,competence_date,
    description,status,created_by,validated_by
  ) values(
    v_calc.legal_entity_id,v_period,'participation',v_calc.id,v_calc.competence_end,
    concat('Apuração ',v_calc.code),'draft',v_calc.created_by,v_calc.approved_by
  ) returning id into v_entry;

  v_line_no:=1;
  insert into public.journal_lines(
    journal_entry_id,line_no,managerial_account_id,business_unit_id,
    product_id,service_line_id,contract_id,debit_amount,credit_amount,
    original_currency_code,original_amount,fx_rate,description
  ) values(
    v_entry,v_line_no,v_expense,v_calc.business_unit_id,
    v_calc.product_id,v_calc.service_line_id,v_calc.contract_id,
    v_total_functional,0,v_calc.currency_code,
    (select coalesce(sum(net_payable),0) from public.participation_calculation_lines where participation_calculation_id=v_calc.id and status<>'cancelled'),
    v_fx_rate,'Participações econômicas do período'
  );

  for v_line in
    select pcl.*,cv.payment_term_days
    from public.participation_calculation_lines pcl
    join public.participation_calculations pc on pc.id=pcl.participation_calculation_id
    join public.contract_versions cv on cv.id=pc.contract_version_id
    where pcl.participation_calculation_id=v_calc.id
      and pcl.status<>'cancelled'
      and pcl.net_payable>0
    order by pcl.sequence_no
  loop
    v_functional_amount:=round(v_line.net_payable*v_fx_rate,2);
    v_line_no:=v_line_no+1;

    insert into public.journal_lines(
      journal_entry_id,line_no,managerial_account_id,business_unit_id,
      product_id,service_line_id,contract_id,party_id,
      debit_amount,credit_amount,original_currency_code,original_amount,fx_rate,description
    ) values(
      v_entry,v_line_no,v_liability,v_calc.business_unit_id,
      v_calc.product_id,v_calc.service_line_id,v_calc.contract_id,v_line.party_id,
      0,v_functional_amount,v_calc.currency_code,v_line.net_payable,v_fx_rate,
      'Valor devido ao participante'
    );

    v_due:=v_calc.competence_end+coalesce(v_line.payment_term_days,0);
    v_document_number:=concat('REP-',left(replace(v_calc.id::text,'-',''),12),'-',lpad(v_line.sequence_no::text,4,'0'));

    insert into public.financial_documents(
      legal_entity_id,business_unit_id,product_id,service_line_id,contract_id,party_id,
      document_nature,source_type,document_number,description,
      issue_date,competence_date,due_date,
      original_currency_code,original_amount,fx_rate,fx_date,fx_source,
      functional_currency_code,
      classification_status,counterparty_account_id,status,
      external_reference,created_by
    ) values(
      v_calc.legal_entity_id,v_calc.business_unit_id,v_calc.product_id,v_calc.service_line_id,
      v_calc.contract_id,v_line.party_id,
      'payable','other',v_document_number,concat('Repasse de participação — ',v_calc.code),
      v_calc.competence_end,v_calc.competence_end,v_due,
      v_calc.currency_code,v_line.net_payable,v_fx_rate,v_fx_date,v_fx_source,
      v_functional_currency,
      'classified',v_liability,'draft',
      v_line.id::text,v_calc.created_by
    ) returning id into v_document;

    insert into public.financial_document_lines(
      financial_document_id,sequence_no,managerial_account_id,
      product_id,service_line_id,description,original_amount,functional_amount,
      allocation_status
    ) values(
      v_document,1,v_expense,v_calc.product_id,v_calc.service_line_id,
      'Participação econômica apurada',v_line.net_payable,v_functional_amount,'direct'
    );

    update public.financial_documents
    set status='approved',
        submitted_by=v_calc.requested_by,
        submitted_at=v_calc.requested_at,
        approved_by=v_calc.approved_by,
        approved_at=v_calc.approved_at,
        journal_entry_id=v_entry
    where id=v_document;

    insert into public.payout_obligations(
      participation_calculation_line_id,participation_calculation_id,
      financial_document_id,party_id,business_unit_id,contract_id,currency_code,
      amount,due_date,status
    ) values(
      v_line.id,v_calc.id,v_document,v_line.party_id,v_calc.business_unit_id,
      v_calc.contract_id,v_calc.currency_code,v_line.net_payable,v_due,
      case when v_line.status='held' then 'held' else 'open' end
    );

    update public.participation_calculation_lines
    set status=case when status='held' then 'held' else 'payable' end
    where id=v_line.id;
  end loop;

  update public.journal_entries
  set status='posted',posting_date=v_calc.competence_end,
      posted_by=p_actor_user_id,posted_at=now()
  where id=v_entry
    and total_debit=total_credit
    and total_debit>0;

  if not found then
    raise exception 'O lançamento de participação não está balanceado.';
  end if;

  update public.participation_calculations
  set status='posted',posted_by=p_actor_user_id,posted_at=now(),journal_entry_id=v_entry
  where id=v_calc.id and version=p_expected_version
  returning * into v_calc;

  return to_jsonb(v_calc);
end
$$;

revoke all on function public.admin_post_participation(uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.admin_post_participation(uuid,integer,uuid) to service_role;