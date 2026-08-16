create or replace function public.admin_transition_integration_connection(
  p_connection_id uuid,
  p_expected_version integer,
  p_target_status text,
  p_reason text,
  p_actor_user_id uuid
)
returns public.integration_connections
language plpgsql
security definer
set search_path=''
as $$
declare
  v_row public.integration_connections%rowtype;
  v_previous text;
  v_allowed boolean;
begin
  if auth.role()<>'service_role' and current_user<>'postgres' then raise exception 'Unauthorized.'; end if;
  if p_target_status not in ('active','paused','archived') then raise exception 'Invalid target status.'; end if;

  select * into v_row from public.integration_connections where id=p_connection_id for update;
  if not found or v_row.version<>p_expected_version then return null; end if;

  v_previous:=v_row.status;
  v_allowed :=
    (v_previous='draft' and p_target_status in ('active','archived'))
    or (v_previous in ('active','error') and p_target_status in ('paused','archived'))
    or (v_previous='paused' and p_target_status in ('active','archived'));
  if not v_allowed then raise exception 'The requested connection transition is not allowed.'; end if;
  if p_target_status='archived' and length(trim(coalesce(p_reason,'')))<3 then raise exception 'A formal reason is required.'; end if;
  if p_target_status='active' and (v_row.external_account_reference is null or v_row.secret_reference is null) then
    raise exception 'External account and secret reference are required before activation.';
  end if;

  update public.integration_connections
  set status=p_target_status,
      last_error=case when p_target_status='active' then null else last_error end,
      configuration=configuration || jsonb_build_object(
        'last_transition_reason',nullif(trim(p_reason),''),
        'last_transition_by',p_actor_user_id
      )
  where id=p_connection_id and version=p_expected_version
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.admin_transition_integration_webhook(
  p_endpoint_id uuid,
  p_expected_version integer,
  p_target_status text,
  p_actor_user_id uuid
)
returns public.integration_webhook_endpoints
language plpgsql
security definer
set search_path=''
as $$
declare
  v_row public.integration_webhook_endpoints%rowtype;
  v_connection_status text;
begin
  if auth.role()<>'service_role' and current_user<>'postgres' then raise exception 'Unauthorized.'; end if;
  if p_target_status not in ('active','paused','archived') then raise exception 'Invalid target status.'; end if;

  select * into v_row from public.integration_webhook_endpoints where id=p_endpoint_id for update;
  if not found or v_row.version<>p_expected_version then return null; end if;

  select status into v_connection_status from public.integration_connections where id=v_row.connection_id;
  if p_target_status='active' and (v_connection_status<>'active' or v_row.signing_secret_reference is null) then
    raise exception 'An active connection and signing secret reference are required.';
  end if;

  update public.integration_webhook_endpoints
  set status=p_target_status
  where id=p_endpoint_id and version=p_expected_version
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.admin_transition_integration_job(
  p_job_id uuid,
  p_expected_version integer,
  p_action text,
  p_reason text,
  p_actor_user_id uuid
)
returns public.integration_sync_jobs
language plpgsql
security definer
set search_path=''
as $$
declare
  v_row public.integration_sync_jobs%rowtype;
begin
  if auth.role()<>'service_role' and current_user<>'postgres' then raise exception 'Unauthorized.'; end if;
  if p_action not in ('retry','cancel','dead_letter') then raise exception 'Invalid job action.'; end if;

  select * into v_row from public.integration_sync_jobs where id=p_job_id for update;
  if not found or v_row.version<>p_expected_version then return null; end if;

  if p_action='retry' and v_row.status not in ('failed','dead_letter') then raise exception 'Only failed or dead-letter jobs can be retried.'; end if;
  if p_action='cancel' and v_row.status not in ('queued','failed') then raise exception 'Only queued or failed jobs can be cancelled.'; end if;
  if p_action='dead_letter' and v_row.status<>'failed' then raise exception 'Only failed jobs can be moved to dead-letter.'; end if;
  if p_action in ('cancel','dead_letter') and length(trim(coalesce(p_reason,'')))<3 then raise exception 'A formal reason is required.'; end if;

  update public.integration_sync_jobs
  set status=case p_action when 'retry' then 'queued' when 'cancel' then 'cancelled' else 'dead_letter' end,
      scheduled_for=case when p_action='retry' then now() else scheduled_for end,
      next_retry_at=null,
      last_error=case when p_action='retry' then null else concat_ws(E'\n',last_error,p_action||': '||trim(p_reason)) end,
      result_metadata=result_metadata || jsonb_build_object(
        'administrative_action',p_action,
        'reason',nullif(trim(p_reason),''),
        'actor_user_id',p_actor_user_id
      )
  where id=p_job_id and version=p_expected_version
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.admin_transition_integration_event(
  p_event_id bigint,
  p_action text,
  p_reason text,
  p_actor_user_id uuid
)
returns public.integration_events
language plpgsql
security definer
set search_path=''
as $$
declare
  v_row public.integration_events%rowtype;
begin
  if auth.role()<>'service_role' and current_user<>'postgres' then raise exception 'Unauthorized.'; end if;
  if p_action not in ('retry','ignore','dead_letter') then raise exception 'Invalid event action.'; end if;

  select * into v_row from public.integration_events where id=p_event_id for update;
  if not found then return null; end if;

  if p_action='retry' and v_row.status not in ('failed','dead_letter') then raise exception 'Only failed or dead-letter events can be retried.'; end if;
  if p_action in ('ignore','dead_letter') and length(trim(coalesce(p_reason,'')))<3 then raise exception 'A formal reason is required.'; end if;

  update public.integration_events
  set status=case p_action when 'retry' then 'pending' when 'ignore' then 'ignored' else 'dead_letter' end,
      next_retry_at=case when p_action='retry' then now() else null end,
      last_error=case when p_action='retry' then null else concat_ws(E'\n',last_error,p_action||': '||trim(p_reason)) end,
      metadata=metadata || jsonb_build_object(
        'administrative_action',p_action,
        'reason',nullif(trim(p_reason),''),
        'actor_user_id',p_actor_user_id
      )
  where id=p_event_id
  returning * into v_row;
  return v_row;
end $$;

revoke all on function public.admin_transition_integration_connection(uuid,integer,text,text,uuid),public.admin_transition_integration_webhook(uuid,integer,text,uuid),public.admin_transition_integration_job(uuid,integer,text,text,uuid),public.admin_transition_integration_event(bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_transition_integration_connection(uuid,integer,text,text,uuid),public.admin_transition_integration_webhook(uuid,integer,text,uuid),public.admin_transition_integration_job(uuid,integer,text,text,uuid),public.admin_transition_integration_event(bigint,text,text,uuid) to service_role;
