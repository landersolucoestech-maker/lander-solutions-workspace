create or replace function private.enforce_agenda_event_deletion_rule()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status <> 'cancelled' then
    raise exception 'Only cancelled agenda events can be deleted.' using errcode = '23514';
  end if;
  return old;
end;
$$;

revoke all on function private.enforce_agenda_event_deletion_rule() from public, anon, authenticated;

create trigger agenda_events_deletion_rule
before delete on public.agenda_events
for each row execute function private.enforce_agenda_event_deletion_rule();

comment on function private.enforce_agenda_event_deletion_rule() is
  'Agenda events must be cancelled before deletion; RLS still requires agenda.manage and AAL2.';
