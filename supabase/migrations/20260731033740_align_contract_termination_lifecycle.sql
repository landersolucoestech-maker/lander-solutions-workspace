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
  if v_row.status not in ('draft','in_review','pending_signature','active','renewal') then
    raise exception 'Situação atual não permite cancelamento ou encerramento.';
  end if;
  update public.contracts
  set status = case
        when v_row.status in ('draft','in_review','pending_signature') then 'cancelled'
        else 'terminated'
      end,
      ends_on = case
        when v_row.status in ('active','renewal') then coalesce(ends_on, current_date)
        else ends_on
      end,
      notes = concat_ws(E'\n', notes, 'Cancelamento/encerramento: ' || btrim(p_reason))
  where id = v_row.id and version = p_expected_version
  returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.admin_terminate_contract(uuid, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_terminate_contract(uuid, integer, text, uuid) to service_role;
