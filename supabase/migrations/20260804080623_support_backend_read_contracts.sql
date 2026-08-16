create or replace function private.support_scope_json(p_product_id uuid)
returns jsonb language sql stable security definer set search_path=''
as $$
  select jsonb_build_object('productId',p.id,'legalEntityId',bu.legal_entity_id,'unitCode',bu.code)
  from public.products p join public.business_units bu on bu.id=p.business_unit_id
  where p.id=p_product_id
$$;

create or replace function public.support_admin_resolve_scope(p_action text,p_payload jsonb)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_product_id uuid;v_resource_id uuid;v_flow_id uuid;v_legal_entity_id uuid;
begin
  if p_action='list-products' then return jsonb_build_object('productId',null,'legalEntityId',null,'unitCode',null);end if;
  if p_action in('get-workspace','list-inbox','list-automation-versions','save-product-settings','save-product-member','save-category','save-tag','save-channel','save-template','save-form','save-sla-policy','save-escalation-rule','get-or-create-draft','create-conversation','create-ticket') then
    v_product_id:=(p_payload->>'productId')::uuid;return private.support_scope_json(v_product_id);
  end if;
  if p_action='save-business-hours' then
    v_product_id:=nullif(p_payload->>'productId','')::uuid;
    if v_product_id is not null then return private.support_scope_json(v_product_id);end if;
    v_legal_entity_id:=(p_payload->>'legalEntityId')::uuid;
    return jsonb_build_object('productId',null,'legalEntityId',v_legal_entity_id,'unitCode',null);
  end if;
  if p_action in('save-queue','archive-queue','save-queue-members') then
    v_resource_id:=coalesce(nullif(p_payload->>'queueId','')::uuid,nullif(p_payload->>'id','')::uuid);
    if v_resource_id is not null then
      select product_id,legal_entity_id into v_product_id,v_legal_entity_id from public.support_queues where id=v_resource_id;
      if not found then raise exception 'Fila não encontrada.';end if;
      if v_product_id is not null then return private.support_scope_json(v_product_id);end if;
      return jsonb_build_object('productId',null,'legalEntityId',v_legal_entity_id,'unitCode',null);
    end if;
    v_product_id:=nullif(p_payload->>'productId','')::uuid;
    if v_product_id is not null then return private.support_scope_json(v_product_id);end if;
    return jsonb_build_object('productId',null,'legalEntityId',(p_payload->>'legalEntityId')::uuid,'unitCode',null);
  end if;
  if p_action='archive-template' then select product_id into v_product_id from public.support_message_templates where id=(p_payload->>'templateId')::uuid;
  elsif p_action='archive-form' then select product_id into v_product_id from public.support_forms where id=(p_payload->>'formId')::uuid;
  elsif p_action in('preview-automation','save-automation-draft','validate-automation','publish-automation','restore-automation-version') then
    select flow_id into v_flow_id from public.support_automation_versions where id=(p_payload->>case when p_action='restore-automation-version' then 'sourceVersionId' else 'versionId' end)::uuid;
    select product_id into v_product_id from public.support_automation_flows where id=v_flow_id;
  elsif p_action in('get-conversation','reply-conversation','add-conversation-note','assign-conversation','transition-conversation') then select product_id into v_product_id from public.support_conversations where id=(p_payload->>'conversationId')::uuid;
  elsif p_action in('get-ticket','transition-ticket','process-ticket-escalations') then select product_id into v_product_id from public.support_tickets where id=(p_payload->>'ticketId')::uuid;
  elsif p_action='simulate-sla' then select product_id into v_product_id from public.support_sla_policies where id=(p_payload->>'slaPolicyId')::uuid;
  else raise exception 'Ação de escopo desconhecida.';
  end if;
  if v_product_id is null then raise exception 'Recurso não encontrado ou sem produto.';end if;
  return private.support_scope_json(v_product_id);
end$$;

