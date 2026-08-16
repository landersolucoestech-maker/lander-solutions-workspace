create or replace function public.support_admin_get_or_create_draft(p_product_id uuid,p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_flow public.support_automation_flows%rowtype;v_source public.support_automation_versions%rowtype;v_draft_id uuid;v_next_number integer;v_option record;v_new_option_id uuid;
begin
  select * into v_flow from public.support_automation_flows where product_id=p_product_id for update;
  if not found then raise exception 'Fluxo de automação não encontrado para o produto.';end if;
  if v_flow.draft_version_id is not null then return jsonb_build_object('version',(select to_jsonb(v) from public.support_automation_versions v where v.id=v_flow.draft_version_id),'options',(select coalesce(jsonb_agg(to_jsonb(o) order by o.display_order),'[]'::jsonb) from public.support_routing_options o where o.automation_version_id=v_flow.draft_version_id));end if;
  select coalesce(max(version_number),0)+1 into v_next_number from public.support_automation_versions where flow_id=v_flow.id;
  if v_flow.published_version_id is not null then
    select * into v_source from public.support_automation_versions where id=v_flow.published_version_id;
    insert into public.support_automation_versions(flow_id,version_number,status,welcome_message,invalid_option_message,inactivity_message,out_of_hours_message,human_handoff_message,closing_message,return_commands,invalid_attempt_limit,inactivity_minutes,inactivity_action,fallback_queue_id,language_code,timezone,menu_render_mode,custom_menu_text,created_by,updated_by)
    values(v_flow.id,v_next_number,'draft',v_source.welcome_message,v_source.invalid_option_message,v_source.inactivity_message,v_source.out_of_hours_message,v_source.human_handoff_message,v_source.closing_message,v_source.return_commands,v_source.invalid_attempt_limit,v_source.inactivity_minutes,v_source.inactivity_action,v_source.fallback_queue_id,v_source.language_code,v_source.timezone,v_source.menu_render_mode,v_source.custom_menu_text,p_actor_user_id,p_actor_user_id) returning id into v_draft_id;
    for v_option in select * from public.support_routing_options where automation_version_id=v_source.id order by display_order loop
      insert into public.support_routing_options(automation_version_id,display_order,title,description,status,category_id,queue_id,default_assignee_user_id,priority,response_template_id,form_id,action_type,action_settings)
      values(v_draft_id,v_option.display_order,v_option.title,v_option.description,v_option.status,v_option.category_id,v_option.queue_id,v_option.default_assignee_user_id,v_option.priority,v_option.response_template_id,v_option.form_id,v_option.action_type,v_option.action_settings) returning id into v_new_option_id;
      insert into public.support_routing_option_tags(routing_option_id,tag_id) select v_new_option_id,tag_id from public.support_routing_option_tags where routing_option_id=v_option.id;
    end loop;
  else
    insert into public.support_automation_versions(flow_id,version_number,status,created_by,updated_by) values(v_flow.id,v_next_number,'draft',p_actor_user_id,p_actor_user_id) returning id into v_draft_id;
  end if;
  update public.support_automation_flows set draft_version_id=v_draft_id,updated_by=p_actor_user_id where id=v_flow.id;
  return jsonb_build_object('version',(select to_jsonb(v) from public.support_automation_versions v where v.id=v_draft_id),'options',(select coalesce(jsonb_agg(to_jsonb(o) order by o.display_order),'[]'::jsonb) from public.support_routing_options o where o.automation_version_id=v_draft_id));
end$$;

create or replace function public.support_validate_automation_version(p_version_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_version public.support_automation_versions%rowtype;v_product_id uuid;v_errors jsonb:='[]'::jsonb;v_option record;
begin
  select * into v_version from public.support_automation_versions where id=p_version_id;
  if not found then raise exception 'Versão de automação não encontrada.';end if;
  select product_id into v_product_id from public.support_automation_flows where id=v_version.flow_id;
  if v_version.status<>'draft' then v_errors:=v_errors||jsonb_build_array(jsonb_build_object('code','not_draft','message','Somente rascunhos podem ser validados e publicados.'));end if;
  if v_version.fallback_queue_id is null then v_errors:=v_errors||jsonb_build_array(jsonb_build_object('code','fallback_required','message','A automação precisa de uma fila de fallback.'));end if;
  if nullif(btrim(v_version.welcome_message),'') is null then v_errors:=v_errors||jsonb_build_array(jsonb_build_object('code','welcome_required','message','A mensagem de boas-vindas é obrigatória.'));end if;
  if nullif(btrim(v_version.invalid_option_message),'') is null then v_errors:=v_errors||jsonb_build_array(jsonb_build_object('code','invalid_message_required','message','A mensagem de opção inválida é obrigatória.'));end if;
  if cardinality(v_version.return_commands)=0 then v_errors:=v_errors||jsonb_build_array(jsonb_build_object('code','return_command_required','message','Informe ao menos um comando de retorno.'));end if;
  if exists(select 1 from unnest(v_version.return_commands)c group by lower(btrim(c)) having count(*)>1) then v_errors:=v_errors||jsonb_build_array(jsonb_build_object('code','duplicate_return_command','message','Existem comandos de retorno duplicados.'));end if;
  if not exists(select 1 from public.support_routing_options where automation_version_id=p_version_id and status='active') then v_errors:=v_errors||jsonb_build_array(jsonb_build_object('code','routing_option_required','message','Crie ao menos uma opção ativa de triagem.'));end if;
  for v_option in select * from public.support_routing_options where automation_version_id=p_version_id and status='active' order by display_order loop
    if nullif(btrim(v_option.title),'') is null then v_errors:=v_errors||jsonb_build_array(jsonb_build_object('code','option_title_required','optionId',v_option.id,'message','Opção sem título.'));end if;
    if v_option.action_type in('assign_queue','human_handoff','create_ticket') and v_option.queue_id is null then v_errors:=v_errors||jsonb_build_array(jsonb_build_object('code','option_queue_required','optionId',v_option.id,'message','A ação exige uma fila.'));end if;
    if v_option.action_type='assign_agent' and v_option.default_assignee_user_id is null then v_errors:=v_errors||jsonb_build_array(jsonb_build_object('code','option_agent_required','optionId',v_option.id,'message','A ação exige um responsável.'));end if;
    if v_option.action_type='collect_form' and v_option.form_id is null then v_errors:=v_errors||jsonb_build_array(jsonb_build_object('code','option_form_required','optionId',v_option.id,'message','A ação exige um formulário.'));end if;
    if v_option.action_type='send_template' and v_option.response_template_id is null then v_errors:=v_errors||jsonb_build_array(jsonb_build_object('code','option_template_required','optionId',v_option.id,'message','A ação exige um template.'));end if;
  end loop;
  return jsonb_build_object('valid',jsonb_array_length(v_errors)=0,'errors',v_errors,'productId',v_product_id);
end$$;

create or replace function public.support_admin_save_automation_draft(p_version_id uuid,p_expected_version bigint,p_settings jsonb,p_options jsonb,p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_version public.support_automation_versions%rowtype;v_product_id uuid;v_option jsonb;v_option_id uuid;v_tag_id_text text;v_order integer;
begin
  if jsonb_typeof(p_options)<>'array' then raise exception 'Opções devem ser um array.';end if;
  select * into v_version from public.support_automation_versions where id=p_version_id for update;
  if not found then raise exception 'Rascunho não encontrado.';end if;
  select product_id into v_product_id from public.support_automation_flows where id=v_version.flow_id;
  if v_version.status<>'draft' then raise exception 'Somente rascunhos podem ser alterados.';end if;
  if v_version.version<>p_expected_version then raise exception 'CONFLICT: rascunho alterado por outro usuário.';end if;
  update public.support_automation_versions set welcome_message=private.support_jsonb_text(p_settings,'welcomeMessage',false),invalid_option_message=private.support_jsonb_text(p_settings,'invalidOptionMessage',false),inactivity_message=private.support_jsonb_text(p_settings,'inactivityMessage',false),out_of_hours_message=private.support_jsonb_text(p_settings,'outOfHoursMessage',false),human_handoff_message=private.support_jsonb_text(p_settings,'humanHandoffMessage',false),closing_message=private.support_jsonb_text(p_settings,'closingMessage',false),return_commands=coalesce(array(select jsonb_array_elements_text(coalesce(p_settings->'returnCommands','[]'::jsonb))),array[]::text[]),invalid_attempt_limit=coalesce(nullif(p_settings->>'invalidAttemptLimit','')::integer,3),inactivity_minutes=coalesce(nullif(p_settings->>'inactivityMinutes','')::integer,30),inactivity_action=coalesce(private.support_jsonb_text(p_settings,'inactivityAction',false),'return_to_menu'),fallback_queue_id=nullif(p_settings->>'fallbackQueueId','')::uuid,language_code=coalesce(private.support_jsonb_text(p_settings,'languageCode',false),'pt-BR'),timezone=coalesce(private.support_jsonb_text(p_settings,'timezone',false),'America/Sao_Paulo'),menu_render_mode=coalesce(private.support_jsonb_text(p_settings,'menuRenderMode',false),'auto_generated'),custom_menu_text=private.support_jsonb_text(p_settings,'customMenuText',false),validation_errors='[]'::jsonb,updated_by=p_actor_user_id where id=p_version_id;
  delete from public.support_routing_options where automation_version_id=p_version_id;
  for v_option in select value from jsonb_array_elements(p_options) loop
    v_order:=nullif(v_option->>'order','')::integer;if v_order is null or v_order<1 then raise exception 'Ordem de opção inválida.';end if;
    insert into public.support_routing_options(automation_version_id,display_order,title,description,status,category_id,queue_id,default_assignee_user_id,priority,response_template_id,form_id,action_type,action_settings)
    values(p_version_id,v_order,private.support_jsonb_text(v_option,'title',true),private.support_jsonb_text(v_option,'description',false),coalesce(private.support_jsonb_text(v_option,'status',false),'active'),nullif(v_option->>'categoryId','')::uuid,nullif(v_option->>'queueId','')::uuid,nullif(v_option->>'defaultAssigneeUserId','')::uuid,coalesce(private.support_jsonb_text(v_option,'priority',false),'normal'),nullif(v_option->>'templateId','')::uuid,nullif(v_option->>'formId','')::uuid,private.support_jsonb_text(v_option,'actionType',true),coalesce(v_option->'actionSettings','{}'::jsonb)) returning id into v_option_id;
    if jsonb_typeof(coalesce(v_option->'tagIds','[]'::jsonb))<>'array' then raise exception 'Tags da opção devem ser um array.';end if;
    for v_tag_id_text in select jsonb_array_elements_text(coalesce(v_option->'tagIds','[]'::jsonb)) loop insert into public.support_routing_option_tags(routing_option_id,tag_id) values(v_option_id,v_tag_id_text::uuid);end loop;
  end loop;
  return jsonb_build_object('version',(select to_jsonb(v) from public.support_automation_versions v where v.id=p_version_id),'options',(select coalesce(jsonb_agg(to_jsonb(o) order by o.display_order),'[]'::jsonb) from public.support_routing_options o where o.automation_version_id=p_version_id));
end$$;

create or replace function public.support_admin_publish_automation(p_version_id uuid,p_expected_version bigint,p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_version public.support_automation_versions%rowtype;v_validation jsonb;v_flow_id uuid;
begin
  select * into v_version from public.support_automation_versions where id=p_version_id for update;
  if not found then raise exception 'Rascunho não encontrado.';end if;
  if v_version.status<>'draft' then raise exception 'Somente rascunhos podem ser publicados.';end if;
  if v_version.version<>p_expected_version then raise exception 'CONFLICT: rascunho alterado por outro usuário.';end if;
  v_validation:=public.support_validate_automation_version(p_version_id);
  if not coalesce((v_validation->>'valid')::boolean,false) then update public.support_automation_versions set validation_errors=v_validation->'errors',updated_by=p_actor_user_id where id=p_version_id;return v_validation;end if;
  v_flow_id:=v_version.flow_id;
  update public.support_automation_versions set status='published',published_at=now(),published_by=p_actor_user_id,updated_by=p_actor_user_id,validation_errors='[]'::jsonb where id=p_version_id;
  update public.support_automation_flows set published_version_id=p_version_id,draft_version_id=null,updated_by=p_actor_user_id where id=v_flow_id;
  update public.support_product_settings s set automation_enabled=true,updated_by=p_actor_user_id from public.support_automation_flows f where f.id=v_flow_id and s.product_id=f.product_id;
  return jsonb_build_object('valid',true,'publishedVersionId',p_version_id);
end$$;

create or replace function public.support_admin_restore_automation_version(p_source_version_id uuid,p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_source public.support_automation_versions%rowtype;v_flow public.support_automation_flows%rowtype;v_draft_id uuid;v_next integer;v_option record;v_new_option uuid;
begin
  select * into v_source from public.support_automation_versions where id=p_source_version_id;if not found then raise exception 'Versão de origem não encontrada.';end if;
  select * into v_flow from public.support_automation_flows where id=v_source.flow_id for update;if v_flow.draft_version_id is not null then raise exception 'Já existe um rascunho ativo. Arquive ou publique antes de restaurar.';end if;
  select coalesce(max(version_number),0)+1 into v_next from public.support_automation_versions where flow_id=v_flow.id;
  insert into public.support_automation_versions(flow_id,version_number,status,welcome_message,invalid_option_message,inactivity_message,out_of_hours_message,human_handoff_message,closing_message,return_commands,invalid_attempt_limit,inactivity_minutes,inactivity_action,fallback_queue_id,language_code,timezone,menu_render_mode,custom_menu_text,created_by,updated_by)
  values(v_flow.id,v_next,'draft',v_source.welcome_message,v_source.invalid_option_message,v_source.inactivity_message,v_source.out_of_hours_message,v_source.human_handoff_message,v_source.closing_message,v_source.return_commands,v_source.invalid_attempt_limit,v_source.inactivity_minutes,v_source.inactivity_action,v_source.fallback_queue_id,v_source.language_code,v_source.timezone,v_source.menu_render_mode,v_source.custom_menu_text,p_actor_user_id,p_actor_user_id) returning id into v_draft_id;
  for v_option in select * from public.support_routing_options where automation_version_id=p_source_version_id order by display_order loop
    insert into public.support_routing_options(automation_version_id,display_order,title,description,status,category_id,queue_id,default_assignee_user_id,priority,response_template_id,form_id,action_type,action_settings)
    values(v_draft_id,v_option.display_order,v_option.title,v_option.description,v_option.status,v_option.category_id,v_option.queue_id,v_option.default_assignee_user_id,v_option.priority,v_option.response_template_id,v_option.form_id,v_option.action_type,v_option.action_settings) returning id into v_new_option;
    insert into public.support_routing_option_tags(routing_option_id,tag_id) select v_new_option,tag_id from public.support_routing_option_tags where routing_option_id=v_option.id;
  end loop;
  update public.support_automation_flows set draft_version_id=v_draft_id,updated_by=p_actor_user_id where id=v_flow.id;
  return jsonb_build_object('draftVersionId',v_draft_id,'versionNumber',v_next);
end$$;

revoke all on function public.support_admin_get_or_create_draft(uuid,uuid) from public,anon,authenticated;
revoke all on function public.support_validate_automation_version(uuid) from public,anon,authenticated;
revoke all on function public.support_admin_save_automation_draft(uuid,bigint,jsonb,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.support_admin_publish_automation(uuid,bigint,uuid) from public,anon,authenticated;
revoke all on function public.support_admin_restore_automation_version(uuid,uuid) from public,anon,authenticated;
grant execute on function public.support_admin_get_or_create_draft(uuid,uuid) to service_role;
grant execute on function public.support_validate_automation_version(uuid) to service_role;
grant execute on function public.support_admin_save_automation_draft(uuid,bigint,jsonb,jsonb,uuid) to service_role;
grant execute on function public.support_admin_publish_automation(uuid,bigint,uuid) to service_role;
grant execute on function public.support_admin_restore_automation_version(uuid,uuid) to service_role;
