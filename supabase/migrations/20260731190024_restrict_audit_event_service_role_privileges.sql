revoke all privileges on table public.audit_events from service_role;
grant select on table public.audit_events to service_role;
revoke all privileges on sequence public.audit_events_id_seq from anon, authenticated, service_role;
