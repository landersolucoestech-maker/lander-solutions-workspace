create or replace function public.has_permission(
  p_permission_code text,
  p_unit_code text default null
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.current_user_has_permission(p_permission_code, p_unit_code);
$$;

create or replace function public.has_aal2()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.current_user_has_aal2();
$$;

revoke execute on function public.has_permission(text, text) from public, anon;
revoke execute on function public.has_aal2() from public, anon;
grant execute on function public.has_permission(text, text) to authenticated;
grant execute on function public.has_aal2() to authenticated;
