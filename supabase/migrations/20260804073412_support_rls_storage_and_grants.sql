do $$ declare v_table text;begin
  foreach v_table in array array[
    'support_product_settings','support_product_members','support_business_hours','support_business_hour_intervals','support_holidays','support_sla_policies','support_queues','support_queue_members','support_categories','support_tags','support_channels','support_message_templates','support_forms','support_form_fields','support_automation_flows','support_automation_versions','support_routing_options','support_routing_option_tags','support_external_identities','support_conversations','support_messages','support_tickets','support_ticket_tags','support_ticket_events','support_assignments','support_escalation_rules','support_notifications','support_webhook_events','support_outbox'
  ] loop
    execute format('alter table public.%I enable row level security',v_table);
    execute format('revoke all on public.%I from anon',v_table);
    execute format('grant select on public.%I to authenticated',v_table);
    execute format('grant select,insert,update,delete on public.%I to service_role',v_table);
  end loop;
end $$;

do $$ declare v_table text;begin
  foreach v_table in array array[
    'support_product_settings','support_product_members','support_sla_policies','support_categories','support_tags','support_channels','support_message_templates','support_forms','support_automation_flows','support_external_identities','support_conversations','support_messages','support_tickets','support_ticket_events','support_assignments','support_escalation_rules','support_notifications','support_outbox'
  ] loop
    execute format('create policy support_read_authorized on public.%I for select to authenticated using(product_id is not null and private.current_user_has_permission(''support.read'',private.support_product_unit_code(product_id)))',v_table);
  end loop;
end $$;

create policy support_read_authorized on public.support_webhook_events for select to authenticated using(product_id is not null and private.current_user_has_permission('support.audit.read',private.support_product_unit_code(product_id)));
create policy support_read_authorized on public.support_queues for select to authenticated using(private.current_user_has_permission('support.read',case when product_id is null then null else private.support_product_unit_code(product_id) end));
create policy support_read_authorized on public.support_business_hours for select to authenticated using(private.current_user_has_permission('support.read',case when product_id is null then null else private.support_product_unit_code(product_id) end));
create policy support_read_authorized on public.support_business_hour_intervals for select to authenticated using(exists(select 1 from public.support_business_hours h where h.id=business_hours_id and private.current_user_has_permission('support.read',case when h.product_id is null then null else private.support_product_unit_code(h.product_id) end)));
create policy support_read_authorized on public.support_holidays for select to authenticated using(exists(select 1 from public.support_business_hours h where h.id=business_hours_id and private.current_user_has_permission('support.read',case when h.product_id is null then null else private.support_product_unit_code(h.product_id) end)));
create policy support_read_authorized on public.support_queue_members for select to authenticated using(exists(select 1 from public.support_queues q where q.id=queue_id and private.current_user_has_permission('support.read',case when q.product_id is null then null else private.support_product_unit_code(q.product_id) end)));
create policy support_read_authorized on public.support_form_fields for select to authenticated using(exists(select 1 from public.support_forms f where f.id=form_id and private.current_user_has_permission('support.read',private.support_product_unit_code(f.product_id))));
create policy support_read_authorized on public.support_automation_versions for select to authenticated using(exists(select 1 from public.support_automation_flows f where f.id=flow_id and private.current_user_has_permission('support.read',private.support_product_unit_code(f.product_id))));
create policy support_read_authorized on public.support_routing_options for select to authenticated using(exists(select 1 from public.support_automation_versions v join public.support_automation_flows f on f.id=v.flow_id where v.id=automation_version_id and private.current_user_has_permission('support.read',private.support_product_unit_code(f.product_id))));
create policy support_read_authorized on public.support_routing_option_tags for select to authenticated using(exists(select 1 from public.support_routing_options o join public.support_automation_versions v on v.id=o.automation_version_id join public.support_automation_flows f on f.id=v.flow_id where o.id=routing_option_id and private.current_user_has_permission('support.read',private.support_product_unit_code(f.product_id))));
create policy support_read_authorized on public.support_ticket_tags for select to authenticated using(exists(select 1 from public.support_tickets t where t.id=ticket_id and private.current_user_has_permission('support.read',private.support_product_unit_code(t.product_id))));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('support-attachments','support-attachments',false,26214400,array['application/pdf','image/jpeg','image/png','image/webp','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

revoke all on sequence public.support_ticket_number_seq from anon,authenticated;
grant usage,select on sequence public.support_ticket_number_seq to service_role;
grant usage on schema private to authenticated,service_role;
revoke all on function private.support_product_legal_entity_id(uuid) from public;
revoke all on function private.support_assert_product_scope(uuid,uuid) from public;
revoke all on function private.support_product_unit_code(uuid) from public;
grant execute on function private.support_product_unit_code(uuid) to authenticated,service_role;
revoke all on function private.support_user_is_eligible(uuid,uuid,uuid) from public;
grant execute on function private.support_user_is_eligible(uuid,uuid,uuid) to service_role;

do $$ begin perform pg_notify('pgrst','reload schema');end $$;
