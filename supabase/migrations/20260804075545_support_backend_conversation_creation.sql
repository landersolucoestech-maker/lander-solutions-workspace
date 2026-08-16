create or replace function public.support_admin_create_conversation(p_payload jsonb,p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_product_id uuid;v_legal_entity_id uuid;v_conversation public.support_conversations%rowtype;v_message_body text;v_sender_type text;v_direction text;
begin
  begin v_product_id:=(p_payload->>'productId')::uuid;exception when others then raise exception 'Produto inválido.';end;
  v_legal_entity_id:=private.support_product_legal_entity_id(v_product_id);if v_legal_entity_id is null then raise exception 'Produto inexistente ou inativo.';end if;
  insert into public.support_conversations(legal_entity_id,product_id,channel_id,contact_party_id,organization_party_id,subject,status,current_queue_id,current_agent_user_id,priority,origin,external_identifier,automation_version_id,created_by,updated_by)
  values(v_legal_entity_id,v_product_id,(p_payload->>'channelId')::uuid,(p_payload->>'contactPartyId')::uuid,nullif(p_payload->>'organizationPartyId','')::uuid,private.support_jsonb_text(p_payload,'subject',false),coalesce(private.support_jsonb_text(p_payload,'status',false),'new'),nullif(p_payload->>'queueId','')::uuid,nullif(p_payload->>'agentUserId','')::uuid,coalesce(private.support_jsonb_text(p_payload,'priority',false),'normal'),coalesce(private.support_jsonb_text(p_payload,'origin',false),'manual'),private.support_jsonb_text(p_payload,'externalIdentifier',false),nullif(p_payload->>'automationVersionId','')::uuid,p_actor_user_id,p_actor_user_id)
  returning * into v_conversation;
  if v_conversation.current_queue_id is not null or v_conversation.current_agent_user_id is not null then
    insert into public.support_assignments(legal_entity_id,product_id,conversation_id,queue_id,agent_user_id,assigned_by,reason)
    values(v_legal_entity_id,v_product_id,v_conversation.id,v_conversation.current_queue_id,v_conversation.current_agent_user_id,p_actor_user_id,'Atribuição inicial');
  end if;
  v_message_body:=private.support_jsonb_text(p_payload,'initialMessage',false);
  if v_message_body is not null then
    v_sender_type:=coalesce(private.support_jsonb_text(p_payload,'initialSenderType',false),'customer');
    if v_sender_type not in('customer','agent','automation','system') then raise exception 'Remetente inicial inválido.';end if;
    v_direction:=case when v_sender_type='customer' then 'inbound' when v_sender_type='agent' then 'outbound' else 'internal' end;
    insert into public.support_messages(legal_entity_id,product_id,conversation_id,direction,sender_type,sender_user_id,content_type,body,delivery_status)
    values(v_legal_entity_id,v_product_id,v_conversation.id,v_direction,v_sender_type,case when v_sender_type='agent' then p_actor_user_id else null end,'text',v_message_body,'stored');
    update public.support_conversations set last_message_preview=left(v_message_body,240),last_activity_at=now(),last_customer_reply_at=case when v_sender_type='customer' then now() else null end,last_agent_reply_at=case when v_sender_type='agent' then now() else null end,status=case when v_sender_type='customer' then 'waiting_for_agent' when v_sender_type='agent' then 'waiting_for_customer' else status end,updated_by=p_actor_user_id where id=v_conversation.id;
  end if;
  return jsonb_build_object('conversation',(select to_jsonb(c) from public.support_conversations c where c.id=v_conversation.id),'messages',(select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at),'[]'::jsonb) from public.support_messages m where m.conversation_id=v_conversation.id));
end$$;
revoke all on function public.support_admin_create_conversation(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.support_admin_create_conversation(jsonb,uuid) to service_role;
