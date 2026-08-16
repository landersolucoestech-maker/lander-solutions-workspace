-- Remove duplicated product-level SaaS administration and reduce integrations to a secondary settings registry.

-- Remove obsolete role grants before deleting permissions.
delete from public.role_permissions
where permission_id in (
  select id from public.permissions
  where module in ('saas','integrations')
     or code like 'saas.%'
     or code like 'integrations.%'
);

delete from public.permissions
where module in ('saas','integrations')
   or code like 'saas.%'
   or code like 'integrations.%';

-- Drop SaaS lifecycle functions.
drop function if exists public.admin_activate_saas_plan(uuid,integer,uuid) cascade;
drop function if exists public.admin_activate_saas_subscription(uuid,integer,uuid) cascade;
drop function if exists public.admin_archive_saas_plan(uuid,integer,uuid) cascade;
drop function if exists public.admin_link_saas_billing_cycle(uuid,integer,uuid,uuid) cascade;
drop function if exists public.admin_transition_saas_subscription(uuid,integer,text,text,uuid) cascade;
drop function if exists public.admin_void_saas_billing_cycle(uuid,integer,text,uuid) cascade;
drop function if exists private.prevent_saas_event_mutation() cascade;
drop function if exists private.protect_saas_plan_lifecycle() cascade;
drop function if exists private.saas_period_end(date,text) cascade;
drop function if exists private.saas_touch_version() cascade;
drop function if exists private.validate_saas_billing_cycle() cascade;
drop function if exists private.validate_saas_scope() cascade;

-- All SaaS tables are empty in dev and intentionally removed from the central company system.
drop table if exists public.saas_billing_cycles cascade;
drop table if exists public.saas_usage_records cascade;
drop table if exists public.saas_subscription_events cascade;
drop table if exists public.saas_subscription_entitlements cascade;
drop table if exists public.saas_subscriptions cascade;
drop table if exists public.saas_plan_entitlements cascade;
drop table if exists public.saas_plans cascade;

-- Remove premature integration orchestration.
drop function if exists public.admin_transition_integration_connection(uuid,integer,text,text,uuid) cascade;
drop function if exists public.admin_transition_integration_event(bigint,text,text,uuid) cascade;
drop function if exists public.admin_transition_integration_job(uuid,integer,text,text,uuid) cascade;
drop function if exists public.admin_transition_integration_webhook(uuid,integer,text,uuid) cascade;
drop function if exists private.integration_touch_version() cascade;
drop function if exists private.prevent_integration_attempt_mutation() cascade;

drop table if exists public.integration_job_attempts cascade;
drop table if exists public.integration_sync_jobs cascade;
drop table if exists public.integration_events cascade;
drop table if exists public.integration_webhook_endpoints cascade;
drop table if exists public.integration_connections cascade;

-- Secondary registry under Settings > Integrations. It stores metadata only, never credentials.
create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid references public.business_units(id) on delete restrict,
  source_system text not null,
  information_type text not null,
  endpoint_url text,
  environment text not null default 'development'
    check (environment in ('development','staging','production')),
  status text not null default 'draft'
    check (status in ('draft','active','inactive','error')),
  last_sync_at timestamptz,
  last_failure_at timestamptz,
  last_failure_message text,
  technical_owner_user_id uuid references auth.users(id) on delete set null,
  secret_reference text,
  summary_log text,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  deleted_at timestamptz,
  constraint integration_source_not_blank check (btrim(source_system) <> ''),
  constraint integration_information_not_blank check (btrim(information_type) <> ''),
  constraint integration_endpoint_https check (
    endpoint_url is null
    or endpoint_url ~* '^https://[^[:space:]]+$'
    or (
      environment = 'development'
      and endpoint_url ~* '^http://(localhost|127\.0\.0\.1)(:[0-9]+)?(/.*)?$'
    )
  ),
  constraint integration_secret_reference_only check (
    secret_reference is null
    or secret_reference !~* '(password|passwd|token|secret|api[_-]?key)\s*[:=]\s*[^ ]+'
  ),
  constraint integration_failure_consistency check (
    (last_failure_at is null and last_failure_message is null)
    or last_failure_at is not null
  )
);

create unique index integration_connections_scope_unique
  on public.integration_connections (
    coalesce(business_unit_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(source_system),
    lower(information_type),
    environment
  ) where deleted_at is null;
create index integration_connections_status_idx
  on public.integration_connections (status, environment) where deleted_at is null;
create index integration_connections_owner_idx
  on public.integration_connections (technical_owner_user_id)
  where technical_owner_user_id is not null;
create index integration_connections_business_unit_idx
  on public.integration_connections (business_unit_id)
  where business_unit_id is not null;
create index integration_connections_created_by_idx
  on public.integration_connections (created_by)
  where created_by is not null;
create index integration_connections_updated_by_idx
  on public.integration_connections (updated_by)
  where updated_by is not null;

create trigger integration_connections_touch_updated_at
before update on public.integration_connections
for each row execute function private.touch_updated_at();

create trigger integration_connections_audit
before insert or update or delete on public.integration_connections
for each row execute function private.audit_row_change();

alter table public.integration_connections enable row level security;

revoke all on public.integration_connections from anon;
revoke insert, update, delete on public.integration_connections from authenticated;
grant select on public.integration_connections to authenticated;
grant all on public.integration_connections to service_role;

insert into public.permissions (code,module,action,description)
values
  (
    'settings.integrations.read',
    'settings',
    'integrations_read',
    'Visualizar o cadastro técnico mínimo de integrações.'
  ),
  (
    'settings.integrations.manage',
    'settings',
    'integrations_manage',
    'Gerenciar o cadastro técnico mínimo de integrações.'
  )
on conflict (code) do update set
  module = excluded.module,
  action = excluded.action,
  description = excluded.description;

insert into public.role_permissions (role_id,permission_id)
select r.id,p.id
from public.app_roles r
join public.permissions p
  on p.code in ('settings.integrations.read','settings.integrations.manage')
where r.code in ('owner','corporate_admin')
on conflict do nothing;

insert into public.role_permissions (role_id,permission_id)
select r.id,p.id
from public.app_roles r
join public.permissions p
  on p.code = 'settings.integrations.read'
where r.code in ('auditor','readonly','executive_readonly')
on conflict do nothing;

create policy integration_connections_select
on public.integration_connections
for select to authenticated
using (
  deleted_at is null
  and (
    public.has_permission(
      'settings.integrations.read',
      private.unit_code_for_id(business_unit_id)
    )
    or public.has_permission(
      'settings.integrations.manage',
      private.unit_code_for_id(business_unit_id)
    )
  )
);

comment on table public.integration_connections is
  'Cadastro secundário de integrações concretas. Não armazena credenciais, filas, webhooks, jobs ou operação interna dos produtos.';
comment on column public.integration_connections.secret_reference is
  'Referência externa ao segredo. Nunca armazenar token, chave, senha ou credencial neste campo.';
