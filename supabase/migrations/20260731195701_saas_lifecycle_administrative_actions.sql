create or replace function private.saas_period_end(p_start date, p_interval text)
returns date
language sql
immutable
set search_path = ''
as $$
  select case p_interval
    when 'monthly' then (p_start + interval '1 month' - interval '1 day')::date
    when 'quarterly' then (p_start + interval '3 months' - interval '1 day')::date
    when 'semiannual' then (p_start + interval '6 months' - interval '1 day')::date
    when 'annual' then (p_start + interval '1 year' - interval '1 day')::date
    else null::date
  end
$$;

create or replace function private.protect_saas_plan_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and auth.role() <> 'service_role' then
    raise exception 'Plan status changes require the administrative lifecycle action.';
  end if;
  if old.status = 'active' and auth.role() <> 'service_role' and (
    new.business_unit_id is distinct from old.business_unit_id
    or new.product_id is distinct from old.product_id
    or new.code is distinct from old.code
    or new.billing_interval is distinct from old.billing_interval
    or new.currency_code is distinct from old.currency_code
    or new.amount is distinct from old.amount
    or new.trial_days is distinct from old.trial_days
    or new.included_seats is distinct from old.included_seats
    or new.maximum_seats is distinct from old.maximum_seats
  ) then
    raise exception 'Commercial terms of an active plan are immutable. Create a new plan version.';
  end if;
  return new;
end
$$;

create or replace function private.protect_active_plan_entitlements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_status text;
begin
  select status into v_status from public.saas_plans where id=coalesce(new.plan_id,old.plan_id);
  if v_status='active' and auth.role()<>'service_role' then
    raise exception 'Entitlements of an active plan are immutable. Create a new plan.';
  end if;
  return coalesce(new,old);
end
$$;

create trigger saas_plans_protect_lifecycle before update on public.saas_plans for each row execute function private.protect_saas_plan_lifecycle();
create trigger saas_plan_entitlements_protect before insert or update or delete on public.saas_plan_entitlements for each row execute function private.protect_active_plan_entitlements();

create or replace function public.admin_activate_saas_plan(
  p_plan_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
)
returns public.saas_plans
language plpgsql
security definer
set search_path = ''
as $$
declare v_plan public.saas_plans%rowtype;
begin
  if auth.role() not in ('service_role') and current_user <> 'postgres' then raise exception 'Unauthorized.'; end if;
  update public.saas_plans
  set status='active'
  where id=p_plan_id and version=p_expected_version and status='draft'
  returning * into v_plan;
  if not found then return null; end if;
  return v_plan;
end
$$;

create or replace function public.admin_archive_saas_plan(
  p_plan_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
)
returns public.saas_plans
language plpgsql
security definer
set search_path = ''
as $$
declare v_plan public.saas_plans%rowtype;
begin
  if auth.role() not in ('service_role') and current_user <> 'postgres' then raise exception 'Unauthorized.'; end if;
  if exists(select 1 from public.saas_subscriptions where plan_id=p_plan_id and status in ('trialing','active','past_due','suspended')) then
    raise exception 'The plan has non-terminal subscriptions and cannot be archived.';
  end if;
  update public.saas_plans set status='archived'
  where id=p_plan_id and version=p_expected_version and status in ('draft','active')
  returning * into v_plan;
  if not found then return null; end if;
  return v_plan;
end
$$;

create or replace function public.admin_activate_saas_subscription(
  p_subscription_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
)
returns public.saas_subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subscription public.saas_subscriptions%rowtype;
  v_plan public.saas_plans%rowtype;
  v_start date;
  v_trial_end date;
  v_status text;
