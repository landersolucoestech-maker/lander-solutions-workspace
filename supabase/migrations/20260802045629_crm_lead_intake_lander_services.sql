begin;

insert into public.business_units (
  legal_entity_id,
  code,
  name,
  description,
  unit_type,
  status,
  primary_currency_code,
  is_system
)
select
  le.id,
  'LANDERSERVICES',
  'Lander Services',
  'Unidade de serviços profissionais da LANDER SOLUTIONS.',
  'services',
  'active',
  'BRL',
  true
from public.legal_entities le
where le.code = 'LANDER_SOLUTIONS'
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    unit_type = excluded.unit_type,
    status = excluded.status,
    primary_currency_code = excluded.primary_currency_code;

update public.service_lines sl
set business_unit_id = bu.id,
    updated_at = now(),
    version = sl.version + 1
from public.business_units bu
where bu.code = 'LANDERSERVICES'
  and sl.code in (
    'SYSTEM_DEVELOPMENT',
    'WEB_DEVELOPMENT',
    'AUTOMATIONS',
    'TECH_CONSULTING',
    'TECH_SUPPORT',
    'ADMIN_SUPPORT',
    'DISPATCH_SERVICES',
    'OTHER_SERVICES'
  )
  and sl.business_unit_id is distinct from bu.id;

alter table public.crm_leads
  add column if not exists code text,
  add column if not exists trade_name text,
  add column if not exists tax_id text,
  add column if not exists birth_date date,
  add column if not exists profession_activity text,
  add column if not exists company_size text,
  add column if not exists website text,
  add column if not exists contact_role text,
  add column if not exists whatsapp text,
  add column if not exists city text,
  add column if not exists state_region text,
  add column if not exists primary_service_other text,
  add column if not exists need_summary text,
  add column if not exists contact_preference text,
  add column if not exists best_contact_time text,
  add column if not exists campaign text,
  add column if not exists referred_by text,
  add column if not exists priority text not null default 'medium',
  add column if not exists last_contact_at timestamptz,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null,
  add column if not exists last_interaction_at timestamptz,
  add column if not exists interaction_count integer not null default 0;

update public.crm_leads
set code = 'LEAD_' || upper(substr(replace(id::text, '-', ''), 1, 12))
where code is null or btrim(code) = '';

update public.crm_leads
set source = case source
  when 'inbound' then 'site'
  when 'outbound' then 'prospecting'
  when 'referral' then 'referral'
  when 'event' then 'other'
  when 'social' then 'social'
  when 'partner' then 'partner'
  when 'website' then 'site'
  else 'other'
end;

update public.crm_leads
set status = case status
  when 'unqualified' then 'disqualified'
  when 'archived' then 'lost'
  else status
end;

alter table public.crm_leads
  drop constraint if exists crm_leads_source_check,
  drop constraint if exists crm_leads_status_check,
  drop constraint if exists crm_leads_lead_type_check,
  drop constraint if exists crm_leads_company_size_check,
  drop constraint if exists crm_leads_contact_preference_check,
  drop constraint if exists crm_leads_priority_check,
  drop constraint if exists crm_leads_interaction_count_check,
  drop constraint if exists crm_leads_profile_payload_check,
  drop constraint if exists crm_leads_contact_required_check,
  drop constraint if exists crm_leads_primary_service_check;

alter table public.crm_leads
  alter column code set not null,
  alter column source set default 'other',
  alter column status set default 'new',
  add constraint crm_leads_lead_type_check check (lead_type in ('organization', 'person')),
  add constraint crm_leads_source_check check (source in (
    'site', 'online_form', 'whatsapp', 'phone', 'email', 'social', 'referral', 'prospecting', 'partner', 'other'
  )),
  add constraint crm_leads_status_check check (status in (
    'new', 'contact_pending', 'contacted', 'qualifying', 'qualified',
    'proposal_sent', 'negotiation', 'converted', 'lost', 'disqualified'
  )),
  add constraint crm_leads_company_size_check check (
    company_size is null or company_size in ('mei', 'micro', 'small', 'medium', 'large', 'other')
  ),
  add constraint crm_leads_contact_preference_check check (
    contact_preference is null or contact_preference in ('phone', 'whatsapp', 'email', 'no_preference')
  ),
  add constraint crm_leads_priority_check check (priority in ('low', 'medium', 'high', 'urgent')),
  add constraint crm_leads_interaction_count_check check (interaction_count >= 0),
  add constraint crm_leads_profile_payload_check check (
    (lead_type = 'person' and company_name is null and trade_name is null and company_size is null and website is null and contact_role is null)
    or
    (lead_type = 'organization' and birth_date is null and profession_activity is null)
  ),
  add constraint crm_leads_contact_required_check check (
    nullif(btrim(coalesce(phone, '')), '') is not null
    or nullif(btrim(coalesce(whatsapp, '')), '') is not null
    or nullif(btrim(coalesce(email, '')), '') is not null
  ),
  add constraint crm_leads_primary_service_check check (
    (service_line_id is not null and primary_service_other is null)
    or (service_line_id is null and nullif(btrim(coalesce(primary_service_other, '')), '') is not null)
  );

