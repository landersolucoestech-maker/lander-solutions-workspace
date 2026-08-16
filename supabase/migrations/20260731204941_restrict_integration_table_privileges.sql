revoke all privileges on public.integration_connections,public.integration_webhook_endpoints,public.integration_events,public.integration_sync_jobs,public.integration_job_attempts from authenticated,service_role;

grant select,insert,update,delete on public.integration_connections,public.integration_webhook_endpoints to authenticated;
grant select on public.integration_events,public.integration_job_attempts to authenticated;
grant select,insert on public.integration_sync_jobs to authenticated;

grant select,insert,update,delete on public.integration_connections,public.integration_webhook_endpoints,public.integration_events,public.integration_sync_jobs to service_role;
grant select,insert on public.integration_job_attempts to service_role;

grant usage,select on sequence public.integration_events_id_seq,public.integration_job_attempts_id_seq to service_role;
