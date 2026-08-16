insert into public.permissions (code, module, action, description)
values
  ('agenda.read', 'agenda', 'read', 'Consultar eventos e participantes da agenda corporativa.'),
  ('agenda.manage', 'agenda', 'manage', 'Criar, alterar e cancelar eventos da agenda corporativa.')
on conflict (code) do update
set module = excluded.module,
    action = excluded.action,
    description = excluded.description;

with grants(role_code, permission_code) as (
  values
    ('owner', 'agenda.read'), ('owner', 'agenda.manage'),
    ('corporate_admin', 'agenda.read'), ('corporate_admin', 'agenda.manage'),
    ('unit_manager', 'agenda.read'), ('unit_manager', 'agenda.manage'),
    ('legal', 'agenda.read'), ('compliance', 'agenda.read'),
    ('contract_manager', 'agenda.read'), ('commercial', 'agenda.read'),
    ('finance_manager', 'agenda.read'), ('auditor', 'agenda.read'),
    ('executive_readonly', 'agenda.read'), ('readonly', 'agenda.read')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from grants g
join public.app_roles r on r.code = g.role_code
join public.permissions p on p.code = g.permission_code
on conflict do nothing;

create table public.agenda_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 240),
  description text check (description is null or char_length(description) <= 8000),
  event_type text not null default 'meeting' check (event_type in (
    'meeting', 'appointment', 'deadline', 'task', 'reminder', 'other'
  )),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'America/Sao_Paulo' check (char_length(btrim(timezone)) between 1 and 100),
  all_day boolean not null default false,
  location text check (location is null or char_length(location) <= 500),
  meeting_url text check (meeting_url is null or char_length(meeting_url) <= 2000),
  status text not null default 'scheduled' check (status in (
    'scheduled', 'confirmed', 'completed', 'cancelled'
  )),
  visibility text not null default 'unit' check (visibility in ('private', 'unit', 'corporate')),
  organizer_user_id uuid not null references public.profiles(id) on delete restrict,
  legal_entity_id uuid references public.legal_entities(id) on delete restrict,
  business_unit_id uuid references public.business_units(id) on delete restrict,
  party_id uuid references public.parties(id) on delete set null,
  contract_id uuid references public.contracts(id) on delete set null,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (visibility <> 'unit' or business_unit_id is not null)
);

create table public.agenda_event_attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.agenda_events(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete restrict,
  party_id uuid references public.parties(id) on delete restrict,
  attendee_name text check (attendee_name is null or char_length(btrim(attendee_name)) between 1 and 240),
  attendee_email text check (
    attendee_email is null or attendee_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  attendee_role text not null default 'required' check (attendee_role in ('required', 'optional')),
  response_status text not null default 'pending' check (response_status in (
    'pending', 'accepted', 'declined', 'tentative'
  )),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(profile_id, party_id, attendee_email) >= 1)
);

create index agenda_events_period_idx on public.agenda_events(starts_at, ends_at);
create index agenda_events_business_unit_idx on public.agenda_events(business_unit_id, starts_at);
create index agenda_events_organizer_idx on public.agenda_events(organizer_user_id, starts_at);
create index agenda_events_party_idx on public.agenda_events(party_id) where party_id is not null;
create index agenda_events_contract_idx on public.agenda_events(contract_id) where contract_id is not null;
create index agenda_attendees_event_idx on public.agenda_event_attendees(event_id);
create index agenda_attendees_profile_idx on public.agenda_event_attendees(profile_id) where profile_id is not null;
create unique index agenda_attendees_event_profile_unique
  on public.agenda_event_attendees(event_id, profile_id) where profile_id is not null;
create unique index agenda_attendees_event_party_unique
  on public.agenda_event_attendees(event_id, party_id) where party_id is not null;
create unique index agenda_attendees_event_email_unique
  on public.agenda_event_attendees(event_id, lower(attendee_email)) where attendee_email is not null;

