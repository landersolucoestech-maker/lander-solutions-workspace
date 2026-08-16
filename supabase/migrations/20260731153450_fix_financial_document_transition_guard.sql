create or replace function private.protect_consolidated_financial_document()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if tg_op='DELETE' then
    if old.status <> 'draft' or old.journal_entry_id is not null then
      raise exception 'Somente documento em rascunho e não postado pode ser excluído.';
    end if;
    return old;
  end if;

  if old.status='pending_approval' then
    if new.status not in ('approved','issued') then
      raise exception 'Documento submetido somente pode ser aprovado ou emitido pela ação administrativa.';
    end if;

    if row(
      new.legal_entity_id,new.business_unit_id,new.product_id,new.service_line_id,
      new.project_id,new.contract_id,new.party_id,new.cost_center_id,new.revenue_center_id,
      new.category_id,new.document_nature,new.source_type,new.document_number,new.description,
      new.issue_date,new.competence_date,new.due_date,new.original_currency_code,
      new.original_amount,new.fx_rate,new.fx_date,new.fx_source,new.functional_currency_code,
      new.tax_amount_functional,new.fee_amount_functional,new.classification_status,
      new.classification_due_at,new.classification_responsible_user_id,
      new.counterparty_account_id,new.submitted_by,new.submitted_at,
      new.external_reference,new.notes,new.created_by
    ) is distinct from row(
      old.legal_entity_id,old.business_unit_id,old.product_id,old.service_line_id,
      old.project_id,old.contract_id,old.party_id,old.cost_center_id,old.revenue_center_id,
      old.category_id,old.document_nature,old.source_type,old.document_number,old.description,
      old.issue_date,old.competence_date,old.due_date,old.original_currency_code,
      old.original_amount,old.fx_rate,old.fx_date,old.fx_source,old.functional_currency_code,
      old.tax_amount_functional,old.fee_amount_functional,old.classification_status,
      old.classification_due_at,old.classification_responsible_user_id,
      old.counterparty_account_id,old.submitted_by,old.submitted_at,
      old.external_reference,old.notes,old.created_by
    ) then
      raise exception 'Documento submetido é imutável até a decisão administrativa.';
    end if;
    return new;
  end if;

  if old.status in ('approved','issued','partially_settled','settled','reversed')
     or old.journal_entry_id is not null then
    if old.status in ('approved','issued') and new.status not in ('approved','issued','partially_settled','settled','reversed') then
      raise exception 'Transição de documento financeiro inválida.';
    elsif old.status='partially_settled' and new.status not in ('partially_settled','settled','reversed') then
      raise exception 'Transição de documento parcialmente liquidado inválida.';
    elsif old.status='settled' and new.status not in ('settled','reversed') then
      raise exception 'Documento liquidado somente pode ser estornado.';
    elsif old.status='reversed' and new.status<>'reversed' then
      raise exception 'Documento estornado é imutável.';
    end if;

    if row(
      new.legal_entity_id,new.business_unit_id,new.product_id,new.service_line_id,
      new.project_id,new.contract_id,new.party_id,new.cost_center_id,new.revenue_center_id,
      new.category_id,new.document_nature,new.source_type,new.document_number,new.description,
      new.issue_date,new.competence_date,new.due_date,new.original_currency_code,
      new.original_amount,new.fx_rate,new.fx_date,new.fx_source,new.functional_currency_code,
      new.tax_amount_functional,new.fee_amount_functional,new.classification_status,
      new.classification_due_at,new.classification_responsible_user_id,
      new.counterparty_account_id,new.submitted_by,new.submitted_at,
      new.approved_by,new.approved_at,new.journal_entry_id,
      new.external_reference,new.notes,new.created_by
    ) is distinct from row(
      old.legal_entity_id,old.business_unit_id,old.product_id,old.service_line_id,
      old.project_id,old.contract_id,old.party_id,old.cost_center_id,old.revenue_center_id,
      old.category_id,old.document_nature,old.source_type,old.document_number,old.description,
      old.issue_date,old.competence_date,old.due_date,old.original_currency_code,
      old.original_amount,old.fx_rate,old.fx_date,old.fx_source,old.functional_currency_code,
      old.tax_amount_functional,old.fee_amount_functional,old.classification_status,
      old.classification_due_at,old.classification_responsible_user_id,
      old.counterparty_account_id,old.submitted_by,old.submitted_at,
      old.approved_by,old.approved_at,old.journal_entry_id,
      old.external_reference,old.notes,old.created_by
    ) then
      raise exception 'Documento consolidado é imutável; utilize estorno ou liquidação.';
    end if;
  end if;

  return new;
end
$$;

revoke all on function private.protect_consolidated_financial_document() from public,anon,authenticated;