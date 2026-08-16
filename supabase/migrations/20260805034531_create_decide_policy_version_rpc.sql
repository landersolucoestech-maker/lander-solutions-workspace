-- Caller-scoped policy approval or rejection with segregation of duties.

create or replace function public.decide_policy_version(
  p_version_id uuid,
  p_expected_version integer,
  p_approve boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_row public.corporate_policy_versions;
  v_unit_code text;
begin
  if v_actor is null then raise exception 'Autenticação obrigatória.' using errcode='42501'; end if;
  select * into v_row from public.corporate_policy_versions where id=p_version_id for update;
  if not found or v_row.version<>p_expected_version then return null; end if;
  select private.governance_unit_code(p.business_unit_id) into v_unit_code
  from public.corporate_policies p where p.id=v_row.policy_id;
  if not private.current_user_has_permission('policies.approve',v_unit_code) then
    raise exception 'Permissão insuficiente.' using errcode='42501';
  end if;
  if v_row.status<>'pending_approval' then
    raise exception 'Versão não está aguardando aprovação.';
  end if;
  if v_row.requested_by=v_actor or v_row.created_by=v_actor then
    raise exception 'Autoaprovação não permitida.';
  end if;
  if not p_approve and char_length(btrim(coalesce(p_reason,'')))<3 then
    raise exception 'Motivo da rejeição obrigatório.';
  end if;
  perform set_config('app.policy_workflow_transition','on',true);
  update public.corporate_policy_versions
  set status=case when p_approve then 'approved' else 'rejected' end,
      approved_by=v_actor,
      decision_reason=nullif(btrim(coalesce(p_reason,'')),'')
  where id=v_row.id and version=p_expected_version
  returning * into v_row;
  if not found then return null; end if;
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.decide_policy_version(uuid,integer,boolean,text) from public,anon;
grant execute on function public.decide_policy_version(uuid,integer,boolean,text) to authenticated;

comment on function public.decide_policy_version(uuid,integer,boolean,text)
is 'Caller-scoped approval or rejection with segregation of duties.';
