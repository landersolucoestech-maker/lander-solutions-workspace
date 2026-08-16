create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('github','supabase')),
  code text not null unique,
  name text not null,
  business_unit_id uuid references public.business_units(id),
  status text not null default 'draft' check (status in ('draft','active','paused','error','archived')),
  external_account_reference text,
  base_url text,
  secret_reference text,
  configuration jsonb not null default '{}'::jsonb,
  last_health_status text check (last_health_status is null or last_health_status in ('healthy','degraded','unreachable','not_configured')),
  last_health_checked_at timestamptz,
  last_error text,
  version integer not null default 1,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (secret_reference is null or secret_reference !~* '(token|password|secret)=[^[:space:]]+')
);

create table public.integration_webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  public_id uuid not null default gen_random_uuid() unique,
  event_scope text not null,
  signing_secret_reference text,
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(connection_id,event_scope)
);

create table public.integration_events (
  id bigint generated always as identity primary key,
  connection_id uuid not null references public.integration_connections(id),
  webhook_endpoint_id uuid references public.integration_webhook_endpoints(id),
  external_event_id text,
  event_type text not null,
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  payload_hash text not null,
  payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','processed','failed','dead_letter','ignored')),
  attempts_count integer not null default 0 check (attempts_count >= 0),
  next_retry_at timestamptz,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create unique index integration_events_external_uidx on public.integration_events(connection_id,external_event_id) where external_event_id is not null;
create index integration_events_status_retry_idx on public.integration_events(status,next_retry_at,received_at);

create table public.integration_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id),
  job_type text not null,
  idempotency_key text not null unique,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','dead_letter','cancelled')),
  request_metadata jsonb not null default '{}'::jsonb,
  result_metadata jsonb not null default '{}'::jsonb,
  attempts_count integer not null default 0 check (attempts_count >= 0),
  scheduled_for timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  next_retry_at timestamptz,
  last_error text,
  version integer not null default 1,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index integration_sync_jobs_status_idx on public.integration_sync_jobs(status,scheduled_for,next_retry_at);

create table public.integration_job_attempts (
  id bigint generated always as identity primary key,
  sync_job_id uuid not null references public.integration_sync_jobs(id) on delete cascade,
  attempt_no integer not null check (attempt_no > 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  outcome text not null check (outcome in ('running','succeeded','failed')),
  http_status integer,
  error_code text,
  error_message text,
  response_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(sync_job_id,attempt_no)
);

create or replace function private.integration_touch_version()
returns trigger language plpgsql set search_path='' as $$
begin
  new.updated_at=now();
  new.version=old.version+1;
  return new;
end $$;

create or replace function private.prevent_integration_attempt_mutation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  raise exception 'Integration job attempts are immutable.';
end $$;

create trigger integration_connections_touch before update on public.integration_connections for each row execute function private.integration_touch_version();
create trigger integration_webhooks_touch before update on public.integration_webhook_endpoints for each row execute function private.integration_touch_version();
create trigger integration_jobs_touch before update on public.integration_sync_jobs for each row execute function private.integration_touch_version();
create trigger integration_attempts_immutable before update or delete on public.integration_job_attempts for each row execute function private.prevent_integration_attempt_mutation();

create trigger integration_connections_audit after insert or update or delete on public.integration_connections for each row execute function private.audit_row_change();
create trigger integration_webhooks_audit after insert or update or delete on public.integration_webhook_endpoints for each row execute function private.audit_row_change();
create trigger integration_jobs_audit after insert or update or delete on public.integration_sync_jobs for each row execute function private.audit_row_change();

insert into public.permissions(code,module,action,description) values
('integrations.read','integrations','read','Visualizar conexões, webhooks, eventos e jobs de integração.'),
('integrations.manage','integrations','manage','Gerenciar conexões e endpoints de integração.'),
('integrations.jobs.manage','integrations','jobs_manage','Criar, reprocessar e cancelar jobs de integração.'),
('integrations.events.manage','integrations','events_manage','Reprocessar e classificar eventos de integração.')
on conflict(code) do update set module=excluded.module,action=excluded.action,description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.app_roles r cross join public.permissions p
where r.code in ('owner','corporate_admin') and p.code like 'integrations.%'
on conflict do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.app_roles r join public.permissions p on p.code='integrations.read'
where r.code in ('auditor','executive_readonly','readonly','finance_manager')
on conflict do nothing;

alter table public.integration_connections enable row level security;
alter table public.integration_webhook_endpoints enable row level security;
alter table public.integration_events enable row level security;
alter table public.integration_sync_jobs enable row level security;
alter table public.integration_job_attempts enable row level security;

create policy integration_connections_read on public.integration_connections for select to authenticated using (public.has_permission('integrations.read',null));
create policy integration_connections_manage on public.integration_connections for all to authenticated using (status='draft' and public.has_permission('integrations.manage',null)) with check (status='draft' and public.has_permission('integrations.manage',null));
create policy integration_webhooks_read on public.integration_webhook_endpoints for select to authenticated using (public.has_permission('integrations.read',null));
create policy integration_webhooks_manage on public.integration_webhook_endpoints for all to authenticated using (status='draft' and public.has_permission('integrations.manage',null)) with check (status='draft' and public.has_permission('integrations.manage',null));
create policy integration_events_read on public.integration_events for select to authenticated using (public.has_permission('integrations.read',null));
create policy integration_jobs_read on public.integration_sync_jobs for select to authenticated using (public.has_permission('integrations.read',null));
create policy integration_jobs_create on public.integration_sync_jobs for insert to authenticated with check (status='queued' and public.has_permission('integrations.jobs.manage',null));
create policy integration_attempts_read on public.integration_job_attempts for select to authenticated using (public.has_permission('integrations.read',null));

revoke all on public.integration_connections,public.integration_webhook_endpoints,public.integration_events,public.integration_sync_jobs,public.integration_job_attempts from anon;
grant select,insert,update,delete on public.integration_connections,public.integration_webhook_endpoints to authenticated;
grant select on public.integration_events,public.integration_job_attempts to authenticated;
grant select,insert on public.integration_sync_jobs to authenticated;
grant all on public.integration_connections,public.integration_webhook_endpoints,public.integration_events,public.integration_sync_jobs,public.integration_job_attempts to service_role;
grant usage,select on sequence public.integration_events_id_seq,public.integration_job_attempts_id_seq to service_role;

revoke all on function private.integration_touch_version(),private.prevent_integration_attempt_mutation() from public,anon,authenticated,service_role;
