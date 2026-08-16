-- Corporate ownership integrity, history protection and audit triggers.

create or replace function private.validate_corporate_share_class_structure()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_position_structure uuid;
begin
  select capital_structure_id
    into v_position_structure
  from public.corporate_share_classes
  where id = new.share_class_id;

  if v_position_structure is null then
    raise exception 'Classe de participação não encontrada.';
  end if;

  if v_position_structure is distinct from new.capital_structure_id then
    raise exception 'A classe de participação não pertence à estrutura de capital informada.';
  end if;

  return new;
end;
$$;

create or replace function private.validate_corporate_ownership_totals()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_structure_id uuid;
  v_total_quotas numeric(30,8);
  v_active_quotas numeric(30,8);
  v_authorized_quotas numeric(30,8);
  v_class_overflow boolean;
begin
  if tg_op = 'DELETE' then
    v_structure_id := old.capital_structure_id;
  else
    v_structure_id := new.capital_structure_id;
  end if;

  select total_quotas
    into v_total_quotas
  from public.corporate_capital_structures
  where id = v_structure_id
  for update;

  if v_total_quotas is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  select coalesce(sum(authorized_quotas), 0)
    into v_authorized_quotas
  from public.corporate_share_classes
  where capital_structure_id = v_structure_id
    and status = 'active';

  if v_authorized_quotas > v_total_quotas then
    raise exception 'A soma das quotas autorizadas (%) excede o total de quotas da estrutura (%).', v_authorized_quotas, v_total_quotas;
  end if;

  select coalesce(sum(quota_quantity), 0)
    into v_active_quotas
  from public.corporate_ownership_positions
  where capital_structure_id = v_structure_id
    and status = 'active';

  if v_active_quotas > v_total_quotas then
    raise exception 'A soma das quotas vigentes (%) excede o total de quotas da estrutura (%).', v_active_quotas, v_total_quotas;
  end if;

  select exists (
    select 1
    from public.corporate_share_classes sc
    left join public.corporate_ownership_positions op
      on op.share_class_id = sc.id
     and op.status = 'active'
    where sc.capital_structure_id = v_structure_id
    group by sc.id, sc.authorized_quotas
    having coalesce(sum(op.quota_quantity), 0) > sc.authorized_quotas
  ) into v_class_overflow;

  if v_class_overflow then
    raise exception 'A soma das quotas vigentes excede o limite autorizado de uma classe.';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

create or replace function private.validate_corporate_ownership_role()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_position_entity uuid;
  v_position_party uuid;
begin
  if new.ownership_position_id is null then
    return new;
  end if;

  select cs.legal_entity_id, op.holder_party_id
    into v_position_entity, v_position_party
  from public.corporate_ownership_positions op
  join public.corporate_capital_structures cs on cs.id = op.capital_structure_id
  where op.id = new.ownership_position_id;

  if v_position_entity is null then
    raise exception 'Posição societária vinculada não encontrada.';
  end if;
  if v_position_entity is distinct from new.legal_entity_id then
    raise exception 'A posição societária não pertence à entidade jurídica informada.';
  end if;
  if v_position_party is distinct from new.party_id then
    raise exception 'A posição societária não pertence à parte informada.';
  end if;

  return new;
end;
$$;

create or replace function private.validate_corporate_ownership_change_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_source_entity uuid;
  v_result_entity uuid;
  v_resolution_entity uuid;
begin
  if new.source_capital_structure_id is not null then
    select legal_entity_id into v_source_entity
    from public.corporate_capital_structures
    where id = new.source_capital_structure_id;
    if v_source_entity is distinct from new.legal_entity_id then
      raise exception 'A estrutura de capital de origem não pertence à entidade jurídica informada.';
    end if;
  end if;

  if new.resulting_capital_structure_id is not null then
    select legal_entity_id into v_result_entity
    from public.corporate_capital_structures
    where id = new.resulting_capital_structure_id;
    if v_result_entity is distinct from new.legal_entity_id then
      raise exception 'A estrutura de capital resultante não pertence à entidade jurídica informada.';
    end if;
  end if;

  if new.resolution_id is not null then
    select legal_entity_id into v_resolution_entity
    from public.corporate_resolutions
    where id = new.resolution_id;
    if v_resolution_entity is distinct from new.legal_entity_id then
      raise exception 'A deliberação não pertence à entidade jurídica informada.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.protect_corporate_ownership_history()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_parent_status text;
