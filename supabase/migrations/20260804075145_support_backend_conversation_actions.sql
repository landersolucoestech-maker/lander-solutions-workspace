create or replace function public.support_admin_append_message(p_conversation_id uuid,p_expected_version bigint,p_direction text,p_sender_type text,p_body text,p_content_type text,p_attachments jsonb,p_idempotency_key text,p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_conversation public.support_conversations%rowtype;v_message public.support_messages%rowtype;v_preview text;v_new_status text;
begin
  select * into v_conversation from public.support_conversations where id=p_conversation_id for update;
  if not found then raise exception 'Conversa não encontrada.';end if;
  if v_conversation.version<>p_expected_version then raise exception 'CONFLICT: conversa alterada por outro usuário.';end if;
  if v_conversation.status='closed' then raise exception 'Conversa encerrada não aceita novas mensagens.';end if;
  if p_direction not in('inbound','outbound','internal') then raise exception 'Direção de mensagem inválida.';end if;
  if p_sender_type not in('customer','agent','automation','system') then raise exception 'Remetente inválido.';end if;
  if p_content_type not in('text','html','file','event') then raise exception 'Tipo de conteúdo inválido.';end if;
  v_preview:=left(coalesce(nullif(btrim(p_body),''),'Anexo'),240);
  insert into public.support_messages(legal_entity_id,product_id,conversation_id,direction,sender_type,sender_user_id,content_type,body,attachments,idempotency_key,delivery_status)
  values(v_conversation.legal_entity_id,v_conversation.product_id,p_conversation_id,p_direction,p_sender_type,case when p_sender_type='agent' then p_actor_user_id else null end,p_content_type,p_body,coalesce(p_attachments,'[]'::jsonb),nullif(p_idempotency_key,''),case when p_direction='outbound' then 'queued' else 'stored' end) returning * into v_message;
  v_new_status:=case when p_direction='inbound' then 'waiting_for_agent' when p_direction='outbound' then 'waiting_for_customer' else v_conversation.status end;
  update public.support_conversations set status=v_new_status,last_message_preview=v_preview,last_activity_at=now(),last_customer_reply_at=case when p_direction='inbound' then now() else last_customer_reply_at end,last_agent_reply_at=case when p_direction='outbound' then now() else last_agent_reply_at end,updated_by=p_actor_user_id where id=p_conversation_id;
  if p_direction='outbound' and exists(select 1 from public.support_channels where id=v_conversation.channel_id and status='active' and channel_type not in('manual','in_app')) then
    insert into public.support_outbox(legal_entity_id,product_id,channel_id,conversation_id,message_id,destination,payload,idempotency_key)
    values(v_conversation.legal_entity_id,v_conversation.product_id,v_conversation.channel_id,p_conversation_id,v_message.id,coalesce(v_conversation.external_identifier,v_conversation.contact_party_id::text),jsonb_build_object('messageId',v_message.id,'body',p_body,'attachments',coalesce(p_attachments,'[]'::jsonb)),coalesce(nullif(p_idempotency_key,''),v_message.id::text));
  else update public.support_messages set delivery_status='stored' where id=v_message.id;end if;
  return jsonb_build_object('message',(select to_jsonb(m) from public.support_messages m where m.id=v_message.id),'conversation',(select to_jsonb(c) from public.support_conversations c where c.id=p_conversation_id));
end$$;

create or replace function public.support_admin_assign_conversation(p_conversation_id uuid,p_expected_version bigint,p_queue_id uuid,p_agent_user_id uuid,p_reason text,p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_conversation public.support_conversations%rowtype;
begin
  select * into v_conversation from public.support_conversations where id=p_conversation_id for update;
  if not found then raise exception 'Conversa não encontrada.';end if;
  if v_conversation.version<>p_expected_version then raise exception 'CONFLICT: conversa alterada por outro usuário.';end if;
  update public.support_assignments set ended_at=now() where conversation_id=p_conversation_id and ended_at is null;
  insert into public.support_assignments(legal_entity_id,product_id,conversation_id,queue_id,agent_user_id,assigned_by,reason)
  values(v_conversation.legal_entity_id,v_conversation.product_id,p_conversation_id,p_queue_id,p_agent_user_id,p_actor_user_id,nullif(btrim(p_reason),''));
  update public.support_conversations set current_queue_id=p_queue_id,current_agent_user_id=p_agent_user_id,status='open',updated_by=p_actor_user_id where id=p_conversation_id;
  return(select to_jsonb(c) from public.support_conversations c where c.id=p_conversation_id);
end$$;

create or replace function public.support_admin_transition_conversation(p_conversation_id uuid,p_expected_version bigint,p_status text,p_reason text,p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_conversation public.support_conversations%rowtype;
begin
  select * into v_conversation from public.support_conversations where id=p_conversation_id for update;
  if not found then raise exception 'Conversa não encontrada.';end if;
  if v_conversation.version<>p_expected_version then raise exception 'CONFLICT: conversa alterada por outro usuário.';end if;
  if p_status not in('new','automation','waiting_for_customer','waiting_for_agent','open','pending','resolved','closed') then raise exception 'Status de conversa inválido.';end if;
  if v_conversation.status='closed' and p_status<>'open' then raise exception 'Conversa encerrada só pode ser reaberta explicitamente.';end if;
  if p_status='closed' and nullif(btrim(p_reason),'') is null then raise exception 'Motivo do encerramento obrigatório.';end if;
  update public.support_conversations set status=p_status,resolved_at=case when p_status='resolved' then now() when p_status in('open','new') then null else resolved_at end,closed_at=case when p_status='closed' then now() when p_status='open' then null else closed_at end,updated_by=p_actor_user_id where id=p_conversation_id;
  insert into public.support_messages(legal_entity_id,product_id,conversation_id,direction,sender_type,sender_user_id,content_type,body,delivery_status)
  values(v_conversation.legal_entity_id,v_conversation.product_id,p_conversation_id,'internal','system',p_actor_user_id,'event',jsonb_build_object('status',p_status,'reason',nullif(btrim(p_reason),''))::text,'stored');
  return(select to_jsonb(c) from public.support_conversations c where c.id=p_conversation_id);
end$$;

revoke all on function public.support_admin_append_message(uuid,bigint,text,text,text,text,jsonb,text,uuid) from public,anon,authenticated;
revoke all on function public.support_admin_assign_conversation(uuid,bigint,uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.support_admin_transition_conversation(uuid,bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function public.support_admin_append_message(uuid,bigint,text,text,text,text,jsonb,text,uuid) to service_role;
grant execute on function public.support_admin_assign_conversation(uuid,bigint,uuid,uuid,text,uuid) to service_role;
grant execute on function public.support_admin_transition_conversation(uuid,bigint,text,text,uuid) to service_role;
