create or replace function private.open_financial_period(
  p_legal_entity_id uuid,
  p_date date
)
returns uuid
language sql
stable
security definer
set search_path=''
as $$
  select fp.id
  from public.financial_periods fp
  where fp.legal_entity_id=p_legal_entity_id
    and p_date between fp.period_start and fp.period_end
    and fp.status in ('open','reopened')
  order by fp.period_start desc
  limit 1
$$;

create or replace function private.assert_posting_account(p_account_id uuid)
returns void
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_allowed boolean; v_status text;
begin
  select posting_allowed,status into v_allowed,v_status
  from public.managerial_accounts where id=p_account_id;
  if not found or not v_allowed or v_status <> 'active' then
    raise exception 'Conta gerencial inválida ou não permite lançamentos.';
  end if;
end;
$$;

revoke all on function private.open_financial_period(uuid,date) from public,anon,authenticated;
revoke all on function private.assert_posting_account(uuid) from public,anon,authenticated;
grant execute on function private.open_financial_period(uuid,date) to service_role;
grant execute on function private.assert_posting_account(uuid) to service_role;

create or replace function public.admin_submit_financial_document(
  p_document_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_doc public.financial_documents; v_unit text;
begin
  select * into v_doc from public.financial_documents where id=p_document_id for update;
  if not found or v_doc.version <> p_expected_version then return null; end if;
  v_unit := private.unit_code_for_id(v_doc.business_unit_id);
  if not private.user_has_permission(p_actor_user_id,'finance.documents.manage_draft',v_unit) then
    raise exception 'Permissão insuficiente para submeter documento.';
  end if;
  if v_doc.status <> 'draft' or v_doc.journal_entry_id is not null then
    raise exception 'Somente documento em rascunho pode ser submetido.';
  end if;
  if not exists(select 1 from public.financial_document_lines where financial_document_id=v_doc.id) then
    raise exception 'O documento precisa de ao menos uma linha.';
  end if;
  update public.financial_documents
  set status='pending_approval',submitted_by=p_actor_user_id,submitted_at=now()
  where id=v_doc.id and version=p_expected_version
  returning * into v_doc;
  insert into public.financial_approvals(object_type,object_id,requested_by,decision)
  values('document',v_doc.id,p_actor_user_id,'pending');
  return to_jsonb(v_doc);
end;
$$;

create or replace function public.admin_approve_financial_document(
  p_document_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_doc public.financial_documents;
  v_unit text;
  v_period uuid;
  v_entry uuid;
  v_lines_total numeric;
  v_line_count integer;
  v_line record;
  v_counter_type text;
  v_line_no integer := 0;
begin
  select * into v_doc from public.financial_documents where id=p_document_id for update;
  if not found or v_doc.version <> p_expected_version then return null; end if;
  v_unit := private.unit_code_for_id(v_doc.business_unit_id);
  if not private.user_has_permission(p_actor_user_id,'finance.documents.approve',v_unit) then
    raise exception 'Permissão insuficiente para aprovar documento.';
  end if;
  if v_doc.status <> 'pending_approval' then
    raise exception 'Documento não está aguardando aprovação.';
  end if;
  if v_doc.submitted_by is null or v_doc.submitted_by=p_actor_user_id or v_doc.created_by=p_actor_user_id then
    raise exception 'O criador ou solicitante não pode aprovar o próprio documento.';
  end if;
  if v_doc.classification_status <> 'classified' then
    raise exception 'Documento pendente de classificação não pode ser aprovado.';
  end if;
  select count(*),coalesce(sum(functional_amount),0)
  into v_line_count,v_lines_total
  from public.financial_document_lines where financial_document_id=v_doc.id;
  if v_line_count=0 or round(v_lines_total,6) <> round(v_doc.functional_amount,6) then
    raise exception 'As linhas devem totalizar exatamente o valor funcional do documento.';
  end if;
  perform private.assert_posting_account(v_doc.counterparty_account_id);
  select account_type into v_counter_type from public.managerial_accounts where id=v_doc.counterparty_account_id;
  if v_doc.document_nature='payable' and v_counter_type <> 'liability' then
    raise exception 'Conta de contrapartida de contas a pagar deve ser passivo.';
  end if;
  if v_doc.document_nature='receivable' and v_counter_type <> 'asset' then
    raise exception 'Conta de contrapartida de contas a receber deve ser ativo.';
  end if;
  v_period := private.open_financial_period(v_doc.legal_entity_id,v_doc.competence_date);
  if v_period is null then raise exception 'Não existe período financeiro aberto para a competência.'; end if;

  insert into public.journal_entries(
    legal_entity_id,financial_period_id,source_type,source_id,competence_date,
    description,status,created_by,validated_by
  ) values(
    v_doc.legal_entity_id,v_period,'financial_document',v_doc.id,v_doc.competence_date,
    concat(v_doc.document_nature,' ',v_doc.document_number,' — ',v_doc.description),
    'draft',v_doc.created_by,p_actor_user_id
  ) returning id into v_entry;

  for v_line in
    select * from public.financial_document_lines
    where financial_document_id=v_doc.id order by sequence_no
  loop
    perform private.assert_posting_account(v_line.managerial_account_id);
    v_line_no := v_line_no+1;
    insert into public.journal_lines(
      journal_entry_id,line_no,managerial_account_id,business_unit_id,
      product_id,service_line_id,project_id,contract_id,party_id,
      cost_center_id,revenue_center_id,category_id,debit_amount,credit_amount,
      original_currency_code,original_amount,fx_rate,description
    ) values(
      v_entry,v_line_no,v_line.managerial_account_id,v_doc.business_unit_id,
      coalesce(v_line.product_id,v_doc.product_id),coalesce(v_line.service_line_id,v_doc.service_line_id),
      coalesce(v_line.project_id,v_doc.project_id),v_doc.contract_id,v_doc.party_id,
      coalesce(v_line.cost_center_id,v_doc.cost_center_id),coalesce(v_line.revenue_center_id,v_doc.revenue_center_id),
      coalesce(v_line.category_id,v_doc.category_id),
      case when v_doc.document_nature='payable' then v_line.functional_amount else 0 end,
      case when v_doc.document_nature='receivable' then v_line.functional_amount else 0 end,
      v_doc.original_currency_code,v_line.original_amount,v_doc.fx_rate,v_line.description
    );
  end loop;

  v_line_no := v_line_no+1;
  insert into public.journal_lines(
    journal_entry_id,line_no,managerial_account_id,business_unit_id,
    product_id,service_line_id,project_id,contract_id,party_id,
    cost_center_id,revenue_center_id,category_id,debit_amount,credit_amount,
    original_currency_code,original_amount,fx_rate,description
  ) values(
    v_entry,v_line_no,v_doc.counterparty_account_id,v_doc.business_unit_id,
    v_doc.product_id,v_doc.service_line_id,v_doc.project_id,v_doc.contract_id,v_doc.party_id,
    v_doc.cost_center_id,v_doc.revenue_center_id,v_doc.category_id,
    case when v_doc.document_nature='receivable' then v_doc.functional_amount else 0 end,
    case when v_doc.document_nature='payable' then v_doc.functional_amount else 0 end,
    v_doc.original_currency_code,v_doc.original_amount,v_doc.fx_rate,'Contrapartida do documento'
  );

  update public.journal_entries
  set status='posted',posting_date=current_date,posted_by=p_actor_user_id,posted_at=now()
  where id=v_entry
    and total_debit=total_credit
    and total_debit>0;
  if not found then raise exception 'O lançamento gerado não está balanceado.'; end if;

  update public.financial_documents
  set status=case when document_nature='payable' then 'approved' else 'issued' end,
      approved_by=p_actor_user_id,approved_at=now(),journal_entry_id=v_entry
  where id=v_doc.id and version=p_expected_version
  returning * into v_doc;

  update public.financial_approvals
  set approver_user_id=p_actor_user_id,decision='approved',decided_at=now()
  where id=(
    select id from public.financial_approvals
    where object_type='document' and object_id=v_doc.id and decision='pending'
    order by created_at desc limit 1
  );
  return to_jsonb(v_doc);
end;
$$;

create or replace function public.admin_submit_financial_settlement(
  p_settlement_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_row public.financial_settlements; v_unit text; v_doc_status text;
begin
  select * into v_row from public.financial_settlements where id=p_settlement_id for update;
  if not found or v_row.version <> p_expected_version then return null; end if;
  v_unit := private.financial_document_unit_code(v_row.financial_document_id);
  if not private.user_has_permission(p_actor_user_id,'finance.settlements.create',v_unit) then
    raise exception 'Permissão insuficiente para submeter liquidação.';
  end if;
  select status into v_doc_status from public.financial_documents where id=v_row.financial_document_id;
  if v_doc_status not in ('approved','issued','partially_settled') then
    raise exception 'O documento ainda não está reconhecido para liquidação.';
  end if;
  if v_row.status <> 'draft' then raise exception 'Somente liquidação em rascunho pode ser submetida.'; end if;
  update public.financial_settlements
  set status='pending_approval',requested_by=p_actor_user_id,requested_at=now()
  where id=v_row.id and version=p_expected_version
  returning * into v_row;
  insert into public.financial_approvals(object_type,object_id,requested_by,decision)
  values('settlement',v_row.id,p_actor_user_id,'pending');
  return to_jsonb(v_row);
end;
$$;

create or replace function public.admin_post_financial_settlement(
  p_settlement_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_row public.financial_settlements;
  v_doc public.financial_documents;
  v_cash public.cash_accounts;
  v_unit text;
  v_period uuid;
  v_entry uuid;
  v_line integer:=0;
  v_total_settled numeric;
  v_cash_amount numeric;
begin
  select * into v_row from public.financial_settlements where id=p_settlement_id for update;
  if not found or v_row.version <> p_expected_version then return null; end if;
  select * into v_doc from public.financial_documents where id=v_row.financial_document_id for update;
  select * into v_cash from public.cash_accounts where id=v_row.cash_account_id;
  v_unit := private.unit_code_for_id(v_doc.business_unit_id);
  if not private.user_has_permission(p_actor_user_id,'finance.settlements.post',v_unit) then
    raise exception 'Permissão insuficiente para postar liquidação.';
  end if;
  if v_row.status <> 'pending_approval' or v_row.requested_by is null then
    raise exception 'Liquidação não está aguardando aprovação.';
  end if;
  if v_row.requested_by=p_actor_user_id then
    raise exception 'O solicitante não pode postar a própria liquidação.';
  end if;
  if v_doc.status not in ('approved','issued','partially_settled') then
    raise exception 'Documento não permite liquidação.';
  end if;
  if v_cash.status <> 'active' or v_cash.legal_entity_id <> v_doc.legal_entity_id then
    raise exception 'Conta de caixa inválida para a pessoa jurídica.';
  end if;
  if v_cash.currency_code <> v_row.original_currency_code then
    raise exception 'A moeda da liquidação deve corresponder à moeda da conta de caixa.';
  end if;
  if v_doc.document_nature='receivable' and v_row.bank_fee_functional > v_row.functional_amount then
    raise exception 'Taxa bancária não pode exceder o recebimento.';
  end if;
  perform private.assert_posting_account(v_cash.managerial_account_id);
  perform private.assert_posting_account(v_doc.counterparty_account_id);
  if v_row.bank_fee_functional>0 then perform private.assert_posting_account(v_row.fee_account_id); end if;
  v_period := private.open_financial_period(v_doc.legal_entity_id,v_row.settlement_date);
  if v_period is null then raise exception 'Não existe período financeiro aberto para a data da liquidação.'; end if;

  insert into public.journal_entries(
    legal_entity_id,financial_period_id,source_type,source_id,competence_date,
    description,status,created_by,validated_by
  ) values(
    v_doc.legal_entity_id,v_period,'settlement',v_row.id,v_row.settlement_date,
    concat('Liquidação ',v_doc.document_number),'draft',v_row.requested_by,p_actor_user_id
  ) returning id into v_entry;

  if v_doc.document_nature='payable' then
    v_line:=v_line+1;
    insert into public.journal_lines(journal_entry_id,line_no,managerial_account_id,business_unit_id,product_id,service_line_id,project_id,contract_id,party_id,cost_center_id,revenue_center_id,category_id,debit_amount,credit_amount,original_currency_code,original_amount,fx_rate,description)
    values(v_entry,v_line,v_doc.counterparty_account_id,v_doc.business_unit_id,v_doc.product_id,v_doc.service_line_id,v_doc.project_id,v_doc.contract_id,v_doc.party_id,v_doc.cost_center_id,v_doc.revenue_center_id,v_doc.category_id,v_row.functional_amount,0,v_row.original_currency_code,v_row.original_amount,v_row.fx_rate,'Baixa de obrigação');
    if v_row.bank_fee_functional>0 then
      v_line:=v_line+1;
      insert into public.journal_lines(journal_entry_id,line_no,managerial_account_id,business_unit_id,party_id,cost_center_id,category_id,debit_amount,credit_amount,description)
      values(v_entry,v_line,v_row.fee_account_id,v_doc.business_unit_id,v_doc.party_id,v_doc.cost_center_id,v_doc.category_id,v_row.bank_fee_functional,0,'Taxa bancária da liquidação');
    end if;
    v_cash_amount:=v_row.functional_amount+v_row.bank_fee_functional;
    v_line:=v_line+1;
    insert into public.journal_lines(journal_entry_id,line_no,managerial_account_id,business_unit_id,party_id,credit_amount,debit_amount,original_currency_code,original_amount,fx_rate,description)
    values(v_entry,v_line,v_cash.managerial_account_id,v_doc.business_unit_id,v_doc.party_id,v_cash_amount,0,v_row.original_currency_code,v_row.original_amount,v_row.fx_rate,'Saída de caixa');
  else
    v_cash_amount:=v_row.functional_amount-v_row.bank_fee_functional;
    v_line:=v_line+1;
    insert into public.journal_lines(journal_entry_id,line_no,managerial_account_id,business_unit_id,party_id,debit_amount,credit_amount,original_currency_code,original_amount,fx_rate,description)
    values(v_entry,v_line,v_cash.managerial_account_id,v_doc.business_unit_id,v_doc.party_id,v_cash_amount,0,v_row.original_currency_code,v_row.original_amount,v_row.fx_rate,'Entrada de caixa');
    if v_row.bank_fee_functional>0 then
      v_line:=v_line+1;
      insert into public.journal_lines(journal_entry_id,line_no,managerial_account_id,business_unit_id,party_id,cost_center_id,category_id,debit_amount,credit_amount,description)
      values(v_entry,v_line,v_row.fee_account_id,v_doc.business_unit_id,v_doc.party_id,v_doc.cost_center_id,v_doc.category_id,v_row.bank_fee_functional,0,'Taxa descontada do recebimento');
    end if;
    v_line:=v_line+1;
    insert into public.journal_lines(journal_entry_id,line_no,managerial_account_id,business_unit_id,product_id,service_line_id,project_id,contract_id,party_id,cost_center_id,revenue_center_id,category_id,credit_amount,debit_amount,original_currency_code,original_amount,fx_rate,description)
    values(v_entry,v_line,v_doc.counterparty_account_id,v_doc.business_unit_id,v_doc.product_id,v_doc.service_line_id,v_doc.project_id,v_doc.contract_id,v_doc.party_id,v_doc.cost_center_id,v_doc.revenue_center_id,v_doc.category_id,v_row.functional_amount,0,v_row.original_currency_code,v_row.original_amount,v_row.fx_rate,'Baixa de direito a receber');
  end if;

  update public.journal_entries
  set status='posted',posting_date=v_row.settlement_date,posted_by=p_actor_user_id,posted_at=now()
  where id=v_entry and total_debit=total_credit and total_debit>0;
  if not found then raise exception 'Lançamento de liquidação não está balanceado.'; end if;

  update public.financial_settlements
  set status='posted',posted_by=p_actor_user_id,posted_at=now(),journal_entry_id=v_entry
  where id=v_row.id and version=p_expected_version
  returning * into v_row;

  select coalesce(sum(functional_amount),0) into v_total_settled
  from public.financial_settlements
  where financial_document_id=v_doc.id and status='posted';
  update public.financial_documents
  set status=case when v_total_settled>=functional_amount then 'settled' else 'partially_settled' end
  where id=v_doc.id;

  update public.financial_approvals
  set approver_user_id=p_actor_user_id,decision='approved',decided_at=now()
  where id=(select id from public.financial_approvals where object_type='settlement' and object_id=v_row.id and decision='pending' order by created_at desc limit 1);
  return to_jsonb(v_row);
end;
$$;

create or replace function public.admin_submit_manual_journal(
  p_entry_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_entry public.journal_entries;
begin
  select * into v_entry from public.journal_entries where id=p_entry_id for update;
  if not found or v_entry.version<>p_expected_version then return null; end if;
  if not private.user_has_permission(p_actor_user_id,'ledger.create',null) then raise exception 'Permissão insuficiente.'; end if;
  if v_entry.status<>'draft' or v_entry.source_type<>'manual' then raise exception 'Somente lançamento manual em rascunho pode ser submetido.'; end if;
  if v_entry.created_by is null or v_entry.created_by<>p_actor_user_id then raise exception 'Somente o criador pode submeter o lançamento manual.'; end if;
  if v_entry.total_debit<=0 or v_entry.total_debit<>v_entry.total_credit then raise exception 'Lançamento não está balanceado.'; end if;
  update public.journal_entries set status='validated',validated_by=p_actor_user_id where id=v_entry.id and version=p_expected_version returning * into v_entry;
  insert into public.financial_approvals(object_type,object_id,requested_by,decision) values('journal_entry',v_entry.id,p_actor_user_id,'pending');
  return to_jsonb(v_entry);
end;
$$;

create or replace function public.admin_post_manual_journal(
  p_entry_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_entry public.journal_entries; v_period uuid; v_bad integer;
begin
  select * into v_entry from public.journal_entries where id=p_entry_id for update;
  if not found or v_entry.version<>p_expected_version then return null; end if;
  if not private.user_has_permission(p_actor_user_id,'ledger.post',null) then raise exception 'Permissão insuficiente para postagem.'; end if;
  if v_entry.status<>'validated' or v_entry.source_type<>'manual' then raise exception 'Lançamento não está validado para postagem.'; end if;
  if v_entry.validated_by=p_actor_user_id or v_entry.created_by=p_actor_user_id then raise exception 'Criador ou validador não pode postar o próprio lançamento.'; end if;
  v_period:=private.open_financial_period(v_entry.legal_entity_id,v_entry.competence_date);
  if v_period is null or v_period<>v_entry.financial_period_id then raise exception 'Período financeiro não está aberto.'; end if;
  if v_entry.total_debit<=0 or v_entry.total_debit<>v_entry.total_credit then raise exception 'Lançamento não está balanceado.'; end if;
  select count(*) into v_bad
  from public.journal_lines l join public.managerial_accounts a on a.id=l.managerial_account_id
  where l.journal_entry_id=v_entry.id and (not a.posting_allowed or a.status<>'active');
  if v_bad>0 then raise exception 'Lançamento possui conta gerencial inválida.'; end if;
  update public.journal_entries set status='posted',posting_date=current_date,posted_by=p_actor_user_id,posted_at=now() where id=v_entry.id and version=p_expected_version returning * into v_entry;
  update public.financial_approvals set approver_user_id=p_actor_user_id,decision='approved',decided_at=now()
  where id=(select id from public.financial_approvals where object_type='journal_entry' and object_id=v_entry.id and decision='pending' order by created_at desc limit 1);
  return to_jsonb(v_entry);
end;
$$;

create or replace function public.admin_reverse_journal_entry(
  p_entry_id uuid,
  p_reversal_date date,
  p_reason text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_original public.journal_entries; v_period uuid; v_reversal uuid; v_line record;
begin
  if p_reason is null or char_length(btrim(p_reason))<5 then raise exception 'Motivo de estorno obrigatório.'; end if;
  select * into v_original from public.journal_entries where id=p_entry_id for update;
  if not found then return null; end if;
  if not private.user_has_permission(p_actor_user_id,'ledger.reverse',null) then raise exception 'Permissão insuficiente para estorno.'; end if;
  if v_original.status<>'posted' or v_original.reversed_by_entry_id is not null then raise exception 'Lançamento não permite estorno.'; end if;
  if v_original.posted_by=p_actor_user_id then raise exception 'O responsável pela postagem original não pode executar o próprio estorno.'; end if;
  v_period:=private.open_financial_period(v_original.legal_entity_id,p_reversal_date);
  if v_period is null then raise exception 'Não existe período aberto para a data do estorno.'; end if;
  insert into public.journal_entries(legal_entity_id,financial_period_id,source_type,source_id,competence_date,description,status,reversal_of_entry_id,created_by,validated_by)
  values(v_original.legal_entity_id,v_period,'reversal',v_original.id,p_reversal_date,concat('Estorno #',v_original.entry_number,' — ',btrim(p_reason)),'draft',v_original.id,p_actor_user_id,p_actor_user_id)
  returning id into v_reversal;
  for v_line in select * from public.journal_lines where journal_entry_id=v_original.id order by line_no loop
    insert into public.journal_lines(journal_entry_id,line_no,managerial_account_id,business_unit_id,product_id,service_line_id,project_id,contract_id,party_id,cost_center_id,revenue_center_id,category_id,debit_amount,credit_amount,original_currency_code,original_amount,fx_rate,description)
    values(v_reversal,v_line.line_no,v_line.managerial_account_id,v_line.business_unit_id,v_line.product_id,v_line.service_line_id,v_line.project_id,v_line.contract_id,v_line.party_id,v_line.cost_center_id,v_line.revenue_center_id,v_line.category_id,v_line.credit_amount,v_line.debit_amount,v_line.original_currency_code,v_line.original_amount,v_line.fx_rate,concat('Estorno: ',coalesce(v_line.description,'')));
  end loop;
  update public.journal_entries set status='posted',posting_date=p_reversal_date,posted_by=p_actor_user_id,posted_at=now() where id=v_reversal and total_debit=total_credit and total_debit>0;
  if not found then raise exception 'Estorno não está balanceado.'; end if;
  update public.journal_entries set status='reversed',reversed_by_entry_id=v_reversal where id=v_original.id;
  if v_original.source_type='financial_document' then update public.financial_documents set status='reversed' where id=v_original.source_id; end if;
  if v_original.source_type='settlement' then update public.financial_settlements set status='reversed' where id=v_original.source_id; end if;
  return (select to_jsonb(e) from public.journal_entries e where e.id=v_reversal);
end;
$$;

revoke all on function public.admin_submit_financial_document(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.admin_approve_financial_document(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.admin_submit_financial_settlement(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.admin_post_financial_settlement(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.admin_submit_manual_journal(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.admin_post_manual_journal(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.admin_reverse_journal_entry(uuid,date,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_submit_financial_document(uuid,integer,uuid) to service_role;
grant execute on function public.admin_approve_financial_document(uuid,integer,uuid) to service_role;
grant execute on function public.admin_submit_financial_settlement(uuid,integer,uuid) to service_role;
grant execute on function public.admin_post_financial_settlement(uuid,integer,uuid) to service_role;
grant execute on function public.admin_submit_manual_journal(uuid,integer,uuid) to service_role;
grant execute on function public.admin_post_manual_journal(uuid,integer,uuid) to service_role;
grant execute on function public.admin_reverse_journal_entry(uuid,date,text,uuid) to service_role;
