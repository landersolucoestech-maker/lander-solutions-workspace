create table private.support_rate_limits(
  actor_user_id uuid not null,
  action text not null,
  bucket_started_at timestamptz not null,
  request_count integer not null default 0 check(request_count>=0),
  updated_at timestamptz not null default now(),
  primary key(actor_user_id,action,bucket_started_at)
);

create or replace function public.support_enforce_rate_limit(p_actor_user_id uuid,p_action text,p_limit integer)
returns void language plpgsql security definer set search_path=''
as $$
declare v_bucket timestamptz:=date_trunc('minute',now());v_count integer;
begin
  if p_actor_user_id is null or nullif(btrim(p_action),'') is null or p_limit<1 then raise exception 'Parâmetros de rate limit inválidos.';end if;
  insert into private.support_rate_limits(actor_user_id,action,bucket_started_at,request_count)
  values(p_actor_user_id,p_action,v_bucket,1)
  on conflict(actor_user_id,action,bucket_started_at) do update set request_count=private.support_rate_limits.request_count+1,updated_at=now()
  returning request_count into v_count;
  if v_count>p_limit then raise exception 'RATE_LIMIT: limite de requisições excedido.';end if;
  delete from private.support_rate_limits where bucket_started_at<now()-interval '2 hours';
end$$;

revoke all on table private.support_rate_limits from public,anon,authenticated;
revoke all on function public.support_enforce_rate_limit(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.support_enforce_rate_limit(uuid,text,integer) to service_role;