create or replace function public.support_admin_list_products()
returns jsonb language sql stable security definer set search_path=''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'businessUnitId',p.business_unit_id,'code',p.code,'name',p.name,'description',p.description,
    'productType',p.product_type,'status',p.status,'version',p.version,'createdAt',p.created_at,'updatedAt',p.updated_at,
    'businessUnit',jsonb_build_object('id',bu.id,'legalEntityId',bu.legal_entity_id,'code',bu.code,'name',bu.name,'status',bu.status),
    'settings',to_jsonb(s)
  ) order by p.name),'[]'::jsonb)
  from public.products p join public.business_units bu on bu.id=p.business_unit_id join public.support_product_settings s on s.product_id=p.id
  where p.status in('active','planned') and s.status<>'archived'
$$;

create or replace function public.support_admin_get_workspace(p_product_id uuid)
returns jsonb language sql stable security definer set search_path=''
as $$
  select jsonb_build_object(
    'product',(select to_jsonb(p) from public.products p where p.id=p_product_id),
    'scope',private.support_scope_json(p_product_id),
    'settings',(select to_jsonb(s) from public.support_product_settings s where s.product_id=p_product_id),
    'productMembers',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at),'[]'::jsonb) from public.support_product_members x where x.product_id=p_product_id),
    'queues',(select coalesce(jsonb_agg(to_jsonb(x) order by x.name),'[]'::jsonb) from public.support_queues x where x.legal_entity_id=private.support_product_legal_entity_id(p_product_id) and(x.product_id=p_product_id or x.product_id is null)),
    'queueMembers',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at),'[]'::jsonb) from public.support_queue_members x where exists(select 1 from public.support_queues q where q.id=x.queue_id and q.legal_entity_id=private.support_product_legal_entity_id(p_product_id) and(q.product_id=p_product_id or q.product_id is null))),
    'channels',(select coalesce(jsonb_agg(to_jsonb(x) order by x.name),'[]'::jsonb) from public.support_channels x where x.product_id=p_product_id),
    'categories',(select coalesce(jsonb_agg(to_jsonb(x) order by x.name),'[]'::jsonb) from public.support_categories x where x.product_id=p_product_id),
    'tags',(select coalesce(jsonb_agg(to_jsonb(x) order by x.name),'[]'::jsonb) from public.support_tags x where x.product_id=p_product_id),
    'templates',(select coalesce(jsonb_agg(to_jsonb(x) order by x.code,x.template_version desc),'[]'::jsonb) from public.support_message_templates x where x.product_id=p_product_id),
    'forms',(select coalesce(jsonb_agg(to_jsonb(x) order by x.code,x.form_version desc),'[]'::jsonb) from public.support_forms x where x.product_id=p_product_id),
    'formFields',(select coalesce(jsonb_agg(to_jsonb(ff) order by ff.form_id,ff.display_order),'[]'::jsonb) from public.support_form_fields ff join public.support_forms f on f.id=ff.form_id where f.product_id=p_product_id),
    'businessHours',(select coalesce(jsonb_agg(to_jsonb(x) order by x.name),'[]'::jsonb) from public.support_business_hours x where x.legal_entity_id=private.support_product_legal_entity_id(p_product_id) and(x.product_id=p_product_id or x.product_id is null)),
    'businessHourIntervals',(select coalesce(jsonb_agg(to_jsonb(i) order by i.business_hours_id,i.weekday,i.starts_at),'[]'::jsonb) from public.support_business_hour_intervals i join public.support_business_hours h on h.id=i.business_hours_id where h.legal_entity_id=private.support_product_legal_entity_id(p_product_id) and(h.product_id=p_product_id or h.product_id is null)),
    'holidays',(select coalesce(jsonb_agg(to_jsonb(d) order by d.holiday_date),'[]'::jsonb) from public.support_holidays d join public.support_business_hours h on h.id=d.business_hours_id where h.legal_entity_id=private.support_product_legal_entity_id(p_product_id) and(h.product_id=p_product_id or h.product_id is null)),
    'slaPolicies',(select coalesce(jsonb_agg(to_jsonb(x) order by x.name),'[]'::jsonb) from public.support_sla_policies x where x.product_id=p_product_id),
    'escalationRules',(select coalesce(jsonb_agg(to_jsonb(x) order by x.display_order,x.escalation_level),'[]'::jsonb) from public.support_escalation_rules x where x.product_id=p_product_id),
    'automationFlow',(select to_jsonb(f) from public.support_automation_flows f where f.product_id=p_product_id),
    'automationVersions',(select coalesce(jsonb_agg(to_jsonb(v) order by v.version_number desc),'[]'::jsonb) from public.support_automation_versions v join public.support_automation_flows f on f.id=v.flow_id where f.product_id=p_product_id),
    'routingOptions',(select coalesce(jsonb_agg(to_jsonb(o) order by o.automation_version_id,o.display_order),'[]'::jsonb) from public.support_routing_options o join public.support_automation_versions v on v.id=o.automation_version_id join public.support_automation_flows f on f.id=v.flow_id where f.product_id=p_product_id),
    'routingOptionTags',(select coalesce(jsonb_agg(to_jsonb(ot)),'[]'::jsonb) from public.support_routing_option_tags ot join public.support_routing_options o on o.id=ot.routing_option_id join public.support_automation_versions v on v.id=o.automation_version_id join public.support_automation_flows f on f.id=v.flow_id where f.product_id=p_product_id),
    'profiles',(select coalesce(jsonb_agg(jsonb_build_object('id',pr.id,'email',pr.email,'displayName',pr.display_name,'status',pr.status,'mfaRequired',pr.mfa_required,'lastSeenAt',pr.last_seen_at,'version',pr.version) order by pr.display_name),'[]'::jsonb) from public.profiles pr where pr.status='active'),
    'contacts',(select coalesce(jsonb_agg(jsonb_build_object('id',pt.id,'legalName',pt.legal_name,'tradeName',pt.trade_name,'status',pt.status) order by pt.legal_name),'[]'::jsonb) from public.parties pt where pt.status='active' and pt.party_type='person'),
    'organizations',(select coalesce(jsonb_agg(jsonb_build_object('id',pt.id,'legalName',pt.legal_name,'tradeName',pt.trade_name,'status',pt.status) order by pt.legal_name),'[]'::jsonb) from public.parties pt where pt.status='active' and pt.party_type='organization')
  )
