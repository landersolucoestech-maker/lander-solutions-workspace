create table public.saas_plans (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id),
  product_id uuid not null references public.products(id),
  code text not null,
  name text not null,
  description text,
  billing_interval text not null check (billing_interval in ('monthly','quarterly','semiannual','annual')),
  currency_code text not null references public.currencies(code),
  amount numeric(20,6) not null check (amount >= 0),
  trial_days integer not null default 0 check (trial_days between 0 and 365),
  included_seats integer not null default 1 check (included_seats > 0),
  maximum_seats integer check (maximum_seats is null or maximum_seats >= included_seats),
  is_public boolean not null default false,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  version integer not null default 1,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, code)
);

create table public.saas_plan_entitlements (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.saas_plans(id) on delete cascade,
  entitlement_key text not null,
  name text not null,
  description text,
  value_type text not null check (value_type in ('boolean','count','metered','text')),
  boolean_value boolean,
  numeric_value numeric(20,6),
  text_value text,
  reset_interval text check (reset_interval is null or reset_interval in ('daily','monthly','annual','never')),
  status text not null default 'active' check (status in ('active','inactive')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, entitlement_key),
  check (
    (value_type = 'boolean' and boolean_value is not null and numeric_value is null and text_value is null)
    or (value_type in ('count','metered') and numeric_value is not null and numeric_value >= 0 and boolean_value is null and text_value is null)
    or (value_type = 'text' and text_value is not null and boolean_value is null and numeric_value is null)
  )
);

create table public.saas_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id),
  product_id uuid not null references public.products(id),
  plan_id uuid not null references public.saas_plans(id),
  customer_party_id uuid not null references public.parties(id),
  contract_id uuid references public.contracts(id),
  code text not null unique,
  status text not null default 'draft' check (status in ('draft','trialing','active','past_due','suspended','cancelled','expired')),
  started_on date,
  trial_ends_on date,
  current_period_start date,
  current_period_end date,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  ended_at timestamptz,
  seat_quantity integer not null default 1 check (seat_quantity > 0),
  billing_interval text not null check (billing_interval in ('monthly','quarterly','semiannual','annual')),
  currency_code text not null references public.currencies(code),
  unit_price numeric(20,6) not null check (unit_price >= 0),
  external_reference text,
  notes text,
  version integer not null default 1,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end is null or current_period_start is not null),
  check (current_period_end is null or current_period_end >= current_period_start),
  check (trial_ends_on is null or started_on is null or trial_ends_on >= started_on)
);

create table public.saas_subscription_entitlements (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.saas_subscriptions(id) on delete cascade,
  entitlement_key text not null,
  name text not null,
  value_type text not null check (value_type in ('boolean','count','metered','text')),
  boolean_value boolean,
  numeric_value numeric(20,6),
  text_value text,
  reset_interval text check (reset_interval is null or reset_interval in ('daily','monthly','annual','never')),
  source text not null default 'plan' check (source in ('plan','override')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscription_id, entitlement_key),
  check (
    (value_type = 'boolean' and boolean_value is not null and numeric_value is null and text_value is null)
    or (value_type in ('count','metered') and numeric_value is not null and numeric_value >= 0 and boolean_value is null and text_value is null)
    or (value_type = 'text' and text_value is not null and boolean_value is null and numeric_value is null)
  )
);