begin
  if tg_op = 'DELETE' then
    if tg_table_name = 'corporate_capital_structures' and old.status in ('approved','effective','superseded') then
      raise exception 'Estruturas de capital aprovadas ou efetivadas não podem ser excluídas.';
    elsif tg_table_name = 'corporate_ownership_positions' then
      select status into v_parent_status from public.corporate_capital_structures where id = old.capital_structure_id;
      if v_parent_status in ('approved','effective','superseded') or old.status = 'exited' then
        raise exception 'Posições societárias vigentes ou históricas não podem ser excluídas.';
      end if;
    elsif tg_table_name = 'corporate_ownership_roles' and (old.status = 'ended' or old.effective_from <= current_date) then
      raise exception 'Vínculos societários vigentes ou históricos não podem ser excluídos.';
    elsif tg_table_name = 'corporate_ownership_changes' and old.status in ('approved','applied','reversed') then
      raise exception 'Alterações societárias aprovadas ou aplicadas não podem ser excluídas.';
    elsif tg_table_name = 'corporate_resolutions' and old.status in ('approved','applied') then
      raise exception 'Deliberações aprovadas ou aplicadas não podem ser excluídas.';
    elsif tg_table_name = 'corporate_ownership_change_lines' then
      select status into v_parent_status from public.corporate_ownership_changes where id = old.change_id;
      if v_parent_status in ('approved','applied','reversed') then
        raise exception 'Linhas de alteração societária aprovadas ou aplicadas não podem ser excluídas.';
      end if;
    end if;
    return old;
  end if;

  if tg_table_name = 'corporate_capital_structures'
     and old.status in ('effective','superseded')
     and (
       new.legal_entity_id is distinct from old.legal_entity_id
       or new.version_no is distinct from old.version_no
       or new.currency_code is distinct from old.currency_code
       or new.capital_amount is distinct from old.capital_amount
       or new.total_quotas is distinct from old.total_quotas
       or new.effective_from is distinct from old.effective_from
     ) then
    raise exception 'Uma estrutura de capital efetivada não pode ser reescrita; crie nova versão.';
  end if;

  if tg_table_name = 'corporate_ownership_positions'
     and old.status in ('active','exited')
     and (
       new.capital_structure_id is distinct from old.capital_structure_id
       or new.share_class_id is distinct from old.share_class_id
       or new.holder_party_id is distinct from old.holder_party_id
       or new.quota_quantity is distinct from old.quota_quantity
       or new.effective_from is distinct from old.effective_from
     ) then
    select status into v_parent_status from public.corporate_capital_structures where id = old.capital_structure_id;
    if v_parent_status in ('approved','effective','superseded') or old.status = 'exited' then
      raise exception 'Uma posição societária vigente ou histórica não pode ser reescrita; registre nova posição.';
    end if;
  end if;

  if tg_table_name = 'corporate_ownership_roles'
     and old.status in ('active','ended')
     and old.effective_from <= current_date
     and (
       new.legal_entity_id is distinct from old.legal_entity_id
       or new.party_id is distinct from old.party_id
       or new.role_type is distinct from old.role_type
       or new.effective_from is distinct from old.effective_from
       or new.ultimate_ownership_percentage is distinct from old.ultimate_ownership_percentage
     ) then
    raise exception 'Um vínculo societário vigente ou histórico não pode ser reescrito; registre novo vínculo.';
  end if;

  if tg_table_name = 'corporate_ownership_change_lines' then
    select status into v_parent_status from public.corporate_ownership_changes where id = old.change_id;
    if v_parent_status in ('approved','applied','reversed') then
      raise exception 'Linhas de alteração societária aprovadas ou aplicadas são imutáveis.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.enforce_corporate_ownership_change_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status = new.status then
    if old.status in ('applied','reversed') and to_jsonb(new) - array['updated_at','updated_by','version'] is distinct from to_jsonb(old) - array['updated_at','updated_by','version'] then
      raise exception 'Alterações societárias aplicadas são imutáveis.';
    end if;
    return new;
  end if;

  if not (
    (old.status = 'draft' and new.status in ('submitted','cancelled'))
    or (old.status = 'submitted' and new.status in ('approved','rejected','cancelled'))
    or (old.status = 'approved' and new.status in ('applied','cancelled'))
    or (old.status = 'applied' and new.status = 'reversed')
  ) then
    raise exception 'Transição societária inválida: % -> %.', old.status, new.status;
  end if;

  if new.status = 'approved' then
    new.approved_by := coalesce(new.approved_by, auth.uid());
    new.approved_at := coalesce(new.approved_at, now());
  end if;

  if new.status = 'applied' then
    if not public.has_permission('corporate_ownership.apply_changes', null) then
      raise exception 'Permissão corporate_ownership.apply_changes obrigatória.';
    end if;
    if new.effective_on is null or new.evidence_document_id is null then
      raise exception 'Data de vigência e evidência documental são obrigatórias para aplicar alteração societária.';
    end if;
    new.applied_by := coalesce(new.applied_by, auth.uid());
    new.applied_at := coalesce(new.applied_at, now());
  end if;

  if new.status = 'reversed' then
    if not public.has_permission('corporate_ownership.apply_changes', null) then
      raise exception 'Permissão corporate_ownership.apply_changes obrigatória para reversão.';
    end if;
    if new.reversed_by is null then new.reversed_by := auth.uid(); end if;
    if new.reversed_at is null then new.reversed_at := now(); end if;
    if nullif(btrim(new.reversal_reason), '') is null then
      raise exception 'Justificativa de reversão obrigatória.';
    end if;
  end if;

  return new;
