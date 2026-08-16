revoke execute on all functions in schema private from public, anon, authenticated;

revoke all on table public.audit_events from authenticated;
revoke all on sequence public.audit_events_id_seq from authenticated;
grant select on table public.audit_events to authenticated;

grant execute on function private.current_session_exists() to authenticated;
grant execute on function private.current_user_is_active() to authenticated;
grant execute on function private.current_user_has_permission(text, text) to authenticated;
grant execute on function private.current_user_has_aal2() to authenticated;
grant execute on function private.bootstrap_first_owner(uuid) to service_role;

alter default privileges in schema private
  revoke execute on functions from public, anon, authenticated;
