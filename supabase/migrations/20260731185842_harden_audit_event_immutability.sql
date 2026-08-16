create or replace function private.prevent_audit_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Audit events are immutable and cannot be %.', lower(tg_op);
end
$$;

revoke all on function private.prevent_audit_event_mutation() from public, anon, authenticated, service_role;

create trigger audit_events_immutable
before update or delete on public.audit_events
for each row execute function private.prevent_audit_event_mutation();

revoke insert, update, delete, truncate on public.audit_events from service_role;
grant select on public.audit_events to service_role;