create unique index if not exists crm_leads_code_unique_idx on public.crm_leads(code);
create index if not exists crm_leads_tax_id_idx on public.crm_leads(tax_id) where tax_id is not null;
create index if not exists crm_leads_last_contact_idx on public.crm_leads(last_contact_at desc) where last_contact_at is not null;
create index if not exists crm_leads_next_action_idx on public.crm_leads(next_action_at) where next_action_at is not null;

create table if not exists public.crm_lead_services (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  service_line_id uuid references public.service_lines(id) on delete restrict,
  custom_service_name text,
  is_primary boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (
    (service_line_id is not null and custom_service_name is null)
    or (service_line_id is null and nullif(btrim(coalesce(custom_service_name, '')), '') is not null)
  )
);

create unique index if not exists crm_lead_services_official_unique_idx
  on public.crm_lead_services(lead_id, service_line_id)
  where service_line_id is not null;
create unique index if not exists crm_lead_services_custom_unique_idx
  on public.crm_lead_services(lead_id, lower(custom_service_name))
  where custom_service_name is not null;
create unique index if not exists crm_lead_services_primary_unique_idx
  on public.crm_lead_services(lead_id)
  where is_primary;
create index if not exists crm_lead_services_service_idx on public.crm_lead_services(service_line_id);

create table if not exists public.crm_lead_diagnostic_requests (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  service_line_id uuid references public.service_lines(id) on delete restrict,
  custom_service_name text,
  delivery_mode text not null check (delivery_mode in ('internal', 'external')),
  form_url text,
  status text not null default 'sent' check (status in ('sent', 'opened', 'completed', 'cancelled')),
  sent_at timestamptz not null default now(),
  sent_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  opened_at timestamptz,
  completed_at timestamptz,
  response_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  check (delivery_mode = 'internal' or nullif(btrim(coalesce(form_url, '')), '') is not null),
  check (
    (service_line_id is not null and custom_service_name is null)
    or (service_line_id is null and nullif(btrim(coalesce(custom_service_name, '')), '') is not null)
  )
);

create index if not exists crm_lead_diagnostics_lead_idx
  on public.crm_lead_diagnostic_requests(lead_id, sent_at desc);
create index if not exists crm_lead_diagnostics_status_idx
  on public.crm_lead_diagnostic_requests(status, sent_at desc);

create or replace function private.prepare_crm_lead_intake()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_services_unit_id uuid;
begin
  select id into v_services_unit_id
  from public.business_units
  where code = 'LANDERSERVICES' and status = 'active';

  if v_services_unit_id is null then
    raise exception 'A unidade LANDERSERVICES não está ativa.';
  end if;

  new.business_unit_id := v_services_unit_id;
  new.updated_by := auth.uid();

  if new.code is null or btrim(new.code) = '' then
    new.code := 'LEAD_' || upper(substr(replace(new.id::text, '-', ''), 1, 12));
  end if;

  if new.lead_type = 'person' then
    new.company_name := null;
    new.trade_name := null;
    new.company_size := null;
    new.website := null;
    new.contact_role := null;
  else
    new.birth_date := null;
    new.profession_activity := null;
  end if;

  if tg_op = 'INSERT' then
    new.last_interaction_at := new.last_contact_at;
    new.interaction_count := case when new.last_contact_at is null then 0 else 1 end;
  elsif new.last_contact_at is distinct from old.last_contact_at and new.last_contact_at is not null then
    new.last_interaction_at := greatest(coalesce(old.last_interaction_at, new.last_contact_at), new.last_contact_at);
    new.interaction_count := coalesce(old.interaction_count, 0) + 1;
  end if;

  return new;
end;
$$;

create or replace function private.validate_crm_lead_service_selection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead_unit_id uuid;
  v_service_unit_id uuid;
begin
  select business_unit_id into v_lead_unit_id from public.crm_leads where id = new.lead_id;
  if v_lead_unit_id is null then
    raise exception 'Lead inválido.';
  end if;

  if new.service_line_id is not null then
    select business_unit_id into v_service_unit_id from public.service_lines where id = new.service_line_id and status = 'active';
    if v_service_unit_id is distinct from v_lead_unit_id then
      raise exception 'O serviço selecionado não pertence à unidade LANDERSERVICES.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.sync_crm_lead_interaction_from_diagnostic()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.crm_leads
  set last_interaction_at = greatest(coalesce(last_interaction_at, new.sent_at), new.sent_at),
      interaction_count = interaction_count + 1,
      updated_by = new.sent_by
  where id = new.lead_id;
  return new;
