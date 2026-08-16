create or replace function public.admin_apply_fiscal_event(
  p_event_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid,
  p_accept boolean,
  p_protocol text default null,
  p_response_code text default null,
  p_response_message text default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_event public.financial_fiscal_events;
  v_fiscal public.financial_fiscal_documents;
  v_unit text;
begin
  select * into v_event from public.financial_fiscal_events where id=p_event_id for update;
  if not found or v_event.version<>p_expected_version then return null; end if;
  select * into v_fiscal from public.financial_fiscal_documents where id=v_event.fiscal_document_id for update;
  v_unit:=private.financial_document_unit_code(v_fiscal.financial_document_id);
  if not private.user_has_permission(p_actor_user_id,'fiscal.manage',v_unit) then raise exception 'Permissão insuficiente para processar evento fiscal.'; end if;
  if v_event.event_status<>'pending' then raise exception 'Evento fiscal já foi processado.'; end if;

  update public.financial_fiscal_events
  set event_status=case when p_accept then 'accepted' else 'rejected' end,
      protocol=coalesce(p_protocol,protocol),response_code=p_response_code,response_message=p_response_message
  where id=v_event.id and version=p_expected_version
  returning * into v_event;

  if p_accept then
    if v_event.event_type='authorization' then
      update public.financial_fiscal_documents set status='authorized',authorization_protocol=coalesce(p_protocol,v_event.protocol),authorized_at=v_event.occurred_at where id=v_fiscal.id;
    elsif v_event.event_type='cancellation' then
      update public.financial_fiscal_documents set status='cancelled',cancelled_at=v_event.occurred_at,cancellation_reason=coalesce(v_event.reason,p_response_message,'Cancelamento fiscal autorizado') where id=v_fiscal.id;
    elsif v_event.event_type='correction' then
      update public.financial_fiscal_documents set status='corrected' where id=v_fiscal.id;
    elsif v_event.event_type='denial' then
      update public.financial_fiscal_documents set status='denied' where id=v_fiscal.id;
    end if;
  end if;
  return to_jsonb(v_event);
end$$;

create or replace function public.admin_submit_financial_adjustment(
  p_adjustment_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_row public.financial_adjustments;v_unit text;
begin
  select * into v_row from public.financial_adjustments where id=p_adjustment_id for update;
  if not found or v_row.version<>p_expected_version then return null; end if;
  v_unit:=private.financial_document_unit_code(v_row.source_document_id);
  if not private.user_has_permission(p_actor_user_id,'finance.adjustments.manage',v_unit) then raise exception 'Permissão insuficiente para submeter ajuste.'; end if;
  if v_row.status<>'draft' then raise exception 'Somente ajuste em rascunho pode ser submetido.'; end if;
  update public.financial_adjustments set status='pending_approval',requested_by=p_actor_user_id,requested_at=now(),decision_reason=null where id=v_row.id and version=p_expected_version returning * into v_row;
  return to_jsonb(v_row);
end$$;

create or replace function public.admin_decide_financial_adjustment(
  p_adjustment_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid,
  p_approve boolean,
  p_reason text default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_row public.financial_adjustments;v_unit text;
begin
  select * into v_row from public.financial_adjustments where id=p_adjustment_id for update;
  if not found or v_row.version<>p_expected_version then return null; end if;
  v_unit:=private.financial_document_unit_code(v_row.source_document_id);
  if not private.user_has_permission(p_actor_user_id,'finance.adjustments.approve',v_unit) then raise exception 'Permissão insuficiente para decidir ajuste.'; end if;
  if v_row.status<>'pending_approval' then raise exception 'Ajuste não está aguardando aprovação.'; end if;
  if v_row.requested_by=p_actor_user_id or v_row.created_by=p_actor_user_id then raise exception 'O criador ou solicitante não pode aprovar o próprio ajuste.'; end if;
  if not p_approve and nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'Informe o motivo da rejeição.'; end if;
  update public.financial_adjustments
  set status=case when p_approve then 'approved' else 'rejected' end,
      approved_by=p_actor_user_id,approved_at=now(),decision_reason=p_reason
  where id=v_row.id and version=p_expected_version returning * into v_row;
  return to_jsonb(v_row);
end$$;

create or replace function public.admin_post_financial_adjustment(
  p_adjustment_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_adjustment public.financial_adjustments;
  v_source public.financial_documents;
  v_unit text;
  v_new_doc uuid:=gen_random_uuid();
  v_new_version integer;
  v_ratio numeric;
  v_line record;
  v_nature text;
  v_source_type text;
  v_number text;
  v_result jsonb;
begin
  select * into v_adjustment from public.financial_adjustments where id=p_adjustment_id for update;
  if not found or v_adjustment.version<>p_expected_version then return null; end if;
  select * into v_source from public.financial_documents where id=v_adjustment.source_document_id for update;
  v_unit:=private.unit_code_for_id(v_source.business_unit_id);
  if not private.user_has_permission(p_actor_user_id,'finance.adjustments.post',v_unit) then raise exception 'Permissão insuficiente para postar ajuste.'; end if;
  if v_adjustment.status<>'approved' then raise exception 'Somente ajuste aprovado pode ser postado.'; end if;
  if v_adjustment.adjustment_document_id is not null then raise exception 'Ajuste já possui documento gerado.'; end if;
  if v_adjustment.approved_by is null or v_adjustment.approved_by=v_adjustment.requested_by then raise exception 'Ajuste exige aprovação segregada válida.'; end if;

  v_ratio:=v_adjustment.original_amount/v_source.original_amount;
  v_nature:=case when v_source.document_nature='receivable' then 'payable' else 'receivable' end;
  v_source_type:=case v_adjustment.adjustment_type when 'refund' then 'refund' when 'chargeback' then 'chargeback' when 'reimbursement' then 'reimbursement' else 'other' end;
  v_number:=concat('ADJ-',left(replace(v_adjustment.id::text,'-',''),16));

  insert into public.financial_documents(
    id,legal_entity_id,business_unit_id,product_id,service_line_id,project_id,contract_id,party_id,
    cost_center_id,revenue_center_id,category_id,document_nature,source_type,document_number,description,
    issue_date,competence_date,due_date,original_currency_code,original_amount,fx_rate,fx_date,fx_source,
    functional_currency_code,tax_amount_functional,fee_amount_functional,classification_status,
    counterparty_account_id,status,external_reference,notes,created_by
  ) values(
    v_new_doc,v_source.legal_entity_id,v_source.business_unit_id,v_source.product_id,v_source.service_line_id,
    v_source.project_id,v_source.contract_id,v_source.party_id,v_source.cost_center_id,v_source.revenue_center_id,
    v_source.category_id,v_nature,v_source_type,v_number,concat('Ajuste ',v_adjustment.adjustment_type,' do documento ',v_source.document_number),
    v_adjustment.adjustment_date,v_adjustment.adjustment_date,v_adjustment.due_date,v_adjustment.original_currency_code,
    v_adjustment.original_amount,v_source.fx_rate,v_source.fx_date,v_source.fx_source,v_source.functional_currency_code,
    round(v_source.tax_amount_functional*v_ratio,6),0,'classified',v_adjustment.counterparty_account_id,'draft',
    coalesce(v_adjustment.external_reference,v_adjustment.id::text),v_adjustment.reason,v_adjustment.requested_by
  );

  for v_line in select * from public.financial_document_lines where financial_document_id=v_source.id order by sequence_no loop
    insert into public.financial_document_lines(
      financial_document_id,sequence_no,managerial_account_id,category_id,cost_center_id,revenue_center_id,
      project_id,product_id,service_line_id,description,original_amount,functional_amount,tax_amount_functional,allocation_status
    ) values(
      v_new_doc,v_line.sequence_no,v_line.managerial_account_id,v_line.category_id,v_line.cost_center_id,v_line.revenue_center_id,
      v_line.project_id,v_line.product_id,v_line.service_line_id,concat('Ajuste: ',v_line.description),
      round(v_line.original_amount*v_ratio,2),round(v_line.functional_amount*v_ratio,6),round(v_line.tax_amount_functional*v_ratio,6),v_line.allocation_status
    );
  end loop;

  update public.financial_documents set status='pending_approval',submitted_by=v_adjustment.requested_by,submitted_at=v_adjustment.requested_at where id=v_new_doc;
  insert into public.financial_approvals(object_type,object_id,requested_by,decision) values('document',v_new_doc,v_adjustment.requested_by,'pending');
  select version into v_new_version from public.financial_documents where id=v_new_doc;
  v_result:=public.admin_approve_financial_document(v_new_doc,v_new_version,p_actor_user_id);
  if v_result is null then raise exception 'Documento de ajuste foi alterado durante a postagem.'; end if;

  update public.financial_adjustments
  set status='posted',adjustment_document_id=v_new_doc,posted_by=p_actor_user_id,posted_at=now()
  where id=v_adjustment.id and version=p_expected_version returning * into v_adjustment;
  return to_jsonb(v_adjustment);
end$$;

create or replace function public.admin_submit_bank_reconciliation(
  p_reconciliation_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_row public.bank_reconciliations;v_import public.bank_statement_imports;v_unmatched integer;
begin
  select * into v_row from public.bank_reconciliations where id=p_reconciliation_id for update;
  if not found or v_row.version<>p_expected_version then return null; end if;
  if not private.user_has_permission(p_actor_user_id,'reconciliation.manage',null) then raise exception 'Permissão insuficiente para submeter conciliação.'; end if;
  if v_row.status not in ('draft','reopened') then raise exception 'Conciliação não pode ser submetida neste estado.'; end if;
  select * into v_import from public.bank_statement_imports where id=v_row.statement_import_id for update;
  if v_import.cash_account_id<>v_row.cash_account_id then raise exception 'Extrato e conciliação pertencem a contas diferentes.'; end if;
  select count(*) into v_unmatched from public.bank_statement_lines where statement_import_id=v_import.id and match_status='unmatched';
  if v_unmatched>0 then raise exception 'Existem linhas do extrato sem conciliação ou justificativa.'; end if;
  if round(v_row.difference,2)<>0 then raise exception 'Conciliação possui diferença entre banco e razão.'; end if;
  update public.bank_statement_imports set status='validated' where id=v_import.id and status='uploaded';
  update public.bank_reconciliations set status='pending_approval',requested_by=p_actor_user_id,requested_at=now() where id=v_row.id and version=p_expected_version returning * into v_row;
  return to_jsonb(v_row);
end$$;

create or replace function public.admin_decide_bank_reconciliation(
  p_reconciliation_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid,
  p_approve boolean,
  p_reason text default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_row public.bank_reconciliations;v_unmatched integer;
begin
  select * into v_row from public.bank_reconciliations where id=p_reconciliation_id for update;
  if not found or v_row.version<>p_expected_version then return null; end if;
  if not private.user_has_permission(p_actor_user_id,'reconciliation.approve',null) then raise exception 'Permissão insuficiente para decidir conciliação.'; end if;
  if v_row.status<>'pending_approval' then raise exception 'Conciliação não está aguardando aprovação.'; end if;
  if v_row.requested_by=p_actor_user_id or v_row.created_by=p_actor_user_id then raise exception 'O criador ou solicitante não pode aprovar a própria conciliação.'; end if;
  if not p_approve and nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'Informe o motivo da rejeição.'; end if;
  select count(*) into v_unmatched from public.bank_statement_lines where statement_import_id=v_row.statement_import_id and match_status='unmatched';
  if p_approve and (v_unmatched>0 or round(v_row.difference,2)<>0) then raise exception 'Conciliação deixou de atender aos critérios de fechamento.'; end if;
  update public.bank_reconciliations set status=case when p_approve then 'closed' else 'reopened' end,approved_by=p_actor_user_id,approved_at=now(),reopening_reason=case when p_approve then null else p_reason end where id=v_row.id and version=p_expected_version returning * into v_row;
  update public.bank_statement_imports set status=case when p_approve then 'reconciled' else 'validated' end where id=v_row.statement_import_id;
  return to_jsonb(v_row);
end$$;

create or replace function private.refresh_period_close_counts(p_run_id uuid) returns public.financial_period_close_runs
language plpgsql security definer set search_path='' as $$
declare v_run public.financial_period_close_runs;v_period public.financial_periods;
begin
  select * into v_run from public.financial_period_close_runs where id=p_run_id for update;
  select * into v_period from public.financial_periods where id=v_run.financial_period_id;
  update public.financial_period_close_runs set
    open_documents_count=(select count(*) from public.financial_documents where legal_entity_id=v_period.legal_entity_id and competence_date between v_period.period_start and v_period.period_end and status in ('draft','pending_approval')),
    pending_settlements_count=(select count(*) from public.financial_settlements fs join public.financial_documents fd on fd.id=fs.financial_document_id where fd.legal_entity_id=v_period.legal_entity_id and fs.settlement_date between v_period.period_start and v_period.period_end and fs.status in ('draft','pending_approval')),
    pending_adjustments_count=(select count(*) from public.financial_adjustments fa join public.financial_documents fd on fd.id=fa.source_document_id where fd.legal_entity_id=v_period.legal_entity_id and fa.adjustment_date between v_period.period_start and v_period.period_end and fa.status in ('draft','pending_approval','approved')),
    unreconciled_accounts_count=(select count(*) from public.bank_statement_imports bsi join public.cash_accounts ca on ca.id=bsi.cash_account_id where ca.legal_entity_id=v_period.legal_entity_id and bsi.period_end>=v_period.period_start and bsi.period_start<=v_period.period_end and bsi.status not in ('reconciled','cancelled')),
    unposted_journals_count=(select count(*) from public.journal_entries where legal_entity_id=v_period.legal_entity_id and competence_date between v_period.period_start and v_period.period_end and status in ('draft','validated'))
  where id=v_run.id returning * into v_run;
  return v_run;
end$$;

create or replace function public.admin_prepare_period_close(
  p_period_id uuid,
  p_actor_user_id uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_period public.financial_periods;v_run public.financial_period_close_runs;
begin
  if not private.user_has_permission(p_actor_user_id,'period_close.manage',null) then raise exception 'Permissão insuficiente para preparar fechamento.'; end if;
  select * into v_period from public.financial_periods where id=p_period_id for update;
  if not found or v_period.status not in ('open','reopened') then raise exception 'Período não permite preparação de fechamento.'; end if;
  insert into public.financial_period_close_runs(financial_period_id,status,created_by)
  values(v_period.id,'draft',p_actor_user_id)
  on conflict(financial_period_id) do update set status=case when public.financial_period_close_runs.status='reopened' then 'reopened' else public.financial_period_close_runs.status end
  returning * into v_run;
  if v_run.status not in ('draft','reopened') then raise exception 'Fechamento já foi submetido ou concluído.'; end if;
  insert into public.financial_period_close_items(close_run_id,item_code,category,label,required) values
    (v_run.id,'DOCUMENTS_CLASSIFIED','documents','Todos os documentos do período foram classificados e submetidos',true),
    (v_run.id,'SETTLEMENTS_REVIEWED','settlements','Liquidações pendentes foram revisadas',true),
    (v_run.id,'BANK_RECONCILED','reconciliation','Contas financeiras e extratos OFX foram conciliados',true),
    (v_run.id,'FISCAL_REVIEWED','tax','Documentos e eventos fiscais foram revisados',true),
    (v_run.id,'LEDGER_BALANCED','ledger','Ledger está balanceado e sem lançamentos pendentes',true),
    (v_run.id,'ALLOCATIONS_POSTED','allocations','Rateios definitivos do período foram postados',true),
    (v_run.id,'PARTICIPATIONS_POSTED','participations','Apurações e participações do período foram consolidadas',true),
    (v_run.id,'EVIDENCE_ATTACHED','evidence','Evidências de fechamento foram anexadas ou referenciadas',true)
  on conflict(close_run_id,item_code) do nothing;
  v_run:=private.refresh_period_close_counts(v_run.id);
  return to_jsonb(v_run);
end$$;

create or replace function public.admin_submit_period_close(
  p_close_run_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_run public.financial_period_close_runs;v_pending integer;
begin
  select * into v_run from public.financial_period_close_runs where id=p_close_run_id for update;
  if not found or v_run.version<>p_expected_version then return null; end if;
  if not private.user_has_permission(p_actor_user_id,'period_close.manage',null) then raise exception 'Permissão insuficiente para submeter fechamento.'; end if;
  if v_run.status not in ('draft','reopened') then raise exception 'Fechamento não pode ser submetido neste estado.'; end if;
  v_run:=private.refresh_period_close_counts(v_run.id);
  select count(*) into v_pending from public.financial_period_close_items where close_run_id=v_run.id and required and status='pending';
  if v_pending>0 then raise exception 'Existem itens obrigatórios pendentes no checklist.'; end if;
  if v_run.open_documents_count+v_run.pending_settlements_count+v_run.pending_adjustments_count+v_run.unreconciled_accounts_count+v_run.unposted_journals_count>0 then raise exception 'Existem pendências operacionais que bloqueiam o fechamento.'; end if;
  update public.financial_period_close_runs set status='pending_approval',requested_by=p_actor_user_id,requested_at=now() where id=v_run.id and version=v_run.version returning * into v_run;
  update public.financial_periods set status='closing' where id=v_run.financial_period_id;
  return to_jsonb(v_run);
end$$;

create or replace function public.admin_close_period(
  p_close_run_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_run public.financial_period_close_runs;v_pending integer;
begin
  select * into v_run from public.financial_period_close_runs where id=p_close_run_id for update;
  if not found or v_run.version<>p_expected_version then return null; end if;
  if not private.user_has_permission(p_actor_user_id,'period_close.approve',null) then raise exception 'Permissão insuficiente para fechar período.'; end if;
  if v_run.status<>'pending_approval' then raise exception 'Fechamento não está aguardando aprovação.'; end if;
  if v_run.requested_by=p_actor_user_id or v_run.created_by=p_actor_user_id then raise exception 'O preparador ou solicitante não pode aprovar o próprio fechamento.'; end if;
  v_run:=private.refresh_period_close_counts(v_run.id);
  select count(*) into v_pending from public.financial_period_close_items where close_run_id=v_run.id and required and status='pending';
  if v_pending>0 or v_run.open_documents_count+v_run.pending_settlements_count+v_run.pending_adjustments_count+v_run.unreconciled_accounts_count+v_run.unposted_journals_count>0 then raise exception 'Fechamento deixou de atender aos critérios de aprovação.'; end if;
  update public.financial_period_close_runs set status='closed',approved_by=p_actor_user_id,approved_at=now(),closed_by=p_actor_user_id,closed_at=now() where id=v_run.id and version=v_run.version returning * into v_run;
  update public.financial_periods set status='closed',closed_by=p_actor_user_id,closed_at=now(),reopened_by=null,reopened_at=null,reopening_reason=null where id=v_run.financial_period_id;
  return to_jsonb(v_run);
end$$;

create or replace function public.admin_reopen_period(
  p_close_run_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid,
  p_reason text
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_run public.financial_period_close_runs;
begin
  select * into v_run from public.financial_period_close_runs where id=p_close_run_id for update;
  if not found or v_run.version<>p_expected_version then return null; end if;
  if not private.user_has_permission(p_actor_user_id,'period_close.reopen',null) then raise exception 'Permissão insuficiente para reabrir período.'; end if;
  if v_run.status<>'closed' then raise exception 'Somente fechamento concluído pode ser reaberto.'; end if;
  if nullif(btrim(coalesce(p_reason,'')),'') is null or char_length(btrim(p_reason))<5 then raise exception 'Motivo de reabertura obrigatório.'; end if;
  update public.financial_period_close_runs set status='reopened',reopening_reason=p_reason where id=v_run.id and version=p_expected_version returning * into v_run;
  update public.financial_periods set status='reopened',reopened_by=p_actor_user_id,reopened_at=now(),reopening_reason=p_reason,closed_by=null,closed_at=null where id=v_run.financial_period_id;
  return to_jsonb(v_run);
end$$;

revoke all on function public.admin_apply_fiscal_event(uuid,integer,uuid,boolean,text,text,text) from public,anon,authenticated;
revoke all on function public.admin_submit_financial_adjustment(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.admin_decide_financial_adjustment(uuid,integer,uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.admin_post_financial_adjustment(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.admin_submit_bank_reconciliation(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.admin_decide_bank_reconciliation(uuid,integer,uuid,boolean,text) from public,anon,authenticated;
revoke all on function private.refresh_period_close_counts(uuid) from public,anon,authenticated;
revoke all on function public.admin_prepare_period_close(uuid,uuid) from public,anon,authenticated;
revoke all on function public.admin_submit_period_close(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.admin_close_period(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.admin_reopen_period(uuid,integer,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_apply_fiscal_event(uuid,integer,uuid,boolean,text,text,text),public.admin_submit_financial_adjustment(uuid,integer,uuid),public.admin_decide_financial_adjustment(uuid,integer,uuid,boolean,text),public.admin_post_financial_adjustment(uuid,integer,uuid),public.admin_submit_bank_reconciliation(uuid,integer,uuid),public.admin_decide_bank_reconciliation(uuid,integer,uuid,boolean,text),public.admin_prepare_period_close(uuid,uuid),public.admin_submit_period_close(uuid,integer,uuid),public.admin_close_period(uuid,integer,uuid),public.admin_reopen_period(uuid,integer,uuid,text) to service_role;
