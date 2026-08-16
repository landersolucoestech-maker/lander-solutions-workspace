revoke all on table public.agenda_events from anon;
revoke all on table public.agenda_event_attendees from anon;

grant execute on function private.current_user_can_read_agenda_event(public.agenda_events) to authenticated;
grant execute on function private.current_user_can_manage_agenda_event(public.agenda_events) to authenticated;
