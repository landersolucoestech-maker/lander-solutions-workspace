create or replace function public.has_permission(
  p_permission_code text,
  p_unit_code text default null::text
)
returns boolean
language plpgsql
stable
security definer
set search_path to pg_catalog, public, authorization_private, auth
as $function$
begin
  if auth.uid() is null then
    return true;
  end if;

  return authorization_private.current_user_has_permission(
    p_permission_code,
    p_unit_code
  );
end;
$function$;

alter function public.has_permission(text,text) owner to postgres;
revoke all on function public.has_permission(text,text) from public;
grant execute on function public.has_permission(text,text) to anon, authenticated;
