revoke all privileges on table public.saas_plans from authenticated, service_role;
revoke all privileges on table public.saas_plan_entitlements from authenticated, service_role;
revoke all privileges on table public.saas_subscriptions from authenticated, service_role;
revoke all privileges on table public.saas_subscription_entitlements from authenticated, service_role;
revoke all privileges on table public.saas_usage_records from authenticated, service_role;
revoke all privileges on table public.saas_billing_cycles from authenticated, service_role;
revoke all privileges on table public.saas_subscription_events from authenticated, service_role;

grant select, insert, update, delete on table public.saas_plans to authenticated, service_role;
grant select, insert, update, delete on table public.saas_plan_entitlements to authenticated, service_role;
grant select, insert, update, delete on table public.saas_subscriptions to authenticated, service_role;
grant select, insert, update, delete on table public.saas_subscription_entitlements to authenticated, service_role;
grant select, insert, update, delete on table public.saas_usage_records to authenticated, service_role;
grant select, insert, update, delete on table public.saas_billing_cycles to authenticated, service_role;
grant select on table public.saas_subscription_events to authenticated;
grant select, insert on table public.saas_subscription_events to service_role;

revoke all privileges on sequence public.saas_subscription_events_id_seq from anon, authenticated, service_role;
grant usage, select on sequence public.saas_subscription_events_id_seq to service_role;