end;
$$;

revoke all on function private.prepare_crm_lead_intake() from public, anon, authenticated;
revoke all on function private.validate_crm_lead_service_selection() from public, anon, authenticated;
revoke all on function private.sync_crm_lead_interaction_from_diagnostic() from public, anon, authenticated;

drop trigger if exists crm_leads_prepare_intake on public.crm_leads;
create trigger crm_leads_prepare_intake
before insert or update on public.crm_leads
for each row execute function private.prepare_crm_lead_intake();

drop trigger if exists crm_lead_services_validate on public.crm_lead_services;
create trigger crm_lead_services_validate
before insert or update on public.crm_lead_services
for each row execute function private.validate_crm_lead_service_selection();

drop trigger if exists crm_lead_diagnostics_validate on public.crm_lead_diagnostic_requests;
create trigger crm_lead_diagnostics_validate
before insert or update on public.crm_lead_diagnostic_requests
for each row execute function private.validate_crm_lead_service_selection();

drop trigger if exists crm_lead_diagnostics_touch on public.crm_lead_diagnostic_requests;
create trigger crm_lead_diagnostics_touch
before update on public.crm_lead_diagnostic_requests
for each row execute function private.touch_updated_at();

drop trigger if exists crm_lead_diagnostics_audit on public.crm_lead_diagnostic_requests;
create trigger crm_lead_diagnostics_audit
after insert or update or delete on public.crm_lead_diagnostic_requests
for each row execute function private.audit_row_change();

drop trigger if exists crm_lead_diagnostics_interaction on public.crm_lead_diagnostic_requests;
create trigger crm_lead_diagnostics_interaction
after insert on public.crm_lead_diagnostic_requests
for each row execute function private.sync_crm_lead_interaction_from_diagnostic();

drop policy if exists crm_leads_insert on public.crm_leads;
drop policy if exists crm_leads_update on public.crm_leads;
drop policy if exists crm_leads_delete on public.crm_leads;
create policy crm_leads_insert on public.crm_leads
for insert to authenticated
with check (
  private.current_user_has_permission('crm.leads.manage', private.unit_code_for_id(business_unit_id))
);
create policy crm_leads_update on public.crm_leads
for update to authenticated
using (
  private.current_user_has_permission('crm.leads.manage', private.unit_code_for_id(business_unit_id))
)
with check (
  private.current_user_has_permission('crm.leads.manage', private.unit_code_for_id(business_unit_id))
);
create policy crm_leads_delete on public.crm_leads
for delete to authenticated
using (
  private.current_user_has_permission('crm.leads.manage', private.unit_code_for_id(business_unit_id))
  and status in ('new', 'contact_pending', 'contacted', 'disqualified', 'lost')
);

alter table public.crm_lead_services enable row level security;
alter table public.crm_lead_diagnostic_requests enable row level security;

create policy crm_lead_services_select on public.crm_lead_services
for select to authenticated
using (exists (
  select 1 from public.crm_leads l
  where l.id = lead_id
    and private.current_user_has_permission('crm.read', private.unit_code_for_id(l.business_unit_id))
));
create policy crm_lead_services_manage on public.crm_lead_services
for all to authenticated
using (exists (
  select 1 from public.crm_leads l
  where l.id = lead_id
    and private.current_user_has_permission('crm.leads.manage', private.unit_code_for_id(l.business_unit_id))
))
with check (exists (
  select 1 from public.crm_leads l
  where l.id = lead_id
    and private.current_user_has_permission('crm.leads.manage', private.unit_code_for_id(l.business_unit_id))
));

create policy crm_lead_diagnostics_select on public.crm_lead_diagnostic_requests
for select to authenticated
using (exists (
  select 1 from public.crm_leads l
  where l.id = lead_id
    and private.current_user_has_permission('crm.read', private.unit_code_for_id(l.business_unit_id))
));
create policy crm_lead_diagnostics_manage on public.crm_lead_diagnostic_requests
for all to authenticated
using (exists (
  select 1 from public.crm_leads l
  where l.id = lead_id
    and private.current_user_has_permission('crm.leads.manage', private.unit_code_for_id(l.business_unit_id))
))
with check (exists (
  select 1 from public.crm_leads l
  where l.id = lead_id
    and private.current_user_has_permission('crm.leads.manage', private.unit_code_for_id(l.business_unit_id))
));

revoke all on public.crm_lead_services, public.crm_lead_diagnostic_requests from anon;
grant select, insert, update, delete on public.crm_lead_services, public.crm_lead_diagnostic_requests to authenticated;

commit;