end;
$$;

create trigger corporate_ownership_positions_validate_structure
before insert or update of capital_structure_id, share_class_id
on public.corporate_ownership_positions
for each row execute function private.validate_corporate_share_class_structure();

create trigger corporate_ownership_roles_validate
before insert or update of legal_entity_id, party_id, ownership_position_id
on public.corporate_ownership_roles
for each row execute function private.validate_corporate_ownership_role();

create trigger corporate_ownership_changes_validate_scope
before insert or update of legal_entity_id, source_capital_structure_id, resulting_capital_structure_id, resolution_id
on public.corporate_ownership_changes
for each row execute function private.validate_corporate_ownership_change_scope();

create constraint trigger corporate_ownership_positions_validate_totals
after insert or update or delete on public.corporate_ownership_positions
deferrable initially deferred
for each row execute function private.validate_corporate_ownership_totals();

create constraint trigger corporate_share_classes_validate_totals
after insert or update or delete on public.corporate_share_classes
deferrable initially deferred
for each row execute function private.validate_corporate_ownership_totals();

create trigger corporate_capital_structures_protect_history
before update or delete on public.corporate_capital_structures
for each row execute function private.protect_corporate_ownership_history();
create trigger corporate_ownership_positions_protect_history
before update or delete on public.corporate_ownership_positions
for each row execute function private.protect_corporate_ownership_history();
create trigger corporate_ownership_roles_protect_history
before update or delete on public.corporate_ownership_roles
for each row execute function private.protect_corporate_ownership_history();
create trigger corporate_ownership_changes_protect_delete
before delete on public.corporate_ownership_changes
for each row execute function private.protect_corporate_ownership_history();
create trigger corporate_ownership_change_lines_protect_history
before update or delete on public.corporate_ownership_change_lines
for each row execute function private.protect_corporate_ownership_history();
create trigger corporate_resolutions_protect_history
before delete on public.corporate_resolutions
for each row execute function private.protect_corporate_ownership_history();

create trigger corporate_ownership_changes_enforce_transition
before update on public.corporate_ownership_changes
for each row execute function private.enforce_corporate_ownership_change_transition();

create trigger corporate_capital_structures_touch before update on public.corporate_capital_structures for each row execute function private.touch_updated_at();
create trigger corporate_share_classes_touch before update on public.corporate_share_classes for each row execute function private.touch_updated_at();
create trigger corporate_ownership_positions_touch before update on public.corporate_ownership_positions for each row execute function private.touch_updated_at();
create trigger corporate_ownership_roles_touch before update on public.corporate_ownership_roles for each row execute function private.touch_updated_at();
create trigger corporate_ownership_changes_touch before update on public.corporate_ownership_changes for each row execute function private.touch_updated_at();
create trigger corporate_resolutions_touch before update on public.corporate_resolutions for each row execute function private.touch_updated_at();

create trigger corporate_capital_structures_audit after insert or update or delete on public.corporate_capital_structures for each row execute function private.audit_row_change();
create trigger corporate_share_classes_audit after insert or update or delete on public.corporate_share_classes for each row execute function private.audit_row_change();
create trigger corporate_ownership_positions_audit after insert or update or delete on public.corporate_ownership_positions for each row execute function private.audit_row_change();
create trigger corporate_ownership_roles_audit after insert or update or delete on public.corporate_ownership_roles for each row execute function private.audit_row_change();
create trigger corporate_ownership_changes_audit after insert or update or delete on public.corporate_ownership_changes for each row execute function private.audit_row_change();
create trigger corporate_ownership_change_lines_audit after insert or update or delete on public.corporate_ownership_change_lines for each row execute function private.audit_row_change();
create trigger corporate_resolutions_audit after insert or update or delete on public.corporate_resolutions for each row execute function private.audit_row_change();
