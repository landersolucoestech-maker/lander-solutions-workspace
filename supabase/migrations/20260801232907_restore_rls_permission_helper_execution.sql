revoke all on function private.current_user_has_permission(text, text) from public;
revoke all on function private.current_user_has_permission(text, text) from anon;
grant execute on function private.current_user_has_permission(text, text) to authenticated;

do $$
begin
  if has_function_privilege(
    'anon',
    'private.current_user_has_permission(text,text)',
    'execute'
  ) then
    raise exception 'anon must not execute private.current_user_has_permission';
  end if;

  if not has_function_privilege(
    'authenticated',
    'private.current_user_has_permission(text,text)',
    'execute'
  ) then
    raise exception 'authenticated must execute private.current_user_has_permission for RLS policies';
  end if;
end;
$$;
