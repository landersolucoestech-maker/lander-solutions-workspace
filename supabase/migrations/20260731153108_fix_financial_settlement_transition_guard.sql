create or replace function private.protect_posted_settlement()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if tg_op='DELETE' then
    if old.status <> 'draft' then
      raise exception 'Somente liquidação em rascunho pode ser excluída.';
    end if;
    return old;
  end if;

  if old.status='pending_approval' then
    if new.status <> 'posted' then
      raise exception 'Liquidação submetida somente pode ser postada pela ação administrativa.';
    end if;

    if row(
      new.financial_document_id,
      new.cash_account_id,
      new.settlement_date,
      new.original_currency_code,
      new.original_amount,
      new.fx_rate,
      new.bank_fee_functional,
      new.fee_account_id,
      new.requested_by,
      new.requested_at,
      new.external_reference,
      new.notes
    ) is distinct from row(
      old.financial_document_id,
      old.cash_account_id,
      old.settlement_date,
      old.original_currency_code,
      old.original_amount,
      old.fx_rate,
      old.bank_fee_functional,
      old.fee_account_id,
      old.requested_by,
      old.requested_at,
      old.external_reference,
      old.notes
    ) then
      raise exception 'Liquidação submetida é imutável até a postagem administrativa.';
    end if;
    return new;
  end if;

  if old.status='posted' then
    if new.status not in ('posted','reversed') then
      raise exception 'Liquidação postada somente pode permanecer postada ou ser estornada.';
    end if;

    if row(
      new.financial_document_id,
      new.cash_account_id,
      new.settlement_date,
      new.original_currency_code,
      new.original_amount,
      new.fx_rate,
      new.bank_fee_functional,
      new.fee_account_id,
      new.requested_by,
      new.requested_at,
      new.posted_by,
      new.posted_at,
      new.journal_entry_id,
      new.external_reference,
      new.notes
    ) is distinct from row(
      old.financial_document_id,
      old.cash_account_id,
      old.settlement_date,
      old.original_currency_code,
      old.original_amount,
      old.fx_rate,
      old.bank_fee_functional,
      old.fee_account_id,
      old.requested_by,
      old.requested_at,
      old.posted_by,
      old.posted_at,
      old.journal_entry_id,
      old.external_reference,
      old.notes
    ) then
      raise exception 'Liquidação postada é imutável.';
    end if;
    return new;
  end if;

  if old.status='reversed' then
    if row(
      new.financial_document_id,
      new.cash_account_id,
      new.settlement_date,
      new.original_currency_code,
      new.original_amount,
      new.fx_rate,
      new.bank_fee_functional,
      new.fee_account_id,
      new.status,
      new.requested_by,
      new.requested_at,
      new.posted_by,
      new.posted_at,
      new.journal_entry_id,
      new.external_reference,
      new.notes
    ) is distinct from row(
      old.financial_document_id,
      old.cash_account_id,
      old.settlement_date,
      old.original_currency_code,
      old.original_amount,
      old.fx_rate,
      old.bank_fee_functional,
      old.fee_account_id,
      old.status,
      old.requested_by,
      old.requested_at,
      old.posted_by,
      old.posted_at,
      old.journal_entry_id,
      old.external_reference,
      old.notes
    ) then
      raise exception 'Liquidação estornada é imutável.';
    end if;
  end if;

  return new;
end
$$;

revoke all on function private.protect_posted_settlement() from public,anon,authenticated;