create or replace function private.agenda_event_unit_code(p_business_unit_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select bu.code from public.business_units bu where bu.id = p_business_unit_id;
$$;

create or replace function private.current_user_can_read_agenda_event(p_event public.agenda_events)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.current_user_has_permission(
      'agenda.read',
      private.agenda_event_unit_code(p_event.business_unit_id)
    )
    and (
      p_event.visibility <> 'private'
      or p_event.organizer_user_id = auth.uid()
      or exists (
        select 1
        from public.agenda_event_attendees attendee
        where attendee.event_id = p_event.id
          and attendee.profile_id = auth.uid()
      )
    );
$$;

create or replace function private.current_user_can_manage_agenda_event(p_event public.agenda_events)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.current_user_has_permission(
      'agenda.manage',
      private.agenda_event_unit_code(p_event.business_unit_id)
    )
    and private.current_user_has_aal2();
$$;

create or replace function private.preserve_agenda_creation_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.agenda_event_unit_code(uuid) from public, anon, authenticated;
revoke all on function private.current_user_can_read_agenda_event(public.agenda_events) from public, anon, authenticated;
revoke all on function private.current_user_can_manage_agenda_event(public.agenda_events) from public, anon, authenticated;
revoke all on function private.preserve_agenda_creation_fields() from public, anon, authenticated;

alter table public.agenda_events enable row level security;
alter table public.agenda_event_attendees enable row level security;

create policy agenda_events_select on public.agenda_events
for select to authenticated
using (private.current_user_can_read_agenda_event(agenda_events));

create policy agenda_events_insert on public.agenda_events
for insert to authenticated
with check (
  created_by = auth.uid()
  and private.current_user_can_manage_agenda_event(agenda_events)
);

create policy agenda_events_update on public.agenda_events
for update to authenticated
using (private.current_user_can_manage_agenda_event(agenda_events))
with check (
  private.current_user_can_manage_agenda_event(agenda_events)
);

create policy agenda_events_delete on public.agenda_events
for delete to authenticated
using (private.current_user_can_manage_agenda_event(agenda_events));

create policy agenda_attendees_select on public.agenda_event_attendees
for select to authenticated
using (
  exists (
    select 1 from public.agenda_events event
    where event.id = agenda_event_attendees.event_id
      and private.current_user_can_read_agenda_event(event)
  )
);

create policy agenda_attendees_insert on public.agenda_event_attendees
for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.agenda_events event
    where event.id = agenda_event_attendees.event_id
      and private.current_user_can_manage_agenda_event(event)
  )
);

create policy agenda_attendees_update on public.agenda_event_attendees
for update to authenticated
using (
  exists (
    select 1 from public.agenda_events event
    where event.id = agenda_event_attendees.event_id
      and private.current_user_can_manage_agenda_event(event)
  )
)
with check (
  exists (
    select 1 from public.agenda_events event
    where event.id = agenda_event_attendees.event_id
      and private.current_user_can_manage_agenda_event(event)
  )
);

create policy agenda_attendees_delete on public.agenda_event_attendees
for delete to authenticated
using (
  exists (
    select 1 from public.agenda_events event
    where event.id = agenda_event_attendees.event_id
      and private.current_user_can_manage_agenda_event(event)
  )
);

grant select, insert, update, delete on public.agenda_events to authenticated;
grant select, insert, update, delete on public.agenda_event_attendees to authenticated;

create trigger agenda_events_touch before update on public.agenda_events
for each row execute function private.touch_updated_at();
create trigger agenda_events_preserve_creation before update on public.agenda_events
for each row execute function private.preserve_agenda_creation_fields();
create trigger agenda_events_audit after insert or update or delete on public.agenda_events
for each row execute function private.audit_row_change();
create trigger agenda_event_attendees_touch before update on public.agenda_event_attendees
for each row execute function private.touch_updated_at();
create trigger agenda_event_attendees_preserve_creation before update on public.agenda_event_attendees
for each row execute function private.preserve_agenda_creation_fields();
create trigger agenda_event_attendees_audit after insert or update or delete on public.agenda_event_attendees
for each row execute function private.audit_row_change();