begin
  if auth.role() not in ('service_role') and current_user <> 'postgres' then raise exception 'Unauthorized.'; end if;
  select * into v_subscription from public.saas_subscriptions where id=p_subscription_id for update;
  if not found or v_subscription.version<>p_expected_version or v_subscription.status<>'draft' then return null; end if;
  select * into v_plan from public.saas_plans where id=v_subscription.plan_id and status='active';
  if not found then raise exception 'The subscription plan is not active.'; end if;
  if not exists(select 1 from public.parties where id=v_subscription.customer_party_id and status='active') then raise exception 'The customer is not active.'; end if;
  if v_subscription.seat_quantity < v_plan.included_seats then raise exception 'Seat quantity cannot be lower than the plan included seats.'; end if;
  if v_plan.maximum_seats is not null and v_subscription.seat_quantity > v_plan.maximum_seats then raise exception 'Seat quantity exceeds the plan maximum.'; end if;

  v_start:=coalesce(v_subscription.started_on,current_date);
  v_trial_end:=coalesce(v_subscription.trial_ends_on,case when v_plan.trial_days>0 then v_start+v_plan.trial_days else null end);
  v_status:=case when v_trial_end is not null and v_trial_end>=current_date then 'trialing' else 'active' end;

  insert into public.saas_subscription_entitlements(subscription_id,entitlement_key,name,value_type,boolean_value,numeric_value,text_value,reset_interval,source)
  select v_subscription.id,e.entitlement_key,e.name,e.value_type,e.boolean_value,e.numeric_value,e.text_value,e.reset_interval,'plan'
  from public.saas_plan_entitlements e where e.plan_id=v_plan.id and e.status='active'
  on conflict (subscription_id,entitlement_key) do nothing;

  update public.saas_subscriptions
  set status=v_status,
      started_on=v_start,
      trial_ends_on=v_trial_end,
      current_period_start=coalesce(v_subscription.current_period_start,v_start),
      current_period_end=coalesce(v_subscription.current_period_end,private.saas_period_end(v_start,v_subscription.billing_interval))
  where id=v_subscription.id and version=p_expected_version
  returning * into v_subscription;

  insert into public.saas_subscription_events(subscription_id,event_type,previous_status,new_status,reason,actor_user_id)
  values(v_subscription.id,case when v_status='trialing' then 'trial_started' else 'activated' end,'draft',v_status,'Initial activation',p_actor_user_id);
  return v_subscription;
end
$$;

create or replace function public.admin_transition_saas_subscription(
  p_subscription_id uuid,
  p_expected_version integer,
  p_target_status text,
  p_reason text,
  p_actor_user_id uuid
)
returns public.saas_subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare v_subscription public.saas_subscriptions%rowtype; v_previous text; v_allowed boolean:=false;
begin
  if auth.role() not in ('service_role') and current_user <> 'postgres' then raise exception 'Unauthorized.'; end if;
  if p_target_status not in ('active','past_due','suspended','cancelled','expired') then raise exception 'Invalid target subscription status.'; end if;
  if p_target_status in ('past_due','suspended','cancelled','expired') and length(trim(coalesce(p_reason,'')))<3 then raise exception 'A formal reason is required.'; end if;
  select * into v_subscription from public.saas_subscriptions where id=p_subscription_id for update;
  if not found or v_subscription.version<>p_expected_version then return null; end if;
  v_previous:=v_subscription.status;
  v_allowed:=
    (v_previous='trialing' and p_target_status in ('active','suspended','cancelled','expired'))
    or (v_previous='active' and p_target_status in ('past_due','suspended','cancelled','expired'))
    or (v_previous='past_due' and p_target_status in ('active','suspended','cancelled','expired'))
    or (v_previous='suspended' and p_target_status in ('active','cancelled','expired'));
  if not v_allowed then raise exception 'The requested subscription transition is not allowed.'; end if;

  update public.saas_subscriptions
  set status=p_target_status,
      cancelled_at=case when p_target_status='cancelled' then now() else cancelled_at end,
      ended_at=case when p_target_status in ('cancelled','expired') then now() else ended_at end,
      cancel_at_period_end=case when p_target_status in ('cancelled','expired') then false else cancel_at_period_end end
  where id=p_subscription_id and version=p_expected_version
  returning * into v_subscription;

  insert into public.saas_subscription_events(subscription_id,event_type,previous_status,new_status,reason,actor_user_id)
  values(v_subscription.id,case when p_target_status='cancelled' then 'cancelled' when p_target_status='expired' then 'expired' else 'status_changed' end,v_previous,p_target_status,trim(nullif(p_reason,'')),p_actor_user_id);
  return v_subscription;
