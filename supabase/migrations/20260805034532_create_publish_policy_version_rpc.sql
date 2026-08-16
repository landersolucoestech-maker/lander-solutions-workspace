-- Caller-scoped publication of an approved immutable policy version.

create or replace function public.publish_policy_version(
  p_version_id uuid,
  p_expected_version integer
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
  if not private.current_user_has_permission('policies.publish',v_unit_code) then
    raise exception 'Permissão insuficiente.' using errcode='42501';
  end if;
  if v_row.status<>'approved' then
    raise exception 'Somente versão aprovada pode ser publicada.';
  end if;
  perform set_config('app.policy_workflow_transition','on',true);
  update public.corporate_policy_versions
  set status='superseded'
  where policy_id=v_row.policy_id and id<>v_row.id and status='published';
  update public.corporate_policy_versions
  set status='published',published_by=v_actor
  where id=v_row.id and version=p_expected_version
  returning * into v_row;
  if not found then return null; end if;
  update public.corporate_policies
  set current_version_id=v_row.id,status='active'
  where id=v_row.policy_id;
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.publish_policy_version(uuid,integer) from public,anon;
grant execute on function public.publish_policy_version(uuid,integer) to authenticated;

comment on function public.publish_policy_version(uuid,integer)
is 'Caller-scoped publication of an approved immutable policy version.';