$$;

create or replace function public.support_admin_list_inbox(p_payload jsonb)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_product_id uuid:=(p_payload->>'productId')::uuid;v_page integer:=greatest(coalesce((p_payload->>'page')::integer,1),1);v_size integer:=least(greatest(coalesce((p_payload->>'pageSize')::integer,50),1),100);v_offset integer;v_rows jsonb;v_count bigint;
begin
  v_offset:=(v_page-1)*v_size;
  select count(*) into v_count from public.support_conversations c where c.product_id=v_product_id
    and(nullif(p_payload->>'queueId','') is null or c.current_queue_id=(p_payload->>'queueId')::uuid)
    and(nullif(p_payload->>'agentUserId','') is null or c.current_agent_user_id=(p_payload->>'agentUserId')::uuid)
    and(nullif(p_payload->>'channelId','') is null or c.channel_id=(p_payload->>'channelId')::uuid)
    and(nullif(p_payload->>'status','') is null or c.status=p_payload->>'status')
    and(nullif(p_payload->>'priority','') is null or c.priority=p_payload->>'priority')
    and(coalesce((p_payload->>'unassigned')::boolean,false)=false or c.current_agent_user_id is null);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.last_activity_at desc),'[]'::jsonb) into v_rows from(
    select c.*,jsonb_build_object('id',pt.id,'name',coalesce(pt.trade_name,pt.legal_name)) contact,
      case when q.id is null then null else jsonb_build_object('id',q.id,'name',q.name,'code',q.code) end queue,
      case when pr.id is null then null else jsonb_build_object('id',pr.id,'name',pr.display_name,'email',pr.email) end agent,
      jsonb_build_object('id',ch.id,'name',ch.name,'type',ch.channel_type,'status',ch.status) channel
    from public.support_conversations c
    join public.parties pt on pt.id=c.contact_party_id
    join public.support_channels ch on ch.id=c.channel_id
    left join public.support_queues q on q.id=c.current_queue_id
    left join public.profiles pr on pr.id=c.current_agent_user_id
    where c.product_id=v_product_id
      and(nullif(p_payload->>'queueId','') is null or c.current_queue_id=(p_payload->>'queueId')::uuid)
      and(nullif(p_payload->>'agentUserId','') is null or c.current_agent_user_id=(p_payload->>'agentUserId')::uuid)
      and(nullif(p_payload->>'channelId','') is null or c.channel_id=(p_payload->>'channelId')::uuid)
      and(nullif(p_payload->>'status','') is null or c.status=p_payload->>'status')
      and(nullif(p_payload->>'priority','') is null or c.priority=p_payload->>'priority')
      and(coalesce((p_payload->>'unassigned')::boolean,false)=false or c.current_agent_user_id is null)
    order by c.last_activity_at desc limit v_size offset v_offset
  )x;
  return jsonb_build_object('conversations',v_rows,'count',v_count,'page',v_page,'pageSize',v_size);
