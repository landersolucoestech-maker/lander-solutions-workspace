create or replace function public.support_admin_dispatch_content(p_action text,p_payload jsonb,p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_id uuid;v_product_id uuid;v_legal_entity_id uuid;v_result jsonb;v_existing record;v_next integer;
begin
  if p_action='save-template' then
    v_product_id:=(p_payload->>'productId')::uuid;v_legal_entity_id:=private.support_product_legal_entity_id(v_product_id);v_id:=nullif(p_payload->>'id','')::uuid;
    if v_id is not null then
      select status,template_version,product_id into v_existing from public.support_message_templates where id=v_id for update;
      if not found then raise exception 'Template não encontrado.';end if;
      if v_existing.product_id<>v_product_id then raise exception 'Template pertence a outro produto.';end if;
    end if;
    if v_id is null or v_existing.status<>'draft' then
      select coalesce(max(template_version),0)+1 into v_next from public.support_message_templates where product_id=v_product_id and code=upper(private.support_jsonb_text(p_payload,'code',true));
      insert into public.support_message_templates(legal_entity_id,product_id,code,name,category,channel_type,language_code,status,content,allowed_variables,template_version,created_by,updated_by)
      values(v_legal_entity_id,v_product_id,upper(private.support_jsonb_text(p_payload,'code',true)),private.support_jsonb_text(p_payload,'name',true),private.support_jsonb_text(p_payload,'category',true),private.support_jsonb_text(p_payload,'channelType',false),coalesce(private.support_jsonb_text(p_payload,'languageCode',false),'pt-BR'),case when v_id is null then coalesce(private.support_jsonb_text(p_payload,'status',false),'draft') else 'draft' end,private.support_jsonb_text(p_payload,'content',true),coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'allowedVariables','[]'::jsonb))),array[]::text[]),v_next,p_actor_user_id,p_actor_user_id) returning to_jsonb(support_message_templates) into v_result;
    else
      update public.support_message_templates set code=upper(private.support_jsonb_text(p_payload,'code',true)),name=private.support_jsonb_text(p_payload,'name',true),category=private.support_jsonb_text(p_payload,'category',true),channel_type=private.support_jsonb_text(p_payload,'channelType',false),language_code=coalesce(private.support_jsonb_text(p_payload,'languageCode',false),'pt-BR'),status=coalesce(private.support_jsonb_text(p_payload,'status',false),'draft'),content=private.support_jsonb_text(p_payload,'content',true),allowed_variables=coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'allowedVariables','[]'::jsonb))),array[]::text[]),updated_by=p_actor_user_id where id=v_id and version=(p_payload->>'expectedVersion')::bigint returning to_jsonb(support_message_templates) into v_result;
      if v_result is null then raise exception 'CONFLICT: template alterado por outro usuário.';end if;
    end if;return v_result;
  end if;
  if p_action='archive-template' then
    update public.support_message_templates set status='archived',updated_by=p_actor_user_id where id=(p_payload->>'templateId')::uuid and version=(p_payload->>'expectedVersion')::bigint returning to_jsonb(support_message_templates) into v_result;
    if v_result is null then raise exception 'CONFLICT: template alterado por outro usuário.';end if;return v_result;
  end if;
  if p_action='save-form' then return public.support_admin_save_form(p_payload,p_actor_user_id);end if;
  if p_action='archive-form' then
    update public.support_forms set status='archived',updated_by=p_actor_user_id where id=(p_payload->>'formId')::uuid and version=(p_payload->>'expectedVersion')::bigint returning to_jsonb(support_forms) into v_result;
    if v_result is null then raise exception 'CONFLICT: formulário alterado por outro usuário.';end if;return v_result;
  end if;
  if p_action='save-business-hours' then return public.support_admin_save_business_hours(p_payload,p_actor_user_id);end if;
  if p_action='save-sla-policy' then
    v_product_id:=(p_payload->>'productId')::uuid;v_legal_entity_id:=private.support_product_legal_entity_id(v_product_id);v_id:=nullif(p_payload->>'id','')::uuid;
    if v_id is null then
      insert into public.support_sla_policies(legal_entity_id,product_id,name,status,business_hours_id,priority,conditions,first_response_minutes,next_response_minutes,resolution_minutes,pause_statuses,created_by,updated_by)
      values(v_legal_entity_id,v_product_id,private.support_jsonb_text(p_payload,'name',true),coalesce(private.support_jsonb_text(p_payload,'status',false),'active'),nullif(p_payload->>'businessHoursId','')::uuid,private.support_jsonb_text(p_payload,'priority',false),coalesce(p_payload->'conditions','{}'::jsonb),(p_payload->>'firstResponseMinutes')::integer,nullif(p_payload->>'nextResponseMinutes','')::integer,(p_payload->>'resolutionMinutes')::integer,coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'pauseStatuses','[]'::jsonb))),array[]::text[]),p_actor_user_id,p_actor_user_id) returning to_jsonb(support_sla_policies) into v_result;
    else
      update public.support_sla_policies set name=private.support_jsonb_text(p_payload,'name',true),status=coalesce(private.support_jsonb_text(p_payload,'status',false),'active'),business_hours_id=nullif(p_payload->>'businessHoursId','')::uuid,priority=private.support_jsonb_text(p_payload,'priority',false),conditions=coalesce(p_payload->'conditions','{}'::jsonb),first_response_minutes=(p_payload->>'firstResponseMinutes')::integer,next_response_minutes=nullif(p_payload->>'nextResponseMinutes','')::integer,resolution_minutes=(p_payload->>'resolutionMinutes')::integer,pause_statuses=coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'pauseStatuses','[]'::jsonb))),array[]::text[]),updated_by=p_actor_user_id where id=v_id and version=(p_payload->>'expectedVersion')::bigint returning to_jsonb(support_sla_policies) into v_result;
    end if;
    if v_result is null then raise exception 'CONFLICT: SLA alterado por outro usuário.';end if;return v_result;
  end if;
  if p_action='save-escalation-rule' then
    v_product_id:=(p_payload->>'productId')::uuid;v_legal_entity_id:=private.support_product_legal_entity_id(v_product_id);v_id:=nullif(p_payload->>'id','')::uuid;
    if v_id is null then
      insert into public.support_escalation_rules(legal_entity_id,product_id,sla_policy_id,queue_id,name,event_type,elapsed_minutes,escalation_level,recipient_role,recipient_queue_id,recipient_user_id,delivery_channels,message,priority,status,display_order,repeat_policy,repeat_interval_minutes,notification_limit,created_by,updated_by)
      values(v_legal_entity_id,v_product_id,nullif(p_payload->>'slaPolicyId','')::uuid,nullif(p_payload->>'queueId','')::uuid,private.support_jsonb_text(p_payload,'name',true),private.support_jsonb_text(p_payload,'eventType',true),coalesce(nullif(p_payload->>'elapsedMinutes','')::integer,0),coalesce(nullif(p_payload->>'level','')::integer,1),private.support_jsonb_text(p_payload,'recipientRole',false),nullif(p_payload->>'recipientQueueId','')::uuid,nullif(p_payload->>'recipientUserId','')::uuid,coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'deliveryChannels','[]'::jsonb))),array[]::text[]),private.support_jsonb_text(p_payload,'message',true),coalesce(private.support_jsonb_text(p_payload,'priority',false),'normal'),coalesce(private.support_jsonb_text(p_payload,'status',false),'active'),coalesce(nullif(p_payload->>'order','')::integer,1),coalesce(private.support_jsonb_text(p_payload,'repeatPolicy',false),'once'),nullif(p_payload->>'repeatIntervalMinutes','')::integer,coalesce(nullif(p_payload->>'notificationLimit','')::integer,1),p_actor_user_id,p_actor_user_id) returning to_jsonb(support_escalation_rules) into v_result;
    else
      update public.support_escalation_rules set sla_policy_id=nullif(p_payload->>'slaPolicyId','')::uuid,queue_id=nullif(p_payload->>'queueId','')::uuid,name=private.support_jsonb_text(p_payload,'name',true),event_type=private.support_jsonb_text(p_payload,'eventType',true),elapsed_minutes=coalesce(nullif(p_payload->>'elapsedMinutes','')::integer,0),escalation_level=coalesce(nullif(p_payload->>'level','')::integer,1),recipient_role=private.support_jsonb_text(p_payload,'recipientRole',false),recipient_queue_id=nullif(p_payload->>'recipientQueueId','')::uuid,recipient_user_id=nullif(p_payload->>'recipientUserId','')::uuid,delivery_channels=coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'deliveryChannels','[]'::jsonb))),array[]::text[]),message=private.support_jsonb_text(p_payload,'message',true),priority=coalesce(private.support_jsonb_text(p_payload,'priority',false),'normal'),status=coalesce(private.support_jsonb_text(p_payload,'status',false),'active'),display_order=coalesce(nullif(p_payload->>'order','')::integer,1),repeat_policy=coalesce(private.support_jsonb_text(p_payload,'repeatPolicy',false),'once'),repeat_interval_minutes=nullif(p_payload->>'repeatIntervalMinutes','')::integer,notification_limit=coalesce(nullif(p_payload->>'notificationLimit','')::integer,1),updated_by=p_actor_user_id where id=v_id and version=(p_payload->>'expectedVersion')::bigint returning to_jsonb(support_escalation_rules) into v_result;
    end if;
    if v_result is null then raise exception 'CONFLICT: regra alterada por outro usuário.';end if;return v_result;
  end if;
  raise exception 'Ação de conteúdo desconhecida.';
end$$;
revoke all on function public.support_admin_dispatch_content(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.support_admin_dispatch_content(text,jsonb,uuid) to service_role;
