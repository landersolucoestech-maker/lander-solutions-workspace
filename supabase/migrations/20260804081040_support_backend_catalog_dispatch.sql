create or replace function public.support_admin_dispatch_catalog(p_action text,p_payload jsonb,p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_id uuid;v_product_id uuid;v_legal_entity_id uuid;v_expected bigint;v_result jsonb;
begin
  if p_action='save-product-settings' then
    v_id:=(p_payload->>'settingsId')::uuid;v_expected:=(p_payload->>'expectedVersion')::bigint;
    update public.support_product_settings set brand_name=private.support_jsonb_text(p_payload,'brandName',true),internal_description=private.support_jsonb_text(p_payload,'internalDescription',false),timezone=private.support_jsonb_text(p_payload,'timezone',true),default_language=private.support_jsonb_text(p_payload,'defaultLanguage',true),status=private.support_jsonb_text(p_payload,'status',true),identity_settings=coalesce(p_payload->'identitySettings','{}'::jsonb),fallback_queue_id=nullif(p_payload->>'fallbackQueueId','')::uuid,updated_by=p_actor_user_id where id=v_id and version=v_expected returning to_jsonb(support_product_settings) into v_result;
    if v_result is null then raise exception 'CONFLICT: configurações alteradas por outro usuário.';end if;return v_result;
  end if;
  if p_action='save-product-member' then
    v_product_id:=(p_payload->>'productId')::uuid;v_legal_entity_id:=private.support_product_legal_entity_id(v_product_id);v_id:=nullif(p_payload->>'id','')::uuid;
    if v_id is null then
      insert into public.support_product_members(legal_entity_id,product_id,user_id,operation_role,availability_status,capacity,supervisor_user_id,status,created_by,updated_by)
      values(v_legal_entity_id,v_product_id,(p_payload->>'userId')::uuid,private.support_jsonb_text(p_payload,'operationRole',true),coalesce(private.support_jsonb_text(p_payload,'availabilityStatus',false),'offline'),coalesce(nullif(p_payload->>'capacity','')::integer,5),nullif(p_payload->>'supervisorUserId','')::uuid,coalesce(private.support_jsonb_text(p_payload,'status',false),'active'),p_actor_user_id,p_actor_user_id) returning to_jsonb(support_product_members) into v_result;
    else
      v_expected:=(p_payload->>'expectedVersion')::bigint;
      update public.support_product_members set user_id=(p_payload->>'userId')::uuid,operation_role=private.support_jsonb_text(p_payload,'operationRole',true),availability_status=coalesce(private.support_jsonb_text(p_payload,'availabilityStatus',false),'offline'),capacity=coalesce(nullif(p_payload->>'capacity','')::integer,5),supervisor_user_id=nullif(p_payload->>'supervisorUserId','')::uuid,status=coalesce(private.support_jsonb_text(p_payload,'status',false),'active'),updated_by=p_actor_user_id where id=v_id and version=v_expected returning to_jsonb(support_product_members) into v_result;
      if v_result is null then raise exception 'CONFLICT: membro alterado por outro usuário.';end if;
    end if;return v_result;
  end if;
  if p_action='save-queue' then
    v_id:=nullif(p_payload->>'id','')::uuid;v_product_id:=nullif(p_payload->>'productId','')::uuid;v_legal_entity_id:=case when v_product_id is null then (p_payload->>'legalEntityId')::uuid else private.support_product_legal_entity_id(v_product_id) end;
    if v_id is null then
      insert into public.support_queues(legal_entity_id,product_id,code,name,description,status,default_priority,distribution_strategy,business_hours_id,sla_policy_id,capacity,created_by,updated_by)
      values(v_legal_entity_id,v_product_id,upper(private.support_jsonb_text(p_payload,'code',true)),private.support_jsonb_text(p_payload,'name',true),private.support_jsonb_text(p_payload,'description',false),coalesce(private.support_jsonb_text(p_payload,'status',false),'active'),coalesce(private.support_jsonb_text(p_payload,'defaultPriority',false),'normal'),coalesce(private.support_jsonb_text(p_payload,'distributionStrategy',false),'manual'),nullif(p_payload->>'businessHoursId','')::uuid,nullif(p_payload->>'slaPolicyId','')::uuid,nullif(p_payload->>'capacity','')::integer,p_actor_user_id,p_actor_user_id) returning to_jsonb(support_queues) into v_result;
    else
      v_expected:=(p_payload->>'expectedVersion')::bigint;
      update public.support_queues set code=upper(private.support_jsonb_text(p_payload,'code',true)),name=private.support_jsonb_text(p_payload,'name',true),description=private.support_jsonb_text(p_payload,'description',false),status=coalesce(private.support_jsonb_text(p_payload,'status',false),'active'),default_priority=coalesce(private.support_jsonb_text(p_payload,'defaultPriority',false),'normal'),distribution_strategy=coalesce(private.support_jsonb_text(p_payload,'distributionStrategy',false),'manual'),business_hours_id=nullif(p_payload->>'businessHoursId','')::uuid,sla_policy_id=nullif(p_payload->>'slaPolicyId','')::uuid,capacity=nullif(p_payload->>'capacity','')::integer,updated_by=p_actor_user_id where id=v_id and version=v_expected returning to_jsonb(support_queues) into v_result;
      if v_result is null then raise exception 'CONFLICT: fila alterada por outro usuário.';end if;
    end if;return v_result;
  end if;
  if p_action='archive-queue' then
    update public.support_queues set status='archived',updated_by=p_actor_user_id where id=(p_payload->>'queueId')::uuid and version=(p_payload->>'expectedVersion')::bigint returning to_jsonb(support_queues) into v_result;
    if v_result is null then raise exception 'CONFLICT: fila alterada por outro usuário.';end if;return v_result;
  end if;
  if p_action='save-queue-members' then return public.support_admin_save_queue_members((p_payload->>'queueId')::uuid,(p_payload->>'expectedVersion')::bigint,coalesce(p_payload->'members','[]'::jsonb),p_actor_user_id);end if;
  if p_action='save-category' then
    v_product_id:=(p_payload->>'productId')::uuid;v_legal_entity_id:=private.support_product_legal_entity_id(v_product_id);v_id:=nullif(p_payload->>'id','')::uuid;
    if v_id is null then insert into public.support_categories(legal_entity_id,product_id,parent_id,code,name,description,status,created_by,updated_by) values(v_legal_entity_id,v_product_id,nullif(p_payload->>'parentId','')::uuid,upper(private.support_jsonb_text(p_payload,'code',true)),private.support_jsonb_text(p_payload,'name',true),private.support_jsonb_text(p_payload,'description',false),coalesce(private.support_jsonb_text(p_payload,'status',false),'active'),p_actor_user_id,p_actor_user_id) returning to_jsonb(support_categories) into v_result;
    else update public.support_categories set parent_id=nullif(p_payload->>'parentId','')::uuid,code=upper(private.support_jsonb_text(p_payload,'code',true)),name=private.support_jsonb_text(p_payload,'name',true),description=private.support_jsonb_text(p_payload,'description',false),status=coalesce(private.support_jsonb_text(p_payload,'status',false),'active'),updated_by=p_actor_user_id where id=v_id and version=(p_payload->>'expectedVersion')::bigint returning to_jsonb(support_categories) into v_result;end if;
    if v_result is null then raise exception 'CONFLICT: categoria alterada por outro usuário.';end if;return v_result;
  end if;
  if p_action='save-tag' then
    v_product_id:=(p_payload->>'productId')::uuid;v_legal_entity_id:=private.support_product_legal_entity_id(v_product_id);v_id:=nullif(p_payload->>'id','')::uuid;
    if v_id is null then insert into public.support_tags(legal_entity_id,product_id,code,name,status,created_by,updated_by) values(v_legal_entity_id,v_product_id,upper(private.support_jsonb_text(p_payload,'code',true)),private.support_jsonb_text(p_payload,'name',true),coalesce(private.support_jsonb_text(p_payload,'status',false),'active'),p_actor_user_id,p_actor_user_id) returning to_jsonb(support_tags) into v_result;
    else update public.support_tags set code=upper(private.support_jsonb_text(p_payload,'code',true)),name=private.support_jsonb_text(p_payload,'name',true),status=coalesce(private.support_jsonb_text(p_payload,'status',false),'active'),updated_by=p_actor_user_id where id=v_id and version=(p_payload->>'expectedVersion')::bigint returning to_jsonb(support_tags) into v_result;end if;
    if v_result is null then raise exception 'CONFLICT: tag alterada por outro usuário.';end if;return v_result;
  end if;
  if p_action='save-channel' then
    v_product_id:=(p_payload->>'productId')::uuid;v_legal_entity_id:=private.support_product_legal_entity_id(v_product_id);v_id:=nullif(p_payload->>'id','')::uuid;
    if v_id is null then insert into public.support_channels(legal_entity_id,product_id,channel_type,name,provider,status,integration_connection_id,external_identifier,settings,created_by,updated_by) values(v_legal_entity_id,v_product_id,private.support_jsonb_text(p_payload,'channelType',true),private.support_jsonb_text(p_payload,'name',true),private.support_jsonb_text(p_payload,'provider',false),coalesce(private.support_jsonb_text(p_payload,'status',false),'not_configured'),nullif(p_payload->>'integrationConnectionId','')::uuid,private.support_jsonb_text(p_payload,'externalIdentifier',false),coalesce(p_payload->'settings','{}'::jsonb),p_actor_user_id,p_actor_user_id) returning to_jsonb(support_channels) into v_result;
    else update public.support_channels set channel_type=private.support_jsonb_text(p_payload,'channelType',true),name=private.support_jsonb_text(p_payload,'name',true),provider=private.support_jsonb_text(p_payload,'provider',false),status=coalesce(private.support_jsonb_text(p_payload,'status',false),'not_configured'),integration_connection_id=nullif(p_payload->>'integrationConnectionId','')::uuid,external_identifier=private.support_jsonb_text(p_payload,'externalIdentifier',false),settings=coalesce(p_payload->'settings','{}'::jsonb),updated_by=p_actor_user_id where id=v_id and version=(p_payload->>'expectedVersion')::bigint returning to_jsonb(support_channels) into v_result;end if;
    if v_result is null then raise exception 'CONFLICT: canal alterado por outro usuário.';end if;return v_result;
  end if;
  raise exception 'Ação de catálogo desconhecida.';
end$$;
revoke all on function public.support_admin_dispatch_catalog(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.support_admin_dispatch_catalog(text,jsonb,uuid) to service_role;
