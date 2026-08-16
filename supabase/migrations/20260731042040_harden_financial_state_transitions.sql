create or replace function private.ensure_entry_editable()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
  v_status text;
begin
  v_id := case when tg_op='DELETE' then old.journal_entry_id else new.journal_entry_id end;
  select status into v_status
  from public.journal_entries where id=v_id;
  if v_status <> 'draft' then
    raise exception 'Partidas só podem ser alteradas enquanto o lançamento permanece em rascunho.';
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;

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
    if new.status not in ('approved','issued')
       or (to_jsonb(new) - array['status','approved_by','approved_at','journal_entry_id','updated_at','version']::text[])
          <> (to_jsonb(old) - array['status','approved_by','approved_at','journal_entry_id','updated_at','version']::text[]) then
      raise exception 'Documento submetido é imutável até a decisão administrativa.';
    end if;
    return new;
  end if;

  if old.journal_entry_id is not null or old.status in ('approved','issued','partially_settled','settled','reversed') then
    if (to_jsonb(new) - array['status','updated_at','version']::text[])
       <> (to_jsonb(old) - array['status','updated_at','version']::text[]) then
      raise exception 'Documento consolidado é imutável; utilize estorno ou liquidação.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.protect_posted_settlement()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if tg_op='DELETE' then
    if old.status <> 'draft' then raise exception 'Somente liquidação em rascunho pode ser excluída.'; end if;
    return old;
  end if;

  if old.status='pending_approval' then
    if new.status <> 'posted'
       or (to_jsonb(new) - array['status','posted_by','posted_at','journal_entry_id','updated_at','version']::text[])
          <> (to_jsonb(old) - array['status','posted_by','posted_at','journal_entry_id','updated_at','version']::text[]) then
      raise exception 'Liquidação submetida é imutável até a postagem administrativa.';
    end if;
    return new;
  end if;

  if old.status in ('posted','reversed') then
    if (to_jsonb(new) - array['status','updated_at','version']::text[])
       <> (to_jsonb(old) - array['status','updated_at','version']::text[]) then
      raise exception 'Liquidação postada é imutável.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.protect_posted_journal_entry()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if tg_op='DELETE' then
    if old.status <> 'draft' then raise exception 'Somente lançamento em rascunho pode ser excluído.'; end if;
    return old;
  end if;

  if old.status='validated' then
    if new.status <> 'posted'
       or (to_jsonb(new) - array['status','posting_date','posted_by','posted_at','updated_at','version']::text[])
          <> (to_jsonb(old) - array['status','posting_date','posted_by','posted_at','updated_at','version']::text[]) then
      raise exception 'Lançamento validado é imutável até a postagem administrativa.';
    end if;
    return new;
  end if;

  if old.status in ('posted','reversed') then
    if (to_jsonb(new) - array['status','reversed_by_entry_id','updated_at','version']::text[])
       <> (to_jsonb(old) - array['status','reversed_by_entry_id','updated_at','version']::text[]) then
      raise exception 'Lançamento postado é imutável.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.ensure_entry_editable() from public,anon,authenticated;
revoke all on function private.protect_consolidated_financial_document() from public,anon,authenticated;
revoke all on function private.protect_posted_settlement() from public,anon,authenticated;
revoke all on function private.protect_posted_journal_entry() from public,anon,authenticated;

drop policy financial_documents_update on public.financial_documents;
create policy financial_documents_update on public.financial_documents
for update to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('finance.documents.manage_draft',private.unit_code_for_id(business_unit_id))
  and status='draft'
)
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('finance.documents.manage_draft',private.unit_code_for_id(business_unit_id))
  and status in ('draft','pending_approval')
);

drop policy financial_settlements_update on public.financial_settlements;
create policy financial_settlements_update on public.financial_settlements
for update to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('finance.settlements.create',private.financial_document_unit_code(financial_document_id))
  and status='draft'
)
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('finance.settlements.create',private.financial_document_unit_code(financial_document_id))
  and status in ('draft','pending_approval')
);

drop policy journal_entries_update on public.journal_entries;
create policy journal_entries_update on public.journal_entries
for update to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('ledger.create',null)
  and status='draft'
  and source_type='manual'
)
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('ledger.create',null)
  and status in ('draft','validated')
  and source_type='manual'
);

drop function public.admin_reverse_journal_entry(uuid,date,text,uuid);
create or replace function public.admin_reverse_journal_entry(
  p_entry_id uuid,
  p_expected_version integer,
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
  if not found or v_original.version<>p_expected_version then return null; end if;
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

revoke all on function public.admin_reverse_journal_entry(uuid,integer,date,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_reverse_journal_entry(uuid,integer,date,text,uuid) to service_role;
