drop policy if exists integration_connections_manage on public.integration_connections;
create policy integration_connections_insert on public.integration_connections
for insert to authenticated
with check (status = 'draft' and public.has_permission('integrations.manage', null));
create policy integration_connections_update on public.integration_connections
for update to authenticated
using (status = 'draft' and public.has_permission('integrations.manage', null))
with check (status = 'draft' and public.has_permission('integrations.manage', null));
create policy integration_connections_delete on public.integration_connections
for delete to authenticated
using (status = 'draft' and public.has_permission('integrations.manage', null));

drop policy if exists integration_webhooks_manage on public.integration_webhook_endpoints;
create policy integration_webhooks_insert on public.integration_webhook_endpoints
for insert to authenticated
with check (status = 'draft' and public.has_permission('integrations.manage', null));
create policy integration_webhooks_update on public.integration_webhook_endpoints
for update to authenticated
using (status = 'draft' and public.has_permission('integrations.manage', null))
with check (status = 'draft' and public.has_permission('integrations.manage', null));
create policy integration_webhooks_delete on public.integration_webhook_endpoints
for delete to authenticated
using (status = 'draft' and public.has_permission('integrations.manage', null));

drop policy if exists saas_plans_manage on public.saas_plans;
create policy saas_plans_insert on public.saas_plans
for insert to authenticated
with check (exists(select 1 from public.business_units bu where bu.id = business_unit_id and public.has_permission('saas.plans.manage', bu.code)));
create policy saas_plans_update on public.saas_plans
for update to authenticated
using (exists(select 1 from public.business_units bu where bu.id = business_unit_id and public.has_permission('saas.plans.manage', bu.code)))
with check (exists(select 1 from public.business_units bu where bu.id = business_unit_id and public.has_permission('saas.plans.manage', bu.code)));
create policy saas_plans_delete on public.saas_plans
for delete to authenticated
using (exists(select 1 from public.business_units bu where bu.id = business_unit_id and public.has_permission('saas.plans.manage', bu.code)));

drop policy if exists saas_plan_entitlements_manage on public.saas_plan_entitlements;
create policy saas_plan_entitlements_insert on public.saas_plan_entitlements
for insert to authenticated
with check (exists(select 1 from public.saas_plans sp join public.business_units bu on bu.id = sp.business_unit_id where sp.id = plan_id and public.has_permission('saas.plans.manage', bu.code)));
create policy saas_plan_entitlements_update on public.saas_plan_entitlements
for update to authenticated
using (exists(select 1 from public.saas_plans sp join public.business_units bu on bu.id = sp.business_unit_id where sp.id = plan_id and public.has_permission('saas.plans.manage', bu.code)))
with check (exists(select 1 from public.saas_plans sp join public.business_units bu on bu.id = sp.business_unit_id where sp.id = plan_id and public.has_permission('saas.plans.manage', bu.code)));
create policy saas_plan_entitlements_delete on public.saas_plan_entitlements
for delete to authenticated
using (exists(select 1 from public.saas_plans sp join public.business_units bu on bu.id = sp.business_unit_id where sp.id = plan_id and public.has_permission('saas.plans.manage', bu.code)));

drop policy if exists saas_subscriptions_manage on public.saas_subscriptions;
create policy saas_subscriptions_insert on public.saas_subscriptions
for insert to authenticated
with check (status = 'draft' and exists(select 1 from public.business_units bu where bu.id = business_unit_id and public.has_permission('saas.subscriptions.manage', bu.code)));
create policy saas_subscriptions_update on public.saas_subscriptions
for update to authenticated
using (status = 'draft' and exists(select 1 from public.business_units bu where bu.id = business_unit_id and public.has_permission('saas.subscriptions.manage', bu.code)))
with check (status = 'draft' and exists(select 1 from public.business_units bu where bu.id = business_unit_id and public.has_permission('saas.subscriptions.manage', bu.code)));
create policy saas_subscriptions_delete on public.saas_subscriptions
for delete to authenticated
using (status = 'draft' and exists(select 1 from public.business_units bu where bu.id = business_unit_id and public.has_permission('saas.subscriptions.manage', bu.code)));

