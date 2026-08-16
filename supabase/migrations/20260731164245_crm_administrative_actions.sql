create or replace function public.admin_qualify_crm_lead(
  p_lead_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_lead public.crm_leads;
  v_unit_code text;
  v_party_id uuid;
  v_opportunity_id uuid:=gen_random_uuid();
  v_stage_id uuid;
  v_party_name text;
begin
  perform set_config('app.actor_user_id',p_actor_user_id::text,true);
  select * into v_lead from public.crm_leads where id=p_lead_id for update;
  if not found or v_lead.version<>p_expected_version then return null; end if;
  v_unit_code:=private.unit_code_for_id(v_lead.business_unit_id);
  if not private.user_has_permission(p_actor_user_id,'crm.convert',v_unit_code) then raise exception 'Permissão insuficiente para qualificar o lead.'; end if;
  if v_lead.status not in ('new','contacted','qualified') then raise exception 'Lead não pode ser convertido neste estado.'; end if;
  if (v_lead.product_id is null)=(v_lead.service_line_id is null) then raise exception 'Informe exatamente um produto ou serviço antes da qualificação.'; end if;

  v_party_id:=v_lead.converted_party_id;
  if v_party_id is null then
    v_party_name:=coalesce(nullif(btrim(v_lead.company_name),''),v_lead.contact_name);
    insert into public.parties(party_type,legal_name,trade_name,country_code,preferred_currency_code,primary_business_unit_id,status,notes)
    values(v_lead.lead_type,v_party_name,case when v_lead.company_name is not null then v_lead.company_name else null end,v_lead.country_code,v_lead.preferred_currency_code,v_lead.business_unit_id,'prospect',concat('Convertido do lead ',v_lead.id::text))
    returning id into v_party_id;
    insert into public.party_roles(party_id,role_code,business_unit_id,status,started_on,notes)
    values(v_party_id,'client',v_lead.business_unit_id,'active',current_date,'Criado pela qualificação do CRM');
  end if;

  select id into v_stage_id from public.crm_pipeline_stages where business_unit_id=v_lead.business_unit_id and code='QUALIFICATION' and status='active';
  if v_stage_id is null then raise exception 'Etapa de qualificação não configurada para a unidade.'; end if;

  insert into public.crm_opportunities(id,business_unit_id,lead_id,party_id,product_id,service_line_id,stage_id,owner_user_id,code,title,description,currency_code,estimated_amount,probability,expected_close_date,status,next_step,created_by)
  values(v_opportunity_id,v_lead.business_unit_id,v_lead.id,v_party_id,v_lead.product_id,v_lead.service_line_id,v_stage_id,v_lead.owner_user_id,
    'OPP_'||upper(substr(replace(v_opportunity_id::text,'-',''),1,16)),
    coalesce(nullif(btrim(v_lead.company_name),''),v_lead.contact_name)||' — oportunidade',v_lead.notes,v_lead.preferred_currency_code,v_lead.estimated_value,25,v_lead.expected_close_date,'open',v_lead.next_action,p_actor_user_id);

  update public.crm_leads set status='converted',converted_party_id=v_party_id where id=v_lead.id and version=p_expected_version;
  return jsonb_build_object('lead_id',v_lead.id,'party_id',v_party_id,'opportunity_id',v_opportunity_id);
end$$;

create or replace function public.admin_submit_crm_proposal(
  p_proposal_version_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_version public.crm_proposal_versions;
  v_proposal public.crm_proposals;
  v_unit_code text;
  v_items integer;
begin
  perform set_config('app.actor_user_id',p_actor_user_id::text,true);
  select * into v_version from public.crm_proposal_versions where id=p_proposal_version_id for update;
  if not found or v_version.version<>p_expected_version then return null; end if;
  select * into v_proposal from public.crm_proposals where id=v_version.proposal_id for update;
  v_unit_code:=private.unit_code_for_id(v_proposal.business_unit_id);
  if not private.user_has_permission(p_actor_user_id,'crm.proposals.manage',v_unit_code) then raise exception 'Permissão insuficiente para submeter proposta.'; end if;
  if v_version.status<>'draft' then raise exception 'Somente versão em rascunho pode ser submetida.'; end if;
  select count(*) into v_items from public.crm_proposal_items where proposal_version_id=v_version.id;
  if v_items=0 or v_version.total_amount<=0 then raise exception 'A proposta exige ao menos um item e valor total positivo.'; end if;
  if v_version.valid_until<current_date then raise exception 'A validade da proposta já expirou.'; end if;

  update public.crm_proposal_versions set status='pending_approval',requested_by=p_actor_user_id,requested_at=now(),decision_reason=null where id=v_version.id and version=p_expected_version returning * into v_version;
  update public.crm_proposals set status='in_review',current_version_id=v_version.id where id=v_proposal.id;
  return to_jsonb(v_version);
end$$;

create or replace function public.admin_decide_crm_proposal(
  p_proposal_version_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid,
  p_approve boolean,
  p_reason text default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_version public.crm_proposal_versions;
  v_proposal public.crm_proposals;
  v_unit_code text;
begin
  perform set_config('app.actor_user_id',p_actor_user_id::text,true);
  select * into v_version from public.crm_proposal_versions where id=p_proposal_version_id for update;
  if not found or v_version.version<>p_expected_version then return null; end if;
  select * into v_proposal from public.crm_proposals where id=v_version.proposal_id for update;
  v_unit_code:=private.unit_code_for_id(v_proposal.business_unit_id);
  if not private.user_has_permission(p_actor_user_id,'crm.proposals.approve',v_unit_code) then raise exception 'Permissão insuficiente para decidir proposta.'; end if;
  if v_version.status<>'pending_approval' then raise exception 'A proposta não está aguardando aprovação.'; end if;
  if v_version.created_by=p_actor_user_id or v_version.requested_by=p_actor_user_id then raise exception 'O criador ou solicitante não pode aprovar a própria proposta.'; end if;
  if not p_approve and nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'Informe o motivo da rejeição.'; end if;

  if p_approve then
    update public.crm_proposal_versions set status='superseded' where proposal_id=v_proposal.id and status='approved' and id<>v_version.id;
    update public.crm_proposal_versions set status='approved',approved_by=p_actor_user_id,approved_at=now(),decision_reason=p_reason where id=v_version.id and version=p_expected_version returning * into v_version;
    update public.crm_proposals set status='approved',current_version_id=v_version.id where id=v_proposal.id;
  else
    update public.crm_proposal_versions set status='rejected',approved_by=p_actor_user_id,approved_at=now(),decision_reason=p_reason where id=v_version.id and version=p_expected_version returning * into v_version;
    update public.crm_proposals set status='draft' where id=v_proposal.id;
  end if;
  return to_jsonb(v_version);
end$$;

create or replace function public.admin_send_crm_proposal(
  p_proposal_version_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_version public.crm_proposal_versions;
  v_proposal public.crm_proposals;
  v_opportunity public.crm_opportunities;
  v_stage_id uuid;
  v_unit_code text;
begin
  perform set_config('app.actor_user_id',p_actor_user_id::text,true);
  select * into v_version from public.crm_proposal_versions where id=p_proposal_version_id for update;
  if not found or v_version.version<>p_expected_version then return null; end if;
  select * into v_proposal from public.crm_proposals where id=v_version.proposal_id for update;
  select * into v_opportunity from public.crm_opportunities where id=v_proposal.opportunity_id for update;
  v_unit_code:=private.unit_code_for_id(v_proposal.business_unit_id);
  if not private.user_has_permission(p_actor_user_id,'crm.proposals.manage',v_unit_code) then raise exception 'Permissão insuficiente para enviar proposta.'; end if;
  if v_version.status<>'approved' then raise exception 'Somente proposta aprovada pode ser enviada.'; end if;
  if v_version.valid_until<current_date then raise exception 'A proposta está vencida.'; end if;
  select id into v_stage_id from public.crm_pipeline_stages where business_unit_id=v_proposal.business_unit_id and code='PROPOSAL' and status='active';
  update public.crm_proposal_versions set status='sent',sent_at=now() where id=v_version.id and version=p_expected_version returning * into v_version;
  update public.crm_proposals set status='sent',current_version_id=v_version.id where id=v_proposal.id;
  update public.crm_opportunities set stage_id=coalesce(v_stage_id,stage_id),probability=greatest(probability,50),next_step='Acompanhar retorno da proposta' where id=v_opportunity.id and status='open';
  return to_jsonb(v_version);
end$$;

create or replace function public.admin_resolve_crm_proposal(
  p_proposal_version_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid,
  p_accept boolean,
  p_reason text default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_version public.crm_proposal_versions;
  v_proposal public.crm_proposals;
  v_opportunity public.crm_opportunities;
  v_stage_id uuid;
  v_unit_code text;
begin
  perform set_config('app.actor_user_id',p_actor_user_id::text,true);
  select * into v_version from public.crm_proposal_versions where id=p_proposal_version_id for update;
  if not found or v_version.version<>p_expected_version then return null; end if;
  select * into v_proposal from public.crm_proposals where id=v_version.proposal_id for update;
  select * into v_opportunity from public.crm_opportunities where id=v_proposal.opportunity_id for update;
  v_unit_code:=private.unit_code_for_id(v_proposal.business_unit_id);
  if not private.user_has_permission(p_actor_user_id,'crm.convert',v_unit_code) then raise exception 'Permissão insuficiente para concluir proposta.'; end if;
  if v_version.status<>'sent' then raise exception 'Somente proposta enviada pode ser concluída.'; end if;
  if not p_accept and nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'Informe o motivo da rejeição.'; end if;

  if p_accept then
    select id into v_stage_id from public.crm_pipeline_stages where business_unit_id=v_proposal.business_unit_id and code='WON' and status='active';
    update public.crm_proposal_versions set status='accepted',accepted_at=now(),decision_reason=p_reason where id=v_version.id and version=p_expected_version returning * into v_version;
    update public.crm_proposals set status='accepted',current_version_id=v_version.id where id=v_proposal.id;
    update public.crm_opportunities set status='won',stage_id=coalesce(v_stage_id,stage_id),probability=100,estimated_amount=v_version.total_amount,won_at=now(),next_step='Converter oportunidade em projeto' where id=v_opportunity.id;
  else
    select id into v_stage_id from public.crm_pipeline_stages where business_unit_id=v_proposal.business_unit_id and code='LOST' and status='active';
    update public.crm_proposal_versions set status='rejected',decision_reason=p_reason where id=v_version.id and version=p_expected_version returning * into v_version;
    update public.crm_proposals set status='rejected' where id=v_proposal.id;
    update public.crm_opportunities set status='lost',stage_id=coalesce(v_stage_id,stage_id),probability=0,lost_at=now(),loss_reason=p_reason,next_step=null,next_step_at=null where id=v_opportunity.id;
  end if;
  return to_jsonb(v_version);
end$$;

create or replace function public.admin_close_crm_opportunity_lost(
  p_opportunity_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid,
  p_reason text
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_opportunity public.crm_opportunities;
  v_stage_id uuid;
  v_unit_code text;
begin
  perform set_config('app.actor_user_id',p_actor_user_id::text,true);
  select * into v_opportunity from public.crm_opportunities where id=p_opportunity_id for update;
  if not found or v_opportunity.version<>p_expected_version then return null; end if;
  v_unit_code:=private.unit_code_for_id(v_opportunity.business_unit_id);
  if not private.user_has_permission(p_actor_user_id,'crm.opportunities.manage',v_unit_code) then raise exception 'Permissão insuficiente para encerrar oportunidade.'; end if;
  if v_opportunity.status<>'open' then raise exception 'Somente oportunidade aberta pode ser perdida.'; end if;
  if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'Informe o motivo da perda.'; end if;
  select id into v_stage_id from public.crm_pipeline_stages where business_unit_id=v_opportunity.business_unit_id and code='LOST' and status='active';
  update public.crm_opportunities set status='lost',stage_id=coalesce(v_stage_id,stage_id),probability=0,lost_at=now(),loss_reason=p_reason,next_step=null,next_step_at=null where id=v_opportunity.id and version=p_expected_version returning * into v_opportunity;
  return to_jsonb(v_opportunity);
end$$;

create or replace function public.admin_convert_crm_opportunity_to_project(
  p_opportunity_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_opportunity public.crm_opportunities;
  v_proposal public.crm_proposals;
  v_version public.crm_proposal_versions;
  v_project_id uuid:=gen_random_uuid();
  v_profile_id uuid;
  v_unit_code text;
  v_seq integer:=0;
  v_item record;
begin
  perform set_config('app.actor_user_id',p_actor_user_id::text,true);
  select * into v_opportunity from public.crm_opportunities where id=p_opportunity_id for update;
  if not found or v_opportunity.version<>p_expected_version then return null; end if;
  v_unit_code:=private.unit_code_for_id(v_opportunity.business_unit_id);
  if not private.user_has_permission(p_actor_user_id,'crm.convert',v_unit_code) then raise exception 'Permissão insuficiente para converter oportunidade.'; end if;
  if v_opportunity.status<>'won' then raise exception 'Somente oportunidade ganha pode virar projeto.'; end if;
  if exists(select 1 from public.crm_project_profiles where opportunity_id=v_opportunity.id) then raise exception 'A oportunidade já foi convertida em projeto.'; end if;

  select p.* into v_proposal from public.crm_proposals p where p.opportunity_id=v_opportunity.id and p.status='accepted' order by p.updated_at desc limit 1;
  if not found or v_proposal.current_version_id is null then raise exception 'Oportunidade exige proposta aceita.'; end if;
  select * into v_version from public.crm_proposal_versions where id=v_proposal.current_version_id and status='accepted';
  if not found then raise exception 'Versão aceita da proposta não encontrada.'; end if;

  insert into public.projects(id,business_unit_id,product_id,service_line_id,code,name,description,responsible_user_id,status,start_date)
  values(v_project_id,v_opportunity.business_unit_id,v_opportunity.product_id,v_opportunity.service_line_id,
    'PRJ_'||upper(substr(replace(v_project_id::text,'-',''),1,16)),v_opportunity.title,v_opportunity.description,v_opportunity.owner_user_id,'planned',current_date);

  insert into public.crm_project_profiles(project_id,opportunity_id,proposal_id,proposal_version_id,party_id,currency_code,contracted_revenue,planned_cost,status,created_by)
  values(v_project_id,v_opportunity.id,v_proposal.id,v_version.id,v_opportunity.party_id,v_version.currency_code,v_version.total_amount,v_version.estimated_cost,'planned',p_actor_user_id)
  returning id into v_profile_id;

  for v_item in select * from public.crm_proposal_items where proposal_version_id=v_version.id order by sequence_no loop
    v_seq:=v_seq+1;
    insert into public.crm_project_scope_items(project_profile_id,proposal_item_id,sequence_no,scope_type,title,description,planned_hours,planned_revenue,planned_cost,status)
    values(v_profile_id,v_item.id,v_seq,case when v_item.item_type='milestone' then 'milestone' else 'deliverable' end,left(v_item.description,200),v_item.description,v_item.planned_hours,v_item.line_total,v_item.line_cost,'planned');
  end loop;

  update public.crm_opportunities set next_step='Projeto criado',next_step_at=null where id=v_opportunity.id;
  return jsonb_build_object('opportunity_id',v_opportunity.id,'project_id',v_project_id,'project_profile_id',v_profile_id);
end$$;

revoke all on function public.admin_qualify_crm_lead(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.admin_submit_crm_proposal(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.admin_decide_crm_proposal(uuid,integer,uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.admin_send_crm_proposal(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.admin_resolve_crm_proposal(uuid,integer,uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.admin_close_crm_opportunity_lost(uuid,integer,uuid,text) from public,anon,authenticated;
revoke all on function public.admin_convert_crm_opportunity_to_project(uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.admin_qualify_crm_lead(uuid,integer,uuid),public.admin_submit_crm_proposal(uuid,integer,uuid),public.admin_decide_crm_proposal(uuid,integer,uuid,boolean,text),public.admin_send_crm_proposal(uuid,integer,uuid),public.admin_resolve_crm_proposal(uuid,integer,uuid,boolean,text),public.admin_close_crm_opportunity_lost(uuid,integer,uuid,text),public.admin_convert_crm_opportunity_to_project(uuid,integer,uuid) to service_role;