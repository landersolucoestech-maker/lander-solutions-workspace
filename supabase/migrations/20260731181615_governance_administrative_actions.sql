insert into public.permissions(code,module,action,description) values
('assets.approve','assets','approve','Aprovar eventos patrimoniais'),
('assets.apply','assets','apply','Aplicar eventos patrimoniais aprovados'),
('ip.approve','legal','ip_approve','Aprovar eventos de propriedade intelectual'),
('compliance.approve','compliance','approve','Dispensar ocorrências de compliance'),
('policies.manage','policies','manage','Criar e editar políticas corporativas'),
('policies.approve','policies','approve','Aprovar versões de políticas'),
('policies.publish','policies','publish','Publicar versões aprovadas de políticas')
on conflict(code) do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.app_roles r cross join public.permissions p
where r.code in ('owner','corporate_admin','legal_manager','compliance_manager','asset_manager')
and p.code in ('assets.approve','assets.apply','ip.approve','compliance.approve','policies.manage','policies.approve','policies.publish')
on conflict do nothing;

create or replace function public.admin_submit_asset_event(p_event_id uuid,p_expected_version integer,p_actor_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.asset_events;v_unit text;begin
 select * into v from public.asset_events where id=p_event_id for update;
 if not found or v.version<>p_expected_version then return null; end if;
 select private.governance_unit_code(a.business_unit_id) into v_unit from public.corporate_assets a where a.id=v.asset_id;
 if not private.user_has_permission(p_actor_user_id,'assets.manage',v_unit) then raise exception 'Permissão insuficiente.'; end if;
 if v.status<>'draft' then raise exception 'Somente evento em rascunho pode ser submetido.'; end if;
 update public.asset_events set status='pending_approval',requested_by=p_actor_user_id where id=v.id and version=p_expected_version returning * into v;
 return to_jsonb(v);
end$$;

create or replace function public.admin_decide_asset_event(p_event_id uuid,p_expected_version integer,p_actor_user_id uuid,p_approve boolean,p_reason text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.asset_events;v_unit text;begin
 select * into v from public.asset_events where id=p_event_id for update;
 if not found or v.version<>p_expected_version then return null; end if;
 select private.governance_unit_code(a.business_unit_id) into v_unit from public.corporate_assets a where a.id=v.asset_id;
 if not private.user_has_permission(p_actor_user_id,'assets.approve',v_unit) then raise exception 'Permissão insuficiente.'; end if;
 if v.status<>'pending_approval' then raise exception 'Evento não está aguardando aprovação.'; end if;
 if v.requested_by=p_actor_user_id or v.created_by=p_actor_user_id then raise exception 'Autoaprovação não permitida.'; end if;
 update public.asset_events set status=case when p_approve then 'approved' else 'rejected' end,approved_by=p_actor_user_id,decision_reason=p_reason where id=v.id and version=p_expected_version returning * into v;
 return to_jsonb(v);
end$$;

create or replace function public.admin_apply_asset_event(p_event_id uuid,p_expected_version integer,p_actor_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.asset_events;v_asset public.corporate_assets;v_unit text;begin
 select * into v from public.asset_events where id=p_event_id for update;
 if not found or v.version<>p_expected_version then return null; end if;
 select * into v_asset from public.corporate_assets where id=v.asset_id for update;
 v_unit:=private.governance_unit_code(v_asset.business_unit_id);
 if not private.user_has_permission(p_actor_user_id,'assets.apply',v_unit) then raise exception 'Permissão insuficiente.'; end if;
 if v.status<>'approved' then raise exception 'Somente evento aprovado pode ser aplicado.'; end if;
 if v.event_type='transfer' then update public.corporate_assets set business_unit_id=coalesce(v.to_business_unit_id,business_unit_id),custodian_user_id=coalesce(v.to_custodian_user_id,custodian_user_id),location=coalesce(v.to_location,location) where id=v.asset_id;
 elsif v.event_type='maintenance' then update public.corporate_assets set status='maintenance' where id=v.asset_id;
 elsif v.event_type='return_to_service' then update public.corporate_assets set status='active' where id=v.asset_id;
 elsif v.event_type='disposal' then update public.corporate_assets set status='disposed',disposal_date=v.occurred_on,current_value=coalesce(v.amount,current_value) where id=v.asset_id;
 elsif v.event_type='loss' then update public.corporate_assets set status='lost',current_value=0 where id=v.asset_id;
 elsif v.event_type='renewal' then update public.corporate_assets set renewal_date=v.occurred_on where id=v.asset_id;
 end if;
 update public.asset_events set status='applied',applied_by=p_actor_user_id where id=v.id and version=p_expected_version returning * into v;
 return to_jsonb(v);
end$$;

create or replace function public.admin_apply_ip_event(p_event_id uuid,p_expected_version integer,p_actor_user_id uuid,p_accept boolean,p_reason text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.intellectual_property_events;v_asset public.intellectual_property_assets;v_unit text;begin
 select * into v from public.intellectual_property_events where id=p_event_id for update;
 if not found or v.version<>p_expected_version then return null; end if;
 select * into v_asset from public.intellectual_property_assets where id=v.intellectual_property_id for update;
 v_unit:=private.governance_unit_code(v_asset.business_unit_id);
 if not private.user_has_permission(p_actor_user_id,'ip.approve',v_unit) then raise exception 'Permissão insuficiente.'; end if;
 if v.event_status not in ('planned','pending') then raise exception 'Evento de PI já foi decidido.'; end if;
 update public.intellectual_property_events set event_status=case when p_accept then 'accepted' else 'rejected' end,reason=coalesce(p_reason,reason) where id=v.id and version=p_expected_version returning * into v;
 if p_accept then
   if v.event_type in ('registration','grant') then update public.intellectual_property_assets set status='registered',registration_date=coalesce(v.occurred_on,registration_date),registration_number=coalesce(v.protocol,registration_number) where id=v.intellectual_property_id;
   elsif v.event_type='renewal' then update public.intellectual_property_assets set renewal_due_on=v.due_date,status='active' where id=v.intellectual_property_id;
   elsif v.event_type in ('rejection','cancellation','expiration') then update public.intellectual_property_assets set status=case when v.event_type='expiration' then 'expired' else 'cancelled' end where id=v.intellectual_property_id;
   end if;
 end if;
 return to_jsonb(v);
end$$;

create or replace function public.admin_complete_compliance_occurrence(p_occurrence_id uuid,p_expected_version integer,p_actor_user_id uuid,p_evidence_reference text default null,p_notes text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.compliance_occurrences;v_ob public.compliance_obligations;v_unit text;begin
 select * into v from public.compliance_occurrences where id=p_occurrence_id for update;
 if not found or v.version<>p_expected_version then return null; end if;
 select * into v_ob from public.compliance_obligations where id=v.compliance_obligation_id;
 v_unit:=private.governance_unit_code(v_ob.business_unit_id);
 if not private.user_has_permission(p_actor_user_id,'compliance.manage',v_unit) then raise exception 'Permissão insuficiente.'; end if;
 if v.status not in ('pending','in_progress','overdue') then raise exception 'Ocorrência não pode ser concluída.'; end if;
 if v_ob.evidence_required and coalesce(nullif(btrim(p_evidence_reference),''),v.evidence_reference) is null then raise exception 'Evidência obrigatória.'; end if;
 update public.compliance_occurrences set status='completed',evidence_reference=coalesce(nullif(btrim(p_evidence_reference),''),evidence_reference),notes=coalesce(nullif(btrim(p_notes),''),notes) where id=v.id and version=p_expected_version returning * into v;
 return to_jsonb(v);
end$$;

create or replace function public.admin_waive_compliance_occurrence(p_occurrence_id uuid,p_expected_version integer,p_actor_user_id uuid,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.compliance_occurrences;v_unit text;begin
 select * into v from public.compliance_occurrences where id=p_occurrence_id for update;
 if not found or v.version<>p_expected_version then return null; end if;
 select private.governance_unit_code(o.business_unit_id) into v_unit from public.compliance_obligations o where o.id=v.compliance_obligation_id;
 if not private.user_has_permission(p_actor_user_id,'compliance.approve',v_unit) then raise exception 'Permissão insuficiente.'; end if;
 if btrim(coalesce(p_reason,''))='' then raise exception 'Motivo obrigatório.'; end if;
 update public.compliance_occurrences set status='waived',waiver_reason=p_reason where id=v.id and version=p_expected_version returning * into v;
 return to_jsonb(v);
end$$;

create or replace function public.admin_submit_policy_version(p_version_id uuid,p_expected_version integer,p_actor_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.corporate_policy_versions;v_unit text;begin
 select * into v from public.corporate_policy_versions where id=p_version_id for update;
 if not found or v.version<>p_expected_version then return null; end if;
 select private.governance_unit_code(p.business_unit_id) into v_unit from public.corporate_policies p where p.id=v.policy_id;
 if not private.user_has_permission(p_actor_user_id,'policies.manage',v_unit) then raise exception 'Permissão insuficiente.'; end if;
 if v.status<>'draft' then raise exception 'Somente versão em rascunho pode ser submetida.'; end if;
 update public.corporate_policy_versions set status='pending_approval',requested_by=p_actor_user_id where id=v.id and version=p_expected_version returning * into v;
 return to_jsonb(v);
end$$;

create or replace function public.admin_decide_policy_version(p_version_id uuid,p_expected_version integer,p_actor_user_id uuid,p_approve boolean,p_reason text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.corporate_policy_versions;v_unit text;begin
 select * into v from public.corporate_policy_versions where id=p_version_id for update;
 if not found or v.version<>p_expected_version then return null; end if;
 select private.governance_unit_code(p.business_unit_id) into v_unit from public.corporate_policies p where p.id=v.policy_id;
 if not private.user_has_permission(p_actor_user_id,'policies.approve',v_unit) then raise exception 'Permissão insuficiente.'; end if;
 if v.status<>'pending_approval' then raise exception 'Versão não está aguardando aprovação.'; end if;
 if v.requested_by=p_actor_user_id or v.created_by=p_actor_user_id then raise exception 'Autoaprovação não permitida.'; end if;
 update public.corporate_policy_versions set status=case when p_approve then 'approved' else 'rejected' end,approved_by=p_actor_user_id,decision_reason=p_reason where id=v.id and version=p_expected_version returning * into v;
 return to_jsonb(v);
end$$;

create or replace function public.admin_publish_policy_version(p_version_id uuid,p_expected_version integer,p_actor_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.corporate_policy_versions;v_unit text;begin
 select * into v from public.corporate_policy_versions where id=p_version_id for update;
 if not found or v.version<>p_expected_version then return null; end if;
 select private.governance_unit_code(p.business_unit_id) into v_unit from public.corporate_policies p where p.id=v.policy_id;
 if not private.user_has_permission(p_actor_user_id,'policies.publish',v_unit) then raise exception 'Permissão insuficiente.'; end if;
 if v.status<>'approved' then raise exception 'Somente versão aprovada pode ser publicada.'; end if;
 update public.corporate_policy_versions set status='published',published_by=p_actor_user_id where id=v.id and version=p_expected_version returning * into v;
 update public.corporate_policy_versions set status='superseded' where policy_id=v.policy_id and id<>v.id and status='published';
 update public.corporate_policies set current_version_id=v.id,status='active' where id=v.policy_id;
 return to_jsonb(v);
end$$;

create or replace function public.admin_close_legal_matter(p_matter_id uuid,p_expected_version integer,p_actor_user_id uuid,p_outcome text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.legal_matters;v_unit text;begin
 select * into v from public.legal_matters where id=p_matter_id for update;
 if not found or v.version<>p_expected_version then return null; end if;
 v_unit:=private.governance_unit_code(v.business_unit_id);
 if not private.user_has_permission(p_actor_user_id,'legal.manage',v_unit) then raise exception 'Permissão insuficiente.'; end if;
 if v.status in ('closed','cancelled') then raise exception 'Processo já encerrado.'; end if;
 if btrim(coalesce(p_outcome,''))='' then raise exception 'Resultado obrigatório.'; end if;
 update public.legal_matters set status='closed',closed_on=current_date,outcome=p_outcome where id=v.id and version=p_expected_version returning * into v;
 return to_jsonb(v);
end$$;

revoke all on function public.admin_submit_asset_event(uuid,integer,uuid),public.admin_decide_asset_event(uuid,integer,uuid,boolean,text),public.admin_apply_asset_event(uuid,integer,uuid),public.admin_apply_ip_event(uuid,integer,uuid,boolean,text),public.admin_complete_compliance_occurrence(uuid,integer,uuid,text,text),public.admin_waive_compliance_occurrence(uuid,integer,uuid,text),public.admin_submit_policy_version(uuid,integer,uuid),public.admin_decide_policy_version(uuid,integer,uuid,boolean,text),public.admin_publish_policy_version(uuid,integer,uuid),public.admin_close_legal_matter(uuid,integer,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_submit_asset_event(uuid,integer,uuid),public.admin_decide_asset_event(uuid,integer,uuid,boolean,text),public.admin_apply_asset_event(uuid,integer,uuid),public.admin_apply_ip_event(uuid,integer,uuid,boolean,text),public.admin_complete_compliance_occurrence(uuid,integer,uuid,text,text),public.admin_waive_compliance_occurrence(uuid,integer,uuid,text),public.admin_submit_policy_version(uuid,integer,uuid),public.admin_decide_policy_version(uuid,integer,uuid,boolean,text),public.admin_publish_policy_version(uuid,integer,uuid),public.admin_close_legal_matter(uuid,integer,uuid,text) to service_role;
