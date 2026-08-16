create or replace function public.support_admin_dispatch(p_action text,p_payload jsonb,p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_policy public.support_sla_policies%rowtype;
begin
  if p_action='list-products' then return public.support_admin_list_products();end if;
  if p_action='get-workspace' then return public.support_admin_get_workspace((p_payload->>'productId')::uuid);end if;
  if p_action='list-inbox' then return public.support_admin_list_inbox(p_payload);end if;
  if p_action='get-conversation' then return public.support_admin_get_conversation((p_payload->>'conversationId')::uuid);end if;
  if p_action='get-ticket' then return public.support_admin_get_ticket((p_payload->>'ticketId')::uuid);end if;
  if p_action='list-automation-versions' then return coalesce((select jsonb_agg(to_jsonb(v) order by v.version_number desc) from public.support_automation_versions v join public.support_automation_flows f on f.id=v.flow_id where f.product_id=(p_payload->>'productId')::uuid),'[]'::jsonb);end if;
  if p_action='preview-automation' then return public.support_admin_preview_automation((p_payload->>'versionId')::uuid);end if;
  if p_action='simulate-sla' then
    select * into v_policy from public.support_sla_policies where id=(p_payload->>'slaPolicyId')::uuid and status='active';if not found then raise exception 'Política de SLA não encontrada.';end if;
    return jsonb_build_object('firstResponseDueAt',public.support_calculate_due_at((p_payload->>'startedAt')::timestamptz,v_policy.first_response_minutes,v_policy.business_hours_id),'resolutionDueAt',public.support_calculate_due_at((p_payload->>'startedAt')::timestamptz,v_policy.resolution_minutes,v_policy.business_hours_id));
  end if;
  if p_action in('save-product-settings','save-product-member','save-queue','archive-queue','save-queue-members','save-category','save-tag','save-channel') then return public.support_admin_dispatch_catalog(p_action,p_payload,p_actor_user_id);end if;
  if p_action in('save-template','archive-template','save-form','archive-form','save-business-hours','save-sla-policy','save-escalation-rule') then return public.support_admin_dispatch_content(p_action,p_payload,p_actor_user_id);end if;
  if p_action='get-or-create-draft' then return public.support_admin_get_or_create_draft((p_payload->>'productId')::uuid,p_actor_user_id);end if;
  if p_action='save-automation-draft' then return public.support_admin_save_automation_draft((p_payload->>'versionId')::uuid,(p_payload->>'expectedVersion')::bigint,coalesce(p_payload->'settings','{}'::jsonb),coalesce(p_payload->'options','[]'::jsonb),p_actor_user_id);end if;
  if p_action='validate-automation' then return public.support_validate_automation_version((p_payload->>'versionId')::uuid);end if;
  if p_action='publish-automation' then return public.support_admin_publish_automation((p_payload->>'versionId')::uuid,(p_payload->>'expectedVersion')::bigint,p_actor_user_id);end if;
  if p_action='restore-automation-version' then return public.support_admin_restore_automation_version((p_payload->>'sourceVersionId')::uuid,p_actor_user_id);end if;
  if p_action='create-conversation' then return public.support_admin_create_conversation(p_payload,p_actor_user_id);end if;
  if p_action='reply-conversation' then return public.support_admin_append_message((p_payload->>'conversationId')::uuid,(p_payload->>'expectedVersion')::bigint,'outbound','agent',private.support_jsonb_text(p_payload,'body',true),coalesce(private.support_jsonb_text(p_payload,'contentType',false),'text'),coalesce(p_payload->'attachments','[]'::jsonb),private.support_jsonb_text(p_payload,'idempotencyKey',false),p_actor_user_id);end if;
  if p_action='add-conversation-note' then return public.support_admin_append_message((p_payload->>'conversationId')::uuid,(p_payload->>'expectedVersion')::bigint,'internal','agent',private.support_jsonb_text(p_payload,'note',true),'text',coalesce(p_payload->'attachments','[]'::jsonb),private.support_jsonb_text(p_payload,'idempotencyKey',false),p_actor_user_id);end if;
  if p_action='assign-conversation' then return public.support_admin_assign_conversation((p_payload->>'conversationId')::uuid,(p_payload->>'expectedVersion')::bigint,nullif(p_payload->>'queueId','')::uuid,nullif(p_payload->>'agentUserId','')::uuid,private.support_jsonb_text(p_payload,'reason',false),p_actor_user_id);end if;
  if p_action='transition-conversation' then return public.support_admin_transition_conversation((p_payload->>'conversationId')::uuid,(p_payload->>'expectedVersion')::bigint,private.support_jsonb_text(p_payload,'status',true),private.support_jsonb_text(p_payload,'reason',false),p_actor_user_id);end if;
  if p_action='create-ticket' then return public.support_admin_create_ticket(p_payload,p_actor_user_id);end if;
  if p_action='transition-ticket' then return public.support_admin_transition_ticket((p_payload->>'ticketId')::uuid,(p_payload->>'expectedVersion')::bigint,private.support_jsonb_text(p_payload,'transition',true),coalesce(p_payload->'payload','{}'::jsonb),p_actor_user_id);end if;
  if p_action='process-ticket-escalations' then
    if not coalesce((p_payload->>'dryRun')::boolean,true) and not coalesce((p_payload->>'confirm')::boolean,false) then raise exception 'Confirmação explícita obrigatória para persistir escalonamentos.';end if;
    return public.support_admin_process_ticket_escalations((p_payload->>'ticketId')::uuid,coalesce((p_payload->>'dryRun')::boolean,true),p_actor_user_id);
  end if;
  raise exception 'Ação administrativa não implementada.';
end$$;
revoke all on function public.support_admin_dispatch(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.support_admin_dispatch(text,jsonb,uuid) to service_role;
