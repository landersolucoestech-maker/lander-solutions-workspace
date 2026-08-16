begin;

create extension if not exists pgtap with schema extensions;

select plan(27);

select has_table('public', 'agenda_events', 'agenda owns its canonical events table');
select has_table('public', 'agenda_event_attendees', 'agenda owns its canonical attendees table');
select col_is_fk('public', 'agenda_events', 'business_unit_id', 'events reuse business units by reference');
select col_is_fk('public', 'agenda_events', 'party_id', 'events reuse parties by reference');
select col_is_fk('public', 'agenda_events', 'contract_id', 'events reuse contracts by reference');
select col_is_fk('public', 'agenda_events', 'organizer_user_id', 'events reuse profiles by reference');

select is(
  (select count(*)::integer from public.permissions where code in ('agenda.read', 'agenda.manage') and module = 'agenda'),
  2,
  'agenda exposes the minimal canonical permission set'
);

select policies_are(
  'public', 'agenda_events',
  array['agenda_events_delete', 'agenda_events_insert', 'agenda_events_select', 'agenda_events_update'],
  'events expose separate authenticated CRUD policies'
);

select policies_are(
  'public', 'agenda_event_attendees',
  array['agenda_attendees_delete', 'agenda_attendees_insert', 'agenda_attendees_select', 'agenda_attendees_update'],
  'attendees inherit event authorization through separate policies'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename in ('agenda_events', 'agenda_event_attendees')
      and 'anon' = any(roles)
  ),
  0,
  'agenda does not open an anonymous RLS policy'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('agenda_events', 'agenda_event_attendees')
      and grantee = 'anon'
  ),
  0,
  'anon has no table privilege on agenda data'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', 'ae000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'agenda-manager@test.local', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'ae000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'agenda-reader@test.local', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'ae000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'agenda-denied@test.local', '', now(), '{}', '{}', now(), now(), '', '', '', '');

update public.profiles
set status = 'active', mfa_required = false
where id in (
  'ae000000-0000-4000-8000-000000000001',
  'ae000000-0000-4000-8000-000000000002',
  'ae000000-0000-4000-8000-000000000003'
);

insert into public.user_role_assignments(user_id, role_id)
select 'ae000000-0000-4000-8000-000000000001', id from public.app_roles where code = 'owner';
insert into public.user_role_assignments(user_id, role_id)
select 'ae000000-0000-4000-8000-000000000002', id from public.app_roles where code = 'readonly';
insert into public.user_role_assignments(user_id, role_id)
select 'ae000000-0000-4000-8000-000000000003', id from public.app_roles where code = 'employee';

insert into auth.sessions(id, user_id, created_at, updated_at) values
  ('ae100000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-000000000001', now(), now()),
  ('ae100000-0000-4000-8000-000000000002', 'ae000000-0000-4000-8000-000000000002', now(), now()),
  ('ae100000-0000-4000-8000-000000000003', 'ae000000-0000-4000-8000-000000000003', now(), now());

select ok(
  private.user_has_permission('ae000000-0000-4000-8000-000000000001', 'agenda.manage', null),
  'agenda manager owns agenda.manage'
);
select ok(
  private.user_has_permission('ae000000-0000-4000-8000-000000000002', 'agenda.read', null),
  'agenda reader owns agenda.read'
);
select ok(
  not private.user_has_permission('ae000000-0000-4000-8000-000000000002', 'agenda.manage', null),
  'agenda reader does not inherit agenda.manage'
);
select ok(
  not private.user_has_permission('ae000000-0000-4000-8000-000000000003', 'agenda.read', null),
  'unrelated employee does not inherit agenda access'
);

do $$
begin
  perform set_config('test.agenda_business_unit_id', (select id::text from public.business_units order by created_at limit 1), true);
end;
$$;

set local request.jwt.claims = '{"sub":"ae000000-0000-4000-8000-000000000001","session_id":"ae100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select lives_ok(
  $$
    insert into public.agenda_events (
      id, title, event_type, starts_at, ends_at, visibility,
      organizer_user_id, business_unit_id, created_by
    ) values (
      'ae200000-0000-4000-8000-000000000001', 'Reunião operacional', 'meeting',
      now() + interval '1 day', now() + interval '1 day 1 hour', 'unit',
      'ae000000-0000-4000-8000-000000000001',
      current_setting('test.agenda_business_unit_id')::uuid,
      'ae000000-0000-4000-8000-000000000001'
    )
  $$,
  'agenda.manage with AAL2 creates a scoped event through RLS'
);

select throws_ok(
  $$
    insert into public.agenda_events (
      title, starts_at, ends_at, visibility, organizer_user_id, created_by
    ) values (
      'Período inválido', now() + interval '2 hours', now() + interval '1 hour', 'corporate',
      'ae000000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-000000000001'
    )
  $$,
  '23514', null,
  'database rejects an invalid event period'
);

select throws_ok(
  $$
    insert into public.agenda_events (
      title, starts_at, ends_at, visibility, organizer_user_id, created_by
    ) values (
      'Escopo inválido', now(), now() + interval '1 hour', 'unit',
      'ae000000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-000000000001'
    )
  $$,
  '23514', null,
  'database rejects unit visibility without a business unit'
);

select lives_ok(
  $$
    insert into public.agenda_event_attendees(event_id, profile_id, created_by)
    values (
      'ae200000-0000-4000-8000-000000000001',
      'ae000000-0000-4000-8000-000000000002',
      'ae000000-0000-4000-8000-000000000001'
    )
  $$,
  'manager adds a real profile attendee'
);

select lives_ok(
  $$
    update public.agenda_events
    set status = 'confirmed'
    where id = 'ae200000-0000-4000-8000-000000000001' and version = 1
  $$,
  'manager updates event workflow state with optimistic versioning'
);

select throws_ok(
  $$delete from public.agenda_events where id = 'ae200000-0000-4000-8000-000000000001'$$,
  '23514', null,
  'confirmed event cannot be deleted before cancellation'
);

reset role;

select is(
  (select version::integer from public.agenda_events where id = 'ae200000-0000-4000-8000-000000000001'),
  2,
  'canonical touch trigger increments the event version'
);
select is(
  (select count(*)::integer from public.audit_events where entity_table in ('agenda_events', 'agenda_event_attendees')),
  3,
  'agenda event, attendee and workflow mutation are audited'
);

set local request.jwt.claims = '{"sub":"ae000000-0000-4000-8000-000000000002","session_id":"ae100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
set local role authenticated;

select is(
  (select count(*)::integer from public.agenda_events where id = 'ae200000-0000-4000-8000-000000000001'),
  1,
  'agenda.read sees an authorized unit event'
);
select lives_ok(
  $$
    update public.agenda_events set status = 'cancelled'
    where id = 'ae200000-0000-4000-8000-000000000001'
  $$,
  'read-only RLS safely filters an unauthorized update'
);

reset role;
select is(
  (select status from public.agenda_events where id = 'ae200000-0000-4000-8000-000000000001'),
  'confirmed',
  'read-only user cannot mutate the event'
);

set local request.jwt.claims = '{"sub":"ae000000-0000-4000-8000-000000000001","session_id":"ae100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select lives_ok(
  $$
    update public.agenda_events set status = 'cancelled'
    where id = 'ae200000-0000-4000-8000-000000000001';
    delete from public.agenda_events
    where id = 'ae200000-0000-4000-8000-000000000001'
  $$,
  'cancelled event can be deleted by an authorized manager'
);

reset role;

select * from finish();

rollback;