end$$;

create or replace function public.support_admin_get_conversation(p_conversation_id uuid)
returns jsonb language sql stable security definer set search_path=''
as $$
  select jsonb_build_object(
    'conversation',(select to_jsonb(c) from public.support_conversations c where c.id=p_conversation_id),
    'messages',(select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at),'[]'::jsonb) from public.support_messages m where m.conversation_id=p_conversation_id),
    'tickets',(select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]'::jsonb) from public.support_tickets t where t.conversation_id=p_conversation_id),
    'assignments',(select coalesce(jsonb_agg(to_jsonb(a) order by a.started_at desc),'[]'::jsonb) from public.support_assignments a where a.conversation_id=p_conversation_id)
  )
$$;

create or replace function public.support_admin_get_ticket(p_ticket_id uuid)
returns jsonb language sql stable security definer set search_path=''
as $$
  select jsonb_build_object(
    'ticket',(select to_jsonb(t) from public.support_tickets t where t.id=p_ticket_id),
    'events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.occurred_at),'[]'::jsonb) from public.support_ticket_events e where e.ticket_id=p_ticket_id),
    'assignments',(select coalesce(jsonb_agg(to_jsonb(a) order by a.started_at desc),'[]'::jsonb) from public.support_assignments a where a.ticket_id=p_ticket_id),
    'tags',(select coalesce(jsonb_agg(to_jsonb(tt)),'[]'::jsonb) from public.support_ticket_tags tt where tt.ticket_id=p_ticket_id)
  )
$$;

create or replace function public.support_admin_preview_automation(p_version_id uuid)
returns jsonb language sql stable security definer set search_path=''
as $$
  select jsonb_build_object(
    'version',(select to_jsonb(v) from public.support_automation_versions v where v.id=p_version_id),
    'options',(select coalesce(jsonb_agg(to_jsonb(o) order by o.display_order),'[]'::jsonb) from public.support_routing_options o where o.automation_version_id=p_version_id),
    'optionTags',(select coalesce(jsonb_agg(to_jsonb(ot)),'[]'::jsonb) from public.support_routing_option_tags ot join public.support_routing_options o on o.id=ot.routing_option_id where o.automation_version_id=p_version_id),
    'renderedMenu',(select string_agg(o.display_order||'. '||o.title,E'\n' order by o.display_order) from public.support_routing_options o where o.automation_version_id=p_version_id and o.status='active')
  )
$$;

revoke all on function private.support_scope_json(uuid) from public,anon,authenticated;
revoke all on function public.support_admin_resolve_scope(text,jsonb) from public,anon,authenticated;
revoke all on function public.support_admin_list_products() from public,anon,authenticated;
revoke all on function public.support_admin_get_workspace(uuid) from public,anon,authenticated;
revoke all on function public.support_admin_list_inbox(jsonb) from public,anon,authenticated;
revoke all on function public.support_admin_get_conversation(uuid) from public,anon,authenticated;
revoke all on function public.support_admin_get_ticket(uuid) from public,anon,authenticated;
revoke all on function public.support_admin_preview_automation(uuid) from public,anon,authenticated;
grant execute on function public.support_admin_resolve_scope(text,jsonb) to service_role;
grant execute on function public.support_admin_list_products() to service_role;
grant execute on function public.support_admin_get_workspace(uuid) to service_role;
grant execute on function public.support_admin_list_inbox(jsonb) to service_role;
grant execute on function public.support_admin_get_conversation(uuid) to service_role;
grant execute on function public.support_admin_get_ticket(uuid) to service_role;
grant execute on function public.support_admin_preview_automation(uuid) to service_role;