drop policy if exists saas_subscription_entitlements_manage on public.saas_subscription_entitlements;
create policy saas_subscription_entitlements_insert on public.saas_subscription_entitlements
for insert to authenticated
with check (exists(select 1 from public.saas_subscriptions ss join public.business_units bu on bu.id = ss.business_unit_id where ss.id = subscription_id and ss.status in ('draft','trialing','active') and public.has_permission('saas.subscriptions.manage', bu.code)));
create policy saas_subscription_entitlements_update on public.saas_subscription_entitlements
for update to authenticated
using (exists(select 1 from public.saas_subscriptions ss join public.business_units bu on bu.id = ss.business_unit_id where ss.id = subscription_id and ss.status in ('draft','trialing','active') and public.has_permission('saas.subscriptions.manage', bu.code)))
with check (exists(select 1 from public.saas_subscriptions ss join public.business_units bu on bu.id = ss.business_unit_id where ss.id = subscription_id and ss.status in ('draft','trialing','active') and public.has_permission('saas.subscriptions.manage', bu.code)));
create policy saas_subscription_entitlements_delete on public.saas_subscription_entitlements
for delete to authenticated
using (exists(select 1 from public.saas_subscriptions ss join public.business_units bu on bu.id = ss.business_unit_id where ss.id = subscription_id and ss.status in ('draft','trialing','active') and public.has_permission('saas.subscriptions.manage', bu.code)));

drop policy if exists saas_usage_manage on public.saas_usage_records;
create policy saas_usage_insert on public.saas_usage_records
for insert to authenticated
with check (exists(select 1 from public.saas_subscriptions ss join public.business_units bu on bu.id = ss.business_unit_id where ss.id = subscription_id and public.has_permission('saas.usage.manage', bu.code)));
create policy saas_usage_update on public.saas_usage_records
for update to authenticated
using (exists(select 1 from public.saas_subscriptions ss join public.business_units bu on bu.id = ss.business_unit_id where ss.id = subscription_id and public.has_permission('saas.usage.manage', bu.code)))
with check (exists(select 1 from public.saas_subscriptions ss join public.business_units bu on bu.id = ss.business_unit_id where ss.id = subscription_id and public.has_permission('saas.usage.manage', bu.code)));
create policy saas_usage_delete on public.saas_usage_records
for delete to authenticated
using (exists(select 1 from public.saas_subscriptions ss join public.business_units bu on bu.id = ss.business_unit_id where ss.id = subscription_id and public.has_permission('saas.usage.manage', bu.code)));

drop policy if exists saas_billing_manage on public.saas_billing_cycles;
create policy saas_billing_insert on public.saas_billing_cycles
for insert to authenticated
with check (status = 'draft' and exists(select 1 from public.saas_subscriptions ss join public.business_units bu on bu.id = ss.business_unit_id where ss.id = subscription_id and public.has_permission('saas.subscriptions.manage', bu.code)));
create policy saas_billing_update on public.saas_billing_cycles
for update to authenticated
using (status = 'draft' and exists(select 1 from public.saas_subscriptions ss join public.business_units bu on bu.id = ss.business_unit_id where ss.id = subscription_id and public.has_permission('saas.subscriptions.manage', bu.code)))
with check (status = 'draft' and exists(select 1 from public.saas_subscriptions ss join public.business_units bu on bu.id = ss.business_unit_id where ss.id = subscription_id and public.has_permission('saas.subscriptions.manage', bu.code)));
create policy saas_billing_delete on public.saas_billing_cycles
for delete to authenticated
using (status = 'draft' and exists(select 1 from public.saas_subscriptions ss join public.business_units bu on bu.id = ss.business_unit_id where ss.id = subscription_id and public.has_permission('saas.subscriptions.manage', bu.code)));
