do $$ declare v_table text;begin
  foreach v_table in array array['support_product_settings','support_product_members','support_business_hours','support_business_hour_intervals','support_holidays','support_sla_policies','support_queues','support_queue_members','support_categories','support_tags','support_channels','support_message_templates','support_forms','support_form_fields','support_automation_flows','support_automation_versions','support_routing_options','support_routing_option_tags','support_external_identities','support_conversations','support_messages','support_tickets','support_ticket_tags','support_ticket_events','support_assignments','support_escalation_rules','support_notifications','support_webhook_events','support_outbox'] loop
    execute format('revoke insert,update,delete,truncate,references,trigger on public.%I from authenticated',v_table);
    execute format('grant select on public.%I to authenticated',v_table);
  end loop;
end $$;