end
$$;

create or replace function public.admin_link_saas_billing_cycle(
  p_billing_cycle_id uuid,
  p_expected_version integer,
  p_financial_document_id uuid,
  p_actor_user_id uuid
)
returns public.saas_billing_cycles
language plpgsql
security definer
set search_path = ''
as $$
declare v_cycle public.saas_billing_cycles%rowtype; v_subscription_id uuid;
begin
  if auth.role() not in ('service_role') and current_user <> 'postgres' then raise exception 'Unauthorized.'; end if;
  update public.saas_billing_cycles
  set financial_document_id=p_financial_document_id,status='invoiced'
  where id=p_billing_cycle_id and version=p_expected_version and status='draft'
  returning * into v_cycle;
  if not found then return null; end if;
  v_subscription_id:=v_cycle.subscription_id;
  insert into public.saas_subscription_events(subscription_id,event_type,previous_status,new_status,reason,metadata,actor_user_id)
  values(v_subscription_id,'billing_linked',null,null,'Billing cycle linked to the corporate financial document',jsonb_build_object('billing_cycle_id',v_cycle.id,'financial_document_id',p_financial_document_id),p_actor_user_id);
  return v_cycle;
end
$$;

create or replace function public.admin_void_saas_billing_cycle(
  p_billing_cycle_id uuid,
  p_expected_version integer,
  p_reason text,
  p_actor_user_id uuid
)
returns public.saas_billing_cycles
language plpgsql
security definer
set search_path = ''
as $$
declare v_cycle public.saas_billing_cycles%rowtype; v_document_status text;
begin
  if auth.role() not in ('service_role') and current_user <> 'postgres' then raise exception 'Unauthorized.'; end if;
  if length(trim(coalesce(p_reason,'')))<3 then raise exception 'A formal reason is required.'; end if;
  select * into v_cycle from public.saas_billing_cycles where id=p_billing_cycle_id for update;
  if not found or v_cycle.version<>p_expected_version or v_cycle.status='void' then return null; end if;
  if v_cycle.financial_document_id is not null then
    select status into v_document_status from public.financial_documents where id=v_cycle.financial_document_id;
    if v_document_status not in ('cancelled','reversed','rejected') then raise exception 'Cancel or reverse the linked financial document before voiding the billing cycle.'; end if;
  end if;
  update public.saas_billing_cycles set status='void',notes=concat_ws(E'\n',notes,'Void reason: '||trim(p_reason)) where id=p_billing_cycle_id and version=p_expected_version returning * into v_cycle;
  insert into public.saas_subscription_events(subscription_id,event_type,reason,metadata,actor_user_id)
  values(v_cycle.subscription_id,'note','Billing cycle voided: '||trim(p_reason),jsonb_build_object('billing_cycle_id',v_cycle.id),p_actor_user_id);
  return v_cycle;
end
$$;

revoke all on function public.admin_activate_saas_plan(uuid,integer,uuid),public.admin_archive_saas_plan(uuid,integer,uuid),public.admin_activate_saas_subscription(uuid,integer,uuid),public.admin_transition_saas_subscription(uuid,integer,text,text,uuid),public.admin_link_saas_billing_cycle(uuid,integer,uuid,uuid),public.admin_void_saas_billing_cycle(uuid,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_activate_saas_plan(uuid,integer,uuid),public.admin_archive_saas_plan(uuid,integer,uuid),public.admin_activate_saas_subscription(uuid,integer,uuid),public.admin_transition_saas_subscription(uuid,integer,text,text,uuid),public.admin_link_saas_billing_cycle(uuid,integer,uuid,uuid),public.admin_void_saas_billing_cycle(uuid,integer,text,uuid) to service_role;
revoke all on function private.saas_period_end(date,text),private.protect_saas_plan_lifecycle(),private.protect_active_plan_entitlements() from public,anon,authenticated,service_role;
