create schema if not exists authorization_private;

revoke all on schema authorization_private from public,anon,authenticated,service_role;
grant usage on schema authorization_private to authenticated,service_role;

create or replace function authorization_private.current_user_has_permission(
  p_permission_code text,
  p_unit_code text default null
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select
    private.current_session_exists()
    and private.current_user_is_active()
    and exists (
      select 1
      from public.user_role_assignments ura
      join public.role_permissions rp on rp.role_id=ura.role_id
      join public.permissions perm on perm.id=rp.permission_id
      where ura.user_id=auth.uid()
        and ura.status='active'
        and ura.valid_from<=now()
        and (ura.valid_until is null or ura.valid_until>now())
        and perm.code=p_permission_code
        and (
          p_unit_code is null
          or ura.unit_code is null
          or ura.unit_code=p_unit_code
        )
    );
$$;

revoke all on function authorization_private.current_user_has_permission(text,text)
from public,anon;
grant execute on function authorization_private.current_user_has_permission(text,text)
to authenticated,service_role;

create or replace function public.has_permission(
  p_permission_code text,
  p_unit_code text default null
)
returns boolean
language sql
stable
security invoker
set search_path=''
as $$
  select authorization_private.current_user_has_permission(
    p_permission_code,
    p_unit_code
  );
$$;

revoke all on function public.has_permission(text,text) from public,anon;
grant execute on function public.has_permission(text,text) to authenticated,service_role;

revoke execute on function private.current_user_has_permission(text,text)
from authenticated;
