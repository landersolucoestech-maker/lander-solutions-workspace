create or replace function public.support_admin_create_ticket(p_payload jsonb,p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_conversation public.support_conversations%rowtype;v_sla public.support_sla_policies%rowtype;v_ticket public.support_tickets%rowtype;v_product_id uuid;v_legal_entity_id uuid;v_conversation_id uuid;v_queue_id uuid;v_agent_id uuid;v_sla_id uuid;v_contact_id uuid;v_org_id uuid;v_priority text;v_now timestamptz:=now();
begin
  begin v_product_id:=(p_payload->>'productId')::uuid;exception when others then raise exception 'Produto inválido.';end;
  v_legal_entity_id:=private.support_product_legal_entity_id(v_product_id);if v_legal_entity_id is null then raise exception 'Produto inexistente.';end if;
  v_conversation_id:=nullif(p_payload->>'conversationId','')::uuid;
  if v_conversation_id is not null then
    select * into v_conversation from public.support_conversations where id=v_conversation_id;
    if not found or v_conversation.product_id<>v_product_id then raise exception 'Conversa inválida para o produto.';end if;
    v_contact_id:=v_conversation.contact_party_id;v_org_id:=v_conversation.organization_party_id;
  else
    begin v_contact_id:=(p_payload->>'contactPartyId')::uuid;exception when others then raise exception 'Contato inválido.';end;
    v_org_id:=nullif(p_payload->>'organizationPartyId','')::uuid;
  end if;
  v_queue_id:=nullif(p_payload->>'queueId','')::uuid;v_agent_id:=nullif(p_payload->>'agentUserId','')::uuid;v_sla_id:=nullif(p_payload->>'slaPolicyId','')::uuid;v_priority:=coalesce(private.support_jsonb_text(p_payload,'priority',false),'normal');
  if v_sla_id is not null then select * into v_sla from public.support_sla_policies where id=v_sla_id and product_id=v_product_id and status='active';if not found then raise exception 'SLA inválido.';end if;end if;
  insert into public.support_tickets(ticket_number,legal_entity_id,product_id,conversation_id,contact_party_id,organization_party_id,category_id,subcategory_id,queue_id,agent_user_id,priority,status,title,description,collected_data,sla_policy_id,first_response_due_at,resolution_due_at,created_by,updated_by)
  values('',v_legal_entity_id,v_product_id,v_conversation_id,v_contact_id,v_org_id,nullif(p_payload->>'categoryId','')::uuid,nullif(p_payload->>'subcategoryId','')::uuid,v_queue_id,v_agent_id,v_priority,'new',private.support_jsonb_text(p_payload,'title',true),private.support_jsonb_text(p_payload,'description',false),coalesce(p_payload->'collectedData','{}'::jsonb),v_sla_id,case when v_sla_id is null then null else public.support_calculate_due_at(v_now,v_sla.first_response_minutes,v_sla.business_hours_id) end,case when v_sla_id is null then null else public.support_calculate_due_at(v_now,v_sla.resolution_minutes,v_sla.business_hours_id) end,p_actor_user_id,p_actor_user_id) returning * into v_ticket;
  insert into public.support_ticket_events(legal_entity_id,product_id,ticket_id,conversation_id,event_type,actor_user_id,payload) values(v_legal_entity_id,v_product_id,v_ticket.id,v_conversation_id,'created',p_actor_user_id,jsonb_build_object('title',v_ticket.title,'priority',v_ticket.priority));
  if v_queue_id is not null or v_agent_id is not null then insert into public.support_assignments(legal_entity_id,product_id,ticket_id,queue_id,agent_user_id,assigned_by,reason) values(v_legal_entity_id,v_product_id,v_ticket.id,v_queue_id,v_agent_id,p_actor_user_id,'Atribuição inicial');end if;
  return to_jsonb(v_ticket);
end$$;

create or replace function public.support_admin_transition_ticket(p_ticket_id uuid,p_expected_version bigint,p_action text,p_payload jsonb,p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_ticket public.support_tickets%rowtype;v_event text;v_queue uuid;v_agent uuid;v_status text;v_priority text;v_reason text;
begin
  select * into v_ticket from public.support_tickets where id=p_ticket_id for update;
  if not found then raise exception 'Ticket não encontrado.';end if;
  if v_ticket.version<>p_expected_version then raise exception 'CONFLICT: ticket alterado por outro usuário.';end if;
  if p_action='assign' then
    v_queue:=nullif(p_payload->>'queueId','')::uuid;v_agent:=nullif(p_payload->>'agentUserId','')::uuid;v_reason:=private.support_jsonb_text(p_payload,'reason',false);
    update public.support_assignments set ended_at=now() where ticket_id=p_ticket_id and ended_at is null;
    insert into public.support_assignments(legal_entity_id,product_id,ticket_id,queue_id,agent_user_id,assigned_by,reason) values(v_ticket.legal_entity_id,v_ticket.product_id,p_ticket_id,v_queue,v_agent,p_actor_user_id,v_reason);
    update public.support_tickets set queue_id=v_queue,agent_user_id=v_agent,status=case when status='new' then 'open' else status end,updated_by=p_actor_user_id where id=p_ticket_id;v_event:='assigned';
  elsif p_action='priority' then
    v_priority:=private.support_jsonb_text(p_payload,'priority',true);if v_priority not in('low','normal','high','urgent','critical') then raise exception 'Prioridade inválida.';end if;
    update public.support_tickets set priority=v_priority,updated_by=p_actor_user_id where id=p_ticket_id;v_event:='priority_changed';
  elsif p_action='status' then
    v_status:=private.support_jsonb_text(p_payload,'status',true);if v_status not in('new','open','pending','waiting_for_customer','waiting_for_agent') then raise exception 'Status inválido para esta ação.';end if;
    if v_ticket.status='closed' then raise exception 'Ticket encerrado deve ser reaberto explicitamente.';end if;
    update public.support_tickets set status=v_status,updated_by=p_actor_user_id where id=p_ticket_id;v_event:='status_changed';
  elsif p_action='resolve' then
    if v_ticket.status='closed' then raise exception 'Ticket encerrado não pode ser resolvido.';end if;
    update public.support_tickets set status='resolved',resolved_at=now(),updated_by=p_actor_user_id where id=p_ticket_id;v_event:='resolved';
  elsif p_action='reopen' then
    if v_ticket.status not in('resolved','closed') then raise exception 'Somente tickets resolvidos ou encerrados podem ser reabertos.';end if;
    update public.support_tickets set status='open',resolved_at=null,closed_at=null,closure_reason=null,updated_by=p_actor_user_id where id=p_ticket_id;v_event:='reopened';
  elsif p_action='close' then
    v_reason:=private.support_jsonb_text(p_payload,'reason',true);update public.support_tickets set status='closed',closed_at=now(),closure_reason=v_reason,updated_by=p_actor_user_id where id=p_ticket_id;v_event:='closed';
  elsif p_action='internal_note' then v_reason:=private.support_jsonb_text(p_payload,'note',true);v_event:='internal_note';
  else raise exception 'Transição de ticket desconhecida.';
  end if;
  insert into public.support_ticket_events(legal_entity_id,product_id,ticket_id,conversation_id,event_type,actor_user_id,payload) values(v_ticket.legal_entity_id,v_ticket.product_id,p_ticket_id,v_ticket.conversation_id,v_event,p_actor_user_id,coalesce(p_payload,'{}'::jsonb));
  return(select to_jsonb(t) from public.support_tickets t where t.id=p_ticket_id);
end$$;

create or replace function public.support_admin_process_ticket_escalations(p_ticket_id uuid,p_dry_run boolean,p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_ticket public.support_tickets%rowtype;v_rule record;v_candidate boolean;v_channel text;v_key text;v_results jsonb:='[]'::jsonb;v_existing integer;v_last_created timestamptz;
begin
  select * into v_ticket from public.support_tickets where id=p_ticket_id;
  if not found then raise exception 'Ticket não encontrado.';end if;
  if v_ticket.status in('resolved','closed') then return jsonb_build_object('ticketId',p_ticket_id,'dryRun',p_dry_run,'notifications','[]'::jsonb);end if;
  for v_rule in select * from public.support_escalation_rules where product_id=v_ticket.product_id and status='active' and(queue_id is null or queue_id=v_ticket.queue_id) and(sla_policy_id is null or sla_policy_id=v_ticket.sla_policy_id) order by display_order,escalation_level loop
    v_candidate:=false;
    if v_rule.event_type='ticket_unassigned' then v_candidate:=v_ticket.agent_user_id is null and now()>=v_ticket.created_at+make_interval(mins=>v_rule.elapsed_minutes);end if;
    if v_rule.event_type='first_response_breached' then v_candidate:=v_ticket.first_responded_at is null and v_ticket.first_response_due_at is not null and now()>=v_ticket.first_response_due_at+make_interval(mins=>v_rule.elapsed_minutes);end if;
    if v_rule.event_type='first_response_at_risk' then v_candidate:=v_ticket.first_responded_at is null and v_ticket.first_response_due_at is not null and now()>=v_ticket.first_response_due_at-make_interval(mins=>v_rule.elapsed_minutes) and now()<v_ticket.first_response_due_at;end if;
    if v_rule.event_type='resolution_breached' then v_candidate:=v_ticket.resolved_at is null and v_ticket.resolution_due_at is not null and now()>=v_ticket.resolution_due_at+make_interval(mins=>v_rule.elapsed_minutes);end if;
    if v_rule.event_type='resolution_at_risk' then v_candidate:=v_ticket.resolved_at is null and v_ticket.resolution_due_at is not null and now()>=v_ticket.resolution_due_at-make_interval(mins=>v_rule.elapsed_minutes) and now()<v_ticket.resolution_due_at;end if;
    if v_rule.event_type='critical_incident' then v_candidate:=v_ticket.priority='critical';end if;
    if not v_candidate then continue;end if;
    for v_channel in select unnest(v_rule.delivery_channels) loop
      select count(*),max(created_at) into v_existing,v_last_created from public.support_notifications where escalation_rule_id=v_rule.id and ticket_id=p_ticket_id and delivery_channel=v_channel and status<>'cancelled';
      if v_existing>=v_rule.notification_limit then continue;end if;
      if v_existing>0 and v_rule.repeat_policy='once' then continue;end if;
      if v_existing>0 and v_rule.repeat_interval_minutes is not null and v_last_created>now()-make_interval(mins=>v_rule.repeat_interval_minutes) then continue;end if;
      v_key:=concat('ticket:',p_ticket_id,':rule:',v_rule.id,':channel:',v_channel,':attempt:',v_existing+1);
      v_results:=v_results||jsonb_build_array(jsonb_build_object('ruleId',v_rule.id,'eventType',v_rule.event_type,'channel',v_channel,'recipientUserId',v_rule.recipient_user_id,'recipientQueueId',v_rule.recipient_queue_id,'message',v_rule.message,'idempotencyKey',v_key));
      if not p_dry_run then
        insert into public.support_notifications(legal_entity_id,product_id,ticket_id,conversation_id,escalation_rule_id,recipient_user_id,delivery_channel,status,message,idempotency_key,next_attempt_at)
        values(v_ticket.legal_entity_id,v_ticket.product_id,p_ticket_id,v_ticket.conversation_id,v_rule.id,v_rule.recipient_user_id,v_channel,'pending',v_rule.message,v_key,now()) on conflict(idempotency_key) do nothing;
        insert into public.support_ticket_events(legal_entity_id,product_id,ticket_id,conversation_id,event_type,actor_user_id,payload) values(v_ticket.legal_entity_id,v_ticket.product_id,p_ticket_id,v_ticket.conversation_id,'escalated',p_actor_user_id,jsonb_build_object('ruleId',v_rule.id,'channel',v_channel,'dryRun',false));
      end if;
    end loop;
  end loop;
  return jsonb_build_object('ticketId',p_ticket_id,'dryRun',p_dry_run,'notifications',v_results);
end$$;

revoke all on function public.support_admin_create_ticket(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.support_admin_transition_ticket(uuid,bigint,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.support_admin_process_ticket_escalations(uuid,boolean,uuid) from public,anon,authenticated;
grant execute on function public.support_admin_create_ticket(jsonb,uuid) to service_role;
grant execute on function public.support_admin_transition_ticket(uuid,bigint,text,jsonb,uuid) to service_role;
grant execute on function public.support_admin_process_ticket_escalations(uuid,boolean,uuid) to service_role;