create table public.saas_usage_records (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.saas_subscriptions(id) on delete cascade,
  entitlement_key text not null,
  occurred_at timestamptz not null default now(),
  period_start date not null,
  period_end date not null,
  quantity numeric(20,6) not null check (quantity >= 0),
  source text not null default 'manual' check (source in ('manual','import','api','correction')),
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create unique index saas_usage_external_reference_uidx on public.saas_usage_records(subscription_id, external_reference) where external_reference is not null;

create table public.saas_billing_cycles (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.saas_subscriptions(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  due_date date not null,
  currency_code text not null references public.currencies(code),
  amount numeric(20,6) not null check (amount >= 0),
  status text not null default 'draft' check (status in ('draft','invoiced','void')),
  financial_document_id uuid unique references public.financial_documents(id),
  notes text,
  version integer not null default 1,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscription_id, period_start, period_end),
  check (period_end >= period_start),
  check (due_date >= period_start),
  check ((status = 'invoiced' and financial_document_id is not null) or status <> 'invoiced')
);

create table public.saas_subscription_events (
  id bigint generated always as identity primary key,
  subscription_id uuid not null references public.saas_subscriptions(id) on delete cascade,
  event_type text not null check (event_type in ('activated','trial_started','status_changed','cancelled','expired','plan_changed','billing_linked','note')),
  effective_at timestamptz not null default now(),
  previous_status text,
  new_status text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  actor_user_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index saas_plans_scope_idx on public.saas_plans(business_unit_id, product_id, status);
create index saas_subscriptions_scope_idx on public.saas_subscriptions(business_unit_id, product_id, status);
create index saas_subscriptions_customer_idx on public.saas_subscriptions(customer_party_id, status);
create index saas_subscription_events_subscription_idx on public.saas_subscription_events(subscription_id, effective_at desc);
create index saas_usage_subscription_period_idx on public.saas_usage_records(subscription_id, period_start, period_end);
create index saas_billing_cycles_subscription_idx on public.saas_billing_cycles(subscription_id, period_start desc);

create or replace function private.validate_saas_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_unit_id uuid; v_product_type text;
begin
  select p.business_unit_id,p.product_type into v_unit_id,v_product_type from public.products p where p.id=new.product_id;
  if v_unit_id is null or v_unit_id<>new.business_unit_id then raise exception 'The product does not belong to the selected business unit.'; end if;
  if v_product_type<>'saas' then raise exception 'SaaS records can only be created for products with product_type = saas.'; end if;
  if tg_table_name='saas_subscriptions' then
    if not exists (select 1 from public.saas_plans sp where sp.id=new.plan_id and sp.business_unit_id=new.business_unit_id and sp.product_id=new.product_id) then raise exception 'The selected plan does not belong to the SaaS product.'; end if;
    if new.contract_id is not null and not exists (select 1 from public.contracts c where c.id=new.contract_id and c.business_unit_id=new.business_unit_id and (c.product_id is null or c.product_id=new.product_id)) then raise exception 'The contract is incompatible with the subscription scope.'; end if;
  end if;
  return new;
end $$;

create or replace function private.validate_saas_billing_cycle()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_subscription public.saas_subscriptions%rowtype; v_document public.financial_documents%rowtype;
begin
  select * into v_subscription from public.saas_subscriptions where id=new.subscription_id;
  if not found then raise exception 'Subscription not found.'; end if;
  if new.currency_code<>v_subscription.currency_code then raise exception 'Billing cycle currency must match the subscription currency.'; end if;
  if new.financial_document_id is not null then
    select * into v_document from public.financial_documents where id=new.financial_document_id;
    if not found then raise exception 'Financial document not found.'; end if;
    if v_document.document_nature<>'receivable' or v_document.business_unit_id<>v_subscription.business_unit_id or v_document.product_id is distinct from v_subscription.product_id or v_document.party_id<>v_subscription.customer_party_id or v_document.contract_id is distinct from v_subscription.contract_id then raise exception 'The financial document is incompatible with the subscription.'; end if;
  end if;
  return new;
end $$;

create or replace function private.saas_touch_version()
returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at=now(); new.version=old.version+1; return new; end $$;
create or replace function private.prevent_saas_event_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$ begin raise exception 'SaaS subscription events are immutable.'; end $$;

create trigger saas_plans_validate before insert or update on public.saas_plans for each row execute function private.validate_saas_scope();
create trigger saas_subscriptions_validate before insert or update on public.saas_subscriptions for each row execute function private.validate_saas_scope();
create trigger saas_billing_cycles_validate before insert or update on public.saas_billing_cycles for each row execute function private.validate_saas_billing_cycle();
create trigger saas_plans_touch before update on public.saas_plans for each row execute function private.saas_touch_version();
create trigger saas_plan_entitlements_touch before update on public.saas_plan_entitlements for each row execute function private.saas_touch_version();
create trigger saas_subscriptions_touch before update on public.saas_subscriptions for each row execute function private.saas_touch_version();
create trigger saas_subscription_entitlements_touch before update on public.saas_subscription_entitlements for each row execute function private.saas_touch_version();
create trigger saas_billing_cycles_touch before update on public.saas_billing_cycles for each row execute function private.saas_touch_version();
create trigger saas_subscription_events_immutable before update or delete on public.saas_subscription_events for each row execute function private.prevent_saas_event_mutation();

create trigger saas_plans_audit after insert or update or delete on public.saas_plans for each row execute function private.audit_row_change();
create trigger saas_plan_entitlements_audit after insert or update or delete on public.saas_plan_entitlements for each row execute function private.audit_row_change();
create trigger saas_subscriptions_audit after insert or update or delete on public.saas_subscriptions for each row execute function private.audit_row_change();
create trigger saas_subscription_entitlements_audit after insert or update or delete on public.saas_subscription_entitlements for each row execute function private.audit_row_change();
create trigger saas_usage_records_audit after insert or update or delete on public.saas_usage_records for each row execute function private.audit_row_change();
create trigger saas_billing_cycles_audit after insert or update or delete on public.saas_billing_cycles for each row execute function private.audit_row_change();

insert into public.permissions(code,module,action,description) values
('saas.read','saas','read','Visualizar planos, assinaturas, uso e ciclos de cobrança SaaS.'),
('saas.plans.manage','saas','plans_manage','Gerenciar planos e entitlements SaaS.'),
('saas.subscriptions.manage','saas','subscriptions_manage','Gerenciar assinaturas em rascunho e seus dados operacionais.'),
('saas.lifecycle.manage','saas','lifecycle_manage','Ativar, suspender, retomar, cancelar e vincular cobranças SaaS.'),
('saas.usage.manage','saas','usage_manage','Registrar e corrigir consumo de entitlements SaaS.')
on conflict (code) do update set module=excluded.module,action=excluded.action,description=excluded.description;

insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.app_roles r cross join public.permissions p where r.code in ('owner','corporate_admin') and p.code like 'saas.%' on conflict do nothing;
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.app_roles r join public.permissions p on p.code in ('saas.read','saas.subscriptions.manage','saas.usage.manage') where r.code in ('unit_manager','commercial') on conflict do nothing;
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.app_roles r join public.permissions p on p.code='saas.read' where r.code in ('finance_manager','executive_readonly','readonly','auditor') on conflict do nothing;

alter table public.saas_plans enable row level security;
alter table public.saas_plan_entitlements enable row level security;
alter table public.saas_subscriptions enable row level security;
alter table public.saas_subscription_entitlements enable row level security;
alter table public.saas_usage_records enable row level security;
alter table public.saas_billing_cycles enable row level security;
alter table public.saas_subscription_events enable row level security;

create policy saas_plans_read on public.saas_plans for select to authenticated using (exists(select 1 from public.business_units bu where bu.id=business_unit_id and public.has_permission('saas.read',bu.code)));
create policy saas_plans_manage on public.saas_plans for all to authenticated using (exists(select 1 from public.business_units bu where bu.id=business_unit_id and public.has_permission('saas.plans.manage',bu.code))) with check (exists(select 1 from public.business_units bu where bu.id=business_unit_id and public.has_permission('saas.plans.manage',bu.code)));
create policy saas_plan_entitlements_read on public.saas_plan_entitlements for select to authenticated using (exists(select 1 from public.saas_plans sp join public.business_units bu on bu.id=sp.business_unit_id where sp.id=plan_id and public.has_permission('saas.read',bu.code)));
create policy saas_plan_entitlements_manage on public.saas_plan_entitlements for all to authenticated using (exists(select 1 from public.saas_plans sp join public.business_units bu on bu.id=sp.business_unit_id where sp.id=plan_id and public.has_permission('saas.plans.manage',bu.code))) with check (exists(select 1 from public.saas_plans sp join public.business_units bu on bu.id=sp.business_unit_id where sp.id=plan_id and public.has_permission('saas.plans.manage',bu.code)));
create policy saas_subscriptions_read on public.saas_subscriptions for select to authenticated using (exists(select 1 from public.business_units bu where bu.id=business_unit_id and public.has_permission('saas.read',bu.code)));
create policy saas_subscriptions_manage on public.saas_subscriptions for all to authenticated using (status='draft' and exists(select 1 from public.business_units bu where bu.id=business_unit_id and public.has_permission('saas.subscriptions.manage',bu.code))) with check (status='draft' and exists(select 1 from public.business_units bu where bu.id=business_unit_id and public.has_permission('saas.subscriptions.manage',bu.code)));
create policy saas_subscription_entitlements_read on public.saas_subscription_entitlements for select to authenticated using (exists(select 1 from public.saas_subscriptions ss join public.business_units bu on bu.id=ss.business_unit_id where ss.id=subscription_id and public.has_permission('saas.read',bu.code)));
create policy saas_subscription_entitlements_manage on public.saas_subscription_entitlements for all to authenticated using (exists(select 1 from public.saas_subscriptions ss join public.business_units bu on bu.id=ss.business_unit_id where ss.id=subscription_id and ss.status in ('draft','trialing','active') and public.has_permission('saas.subscriptions.manage',bu.code))) with check (exists(select 1 from public.saas_subscriptions ss join public.business_units bu on bu.id=ss.business_unit_id where ss.id=subscription_id and ss.status in ('draft','trialing','active') and public.has_permission('saas.subscriptions.manage',bu.code)));
create policy saas_usage_read on public.saas_usage_records for select to authenticated using (exists(select 1 from public.saas_subscriptions ss join public.business_units bu on bu.id=ss.business_unit_id where ss.id=subscription_id and public.has_permission('saas.read',bu.code)));
create policy saas_usage_manage on public.saas_usage_records for all to authenticated using (exists(select 1 from public.saas_subscriptions ss join public.business_units bu on bu.id=ss.business_unit_id where ss.id=subscription_id and public.has_permission('saas.usage.manage',bu.code))) with check (exists(select 1 from public.saas_subscriptions ss join public.business_units bu on bu.id=ss.business_unit_id where ss.id=subscription_id and public.has_permission('saas.usage.manage',bu.code)));
create policy saas_billing_read on public.saas_billing_cycles for select to authenticated using (exists(select 1 from public.saas_subscriptions ss join public.business_units bu on bu.id=ss.business_unit_id where ss.id=subscription_id and public.has_permission('saas.read',bu.code)));
create policy saas_billing_manage on public.saas_billing_cycles for all to authenticated using (status='draft' and exists(select 1 from public.saas_subscriptions ss join public.business_units bu on bu.id=ss.business_unit_id where ss.id=subscription_id and public.has_permission('saas.subscriptions.manage',bu.code))) with check (status='draft' and exists(select 1 from public.saas_subscriptions ss join public.business_units bu on bu.id=ss.business_unit_id where ss.id=subscription_id and public.has_permission('saas.subscriptions.manage',bu.code)));
create policy saas_events_read on public.saas_subscription_events for select to authenticated using (exists(select 1 from public.saas_subscriptions ss join public.business_units bu on bu.id=ss.business_unit_id where ss.id=subscription_id and public.has_permission('saas.read',bu.code)));

revoke all on public.saas_plans,public.saas_plan_entitlements,public.saas_subscriptions,public.saas_subscription_entitlements,public.saas_usage_records,public.saas_billing_cycles,public.saas_subscription_events from anon;
grant select,insert,update,delete on public.saas_plans,public.saas_plan_entitlements,public.saas_subscriptions,public.saas_subscription_entitlements,public.saas_usage_records,public.saas_billing_cycles to authenticated;
grant select on public.saas_subscription_events to authenticated;
grant all on public.saas_plans,public.saas_plan_entitlements,public.saas_subscriptions,public.saas_subscription_entitlements,public.saas_usage_records,public.saas_billing_cycles,public.saas_subscription_events to service_role;
grant usage,select on sequence public.saas_subscription_events_id_seq to service_role;
revoke all on function private.validate_saas_scope(),private.validate_saas_billing_cycle(),private.saas_touch_version(),private.prevent_saas_event_mutation() from public,anon,authenticated,service_role;
