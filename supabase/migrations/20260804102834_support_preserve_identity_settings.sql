create or replace function public.support_admin_dispatch_catalog_v2(
  p_action text,
  p_payload jsonb,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_action = 'save-product-settings' then
    update public.support_product_settings
       set brand_name = private.support_jsonb_text(p_payload, 'brandName', true),
           internal_description = private.support_jsonb_text(p_payload, 'internalDescription', false),
           timezone = private.support_jsonb_text(p_payload, 'timezone', true),
           default_language = private.support_jsonb_text(p_payload, 'defaultLanguage', true),
           status = private.support_jsonb_text(p_payload, 'status', true),
           identity_settings = case
             when p_payload ? 'identitySettings'
               then coalesce(p_payload -> 'identitySettings', '{}'::jsonb)
             else identity_settings
           end,
           automation_enabled = coalesce(
             nullif(p_payload ->> 'automationEnabled', '')::boolean,
             automation_enabled
           ),
           fallback_queue_id = nullif(p_payload ->> 'fallbackQueueId', '')::uuid,
           updated_by = p_actor_user_id
     where id = (p_payload ->> 'settingsId')::uuid
       and version = (p_payload ->> 'expectedVersion')::bigint
     returning to_jsonb(support_product_settings) into v_result;

    if v_result is null then
      raise exception 'CONFLICT: configurações alteradas por outro usuário.';
    end if;
    return v_result;
  end if;

  return public.support_admin_dispatch_catalog(p_action, p_payload, p_actor_user_id);
end
$$;

revoke all on function public.support_admin_dispatch_catalog_v2(text, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.support_admin_dispatch_catalog_v2(text, jsonb, uuid)
  to service_role;

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
end
$$;
