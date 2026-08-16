create or replace function private.protect_corporate_ownership_history()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  v_parent_status text;
begin
  if tg_op='DELETE' then
    case tg_table_name
      when 'corporate_capital_structures' then
        if old.status in ('approved','effective','superseded') then
          raise exception 'Estruturas aprovadas ou efetivadas não podem ser excluídas.';
        end if;
      when 'corporate_ownership_positions' then
        select status into v_parent_status
        from public.corporate_capital_structures where id=old.capital_structure_id;
        if v_parent_status<>'draft' then
          raise exception 'Posições consolidadas não podem ser excluídas.';
        end if;
      when 'corporate_ownership_roles' then
        if old.status<>'cancelled' then
          raise exception 'Vínculos societários vigentes ou históricos não podem ser excluídos.';
        end if;
      when 'corporate_ownership_changes' then
        if old.status<>'draft' then
          raise exception 'Alterações fora de rascunho não podem ser excluídas.';
        end if;
      when 'corporate_resolutions' then
        if old.status in ('approved','applied') then
          raise exception 'Deliberações aprovadas ou aplicadas não podem ser excluídas.';
        end if;
      when 'corporate_ownership_change_lines' then
        select status into v_parent_status
        from public.corporate_ownership_changes where id=old.change_id;
        if v_parent_status<>'draft' then
          raise exception 'Linhas fora de rascunho são imutáveis.';
        end if;
      else
        null;
    end case;
    return old;
  end if;

  case tg_table_name
    when 'corporate_capital_structures' then
      if old.status in ('effective','superseded') and (
        new.legal_entity_id is distinct from old.legal_entity_id
        or new.version_no is distinct from old.version_no
        or new.currency_code is distinct from old.currency_code
        or new.capital_amount is distinct from old.capital_amount
        or new.total_quotas is distinct from old.total_quotas
        or new.effective_from is distinct from old.effective_from
      ) then
        raise exception 'Estrutura efetivada não pode ser reescrita; crie nova versão.';
      end if;
    when 'corporate_ownership_positions' then
      select status into v_parent_status
      from public.corporate_capital_structures where id=old.capital_structure_id;
      if v_parent_status<>'draft' and (
        new.capital_structure_id is distinct from old.capital_structure_id
        or new.share_class_id is distinct from old.share_class_id
        or new.holder_party_id is distinct from old.holder_party_id
        or new.quota_quantity is distinct from old.quota_quantity
        or new.effective_from is distinct from old.effective_from
        or new.status is distinct from old.status
        or new.effective_to is distinct from old.effective_to
      ) then
        raise exception 'Posição societária consolidada não pode ser reescrita.';
      end if;
    when 'corporate_ownership_roles' then
      if old.status in ('active','ended') and old.effective_from<=current_date and (
        new.legal_entity_id is distinct from old.legal_entity_id
        or new.party_id is distinct from old.party_id
        or new.role_type is distinct from old.role_type
        or new.effective_from is distinct from old.effective_from
        or new.ultimate_ownership_percentage is distinct from old.ultimate_ownership_percentage
      ) then
        raise exception 'Vínculo societário vigente ou histórico não pode ser reescrito.';
      end if;
    when 'corporate_ownership_change_lines' then
      select status into v_parent_status
      from public.corporate_ownership_changes where id=old.change_id;
      if v_parent_status<>'draft' then
        raise exception 'Linhas fora de rascunho são imutáveis.';
      end if;
    else
      null;
  end case;

  return new;
end;
$$;
