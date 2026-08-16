revoke all on function public.approve_contract_version(uuid, integer) from public, anon, authenticated;
revoke all on function public.activate_contract(uuid, integer) from public, anon, authenticated;
revoke all on function public.terminate_contract(uuid, integer, text) from public, anon, authenticated;
drop function public.approve_contract_version(uuid, integer);
drop function public.activate_contract(uuid, integer);
drop function public.terminate_contract(uuid, integer, text);

create or replace function private.user_has_permission(
  p_user_id uuid,
  p_permission_code text,
  p_unit_code text default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1 from public.profiles p
      where p.id = p_user_id and p.status = 'active'
    )
    and exists (
      select 1
      from public.user_role_assignments ura
      join public.role_permissions rp on rp.role_id = ura.role_id
      join public.permissions perm on perm.id = rp.permission_id
      where ura.user_id = p_user_id
        and ura.status = 'active'
        and ura.valid_from <= now()
        and (ura.valid_until is null or ura.valid_until > now())
        and perm.code = p_permission_code
        and (p_unit_code is null or ura.unit_code is null or ura.unit_code = p_unit_code)
    );
$$;

revoke all on function private.user_has_permission(uuid, text, text) from public, anon, authenticated;
grant execute on function private.user_has_permission(uuid, text, text) to service_role;

create or replace function public.admin_approve_contract_version(
  p_version_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.contract_versions;
  v_contract public.contracts;
  v_unit_code text;
  v_total numeric;
begin
  select * into v_row from public.contract_versions where id = p_version_id for update;
  if not found or v_row.version <> p_expected_version then
    return null;
  end if;
  select * into v_contract from public.contracts where id = v_row.contract_id for update;
  v_unit_code := private.unit_code_for_id(v_contract.business_unit_id);
  if not private.user_has_permission(p_actor_user_id, 'contracts.approve', v_unit_code) then
    raise exception 'Permissão de aprovação insuficiente.';
  end if;
  if v_row.status not in ('draft','in_review') then
    raise exception 'Somente versão em rascunho ou revisão pode ser aprovada.';
  end if;
  if v_row.requested_by is null then
    raise exception 'A versão precisa ser enviada para aprovação por um solicitante identificado.';
  end if;
  if v_row.requested_by = p_actor_user_id then
    raise exception 'O solicitante não pode aprovar a própria versão.';
  end if;
  if not exists (
    select 1 from public.contract_documents
    where contract_version_id = v_row.id
      and document_type = 'main_contract'
      and status in ('uploaded','verified')
  ) then
    raise exception 'A aprovação exige documento principal vinculado.';
  end if;
  select coalesce(sum(percentage),0) into v_total
  from public.contract_version_participants
  where contract_version_id = v_row.id and status = 'active';
  if not v_row.allows_distinct_bases and v_total > 100 then
    raise exception 'Participações ativas excedem 100%%.';
  end if;

  update public.contract_versions
  set status = 'superseded'
  where contract_id = v_row.contract_id and status = 'approved' and id <> v_row.id;

  update public.contract_versions
  set status = 'approved', approved_by = p_actor_user_id, approved_at = now()
  where id = v_row.id and version = p_expected_version
  returning * into v_row;

  insert into public.contract_approvals(
    contract_version_id, requested_by, approver_user_id, decision, decided_at
  ) values (
    v_row.id, v_row.requested_by, p_actor_user_id, 'approved', now()
  );

  return to_jsonb(v_row);
end;
$$;

create or replace function public.admin_activate_contract(
  p_contract_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.contracts;
  v_unit_code text;
begin
  select * into v_row from public.contracts where id = p_contract_id for update;
  if not found or v_row.version <> p_expected_version then
    return null;
  end if;
  v_unit_code := private.unit_code_for_id(v_row.business_unit_id);
  if not private.user_has_permission(p_actor_user_id, 'contracts.approve', v_unit_code) then
    raise exception 'Permissão de ativação insuficiente.';
  end if;
  if not exists (
    select 1 from public.contract_versions where contract_id = v_row.id and status = 'approved'
  ) then
    raise exception 'Contrato exige uma versão aprovada.';
  end if;
  if not exists (
    select 1 from public.contract_parties
    where contract_id = v_row.id and status = 'active' and is_primary
  ) then
    raise exception 'Contrato exige uma contraparte principal ativa.';
  end if;
  update public.contracts
  set status = 'active'
  where id = v_row.id and version = p_expected_version
  returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.admin_terminate_contract(
  p_contract_id uuid,
  p_expected_version integer,
  p_reason text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.contracts;
  v_unit_code text;
begin
  if p_reason is null or char_length(btrim(p_reason)) < 5 then
    raise exception 'Motivo de encerramento obrigatório.';
  end if;
  select * into v_row from public.contracts where id = p_contract_id for update;
  if not found or v_row.version <> p_expected_version then
    return null;
  end if;
  v_unit_code := private.unit_code_for_id(v_row.business_unit_id);
  if not private.user_has_permission(p_actor_user_id, 'contracts.terminate', v_unit_code) then
    raise exception 'Permissão de encerramento insuficiente.';
  end if;
  if v_row.status not in ('active','renewal','pending_signature') then
    raise exception 'Situação atual não permite encerramento.';
  end if;
  update public.contracts
  set status = case when v_row.status = 'pending_signature' then 'cancelled' else 'terminated' end,
      ends_on = coalesce(ends_on, current_date),
      notes = concat_ws(E'\n', notes, 'Encerramento: ' || btrim(p_reason))
  where id = v_row.id and version = p_expected_version
  returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.admin_approve_contract_version(uuid, integer, uuid) from public, anon, authenticated;
revoke all on function public.admin_activate_contract(uuid, integer, uuid) from public, anon, authenticated;
revoke all on function public.admin_terminate_contract(uuid, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_approve_contract_version(uuid, integer, uuid) to service_role;
grant execute on function public.admin_activate_contract(uuid, integer, uuid) to service_role;
grant execute on function public.admin_terminate_contract(uuid, integer, text, uuid) to service_role;
