create or replace function public.admin_apply_asset_event(
  p_event_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v public.asset_events;
  v_asset public.corporate_assets;
  v_unit text;
begin
  select * into v
  from public.asset_events
  where id=p_event_id
  for update;

  if not found or v.version<>p_expected_version then return null; end if;

  select * into v_asset
  from public.corporate_assets
  where id=v.asset_id
  for update;

  v_unit:=private.governance_unit_code(v_asset.business_unit_id);
  if not private.user_has_permission(p_actor_user_id,'assets.apply',v_unit) then
    raise exception 'Permissão insuficiente.';
  end if;
  if v.status<>'approved' then
    raise exception 'Somente evento aprovado pode ser aplicado.';
  end if;

  if v.event_type='transfer' then
    update public.corporate_assets
    set business_unit_id=coalesce(v.to_business_unit_id,business_unit_id),
        custodian_user_id=coalesce(v.to_custodian_user_id,custodian_user_id),
        storage_location=coalesce(v.to_location,storage_location)
    where id=v.asset_id;
  elsif v.event_type='maintenance' then
    update public.corporate_assets set status='maintenance' where id=v.asset_id;
  elsif v.event_type='return_to_service' then
    update public.corporate_assets set status='active' where id=v.asset_id;
  elsif v.event_type='disposal' then
    update public.corporate_assets
    set status='disposed',
        disposal_date=v.occurred_on,
        current_value=coalesce(v.amount,current_value)
    where id=v.asset_id;
  elsif v.event_type='loss' then
    update public.corporate_assets set status='lost',current_value=0 where id=v.asset_id;
  elsif v.event_type='renewal' then
    update public.corporate_assets set renewal_date=v.occurred_on where id=v.asset_id;
  end if;

  update public.asset_events
  set status='applied',applied_by=p_actor_user_id
  where id=v.id and version=p_expected_version
  returning * into v;

  return to_jsonb(v);
end
$$;

create or replace function public.has_permission(
  p_permission_code text,
  p_unit_code text default null
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select private.current_user_has_permission(p_permission_code,p_unit_code);
$$;

revoke all on function public.has_permission(text,text) from public,anon;
grant execute on function public.has_permission(text,text) to authenticated,service_role;
revoke all on function public.admin_apply_asset_event(uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.admin_apply_asset_event(uuid,integer,uuid) to service_role;
