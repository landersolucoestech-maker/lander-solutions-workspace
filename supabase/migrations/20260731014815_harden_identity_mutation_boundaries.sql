revoke insert, update, delete on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, mfa_required, last_seen_at) on table public.profiles to authenticated;

revoke insert, update, delete on table public.user_role_assignments from authenticated;
grant select on table public.user_role_assignments to authenticated;

create or replace function private.protect_owner_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_owner boolean;
  v_active_owner_count integer;
begin
  select exists (
    select 1
    from public.user_role_assignments ura
    join public.app_roles r on r.id = ura.role_id
    where ura.user_id = old.id
      and ura.status = 'active'
      and r.code = 'owner'
  ) into v_is_owner;

  if not v_is_owner then
    return new;
  end if;

  if new.mfa_required is false then
    raise exception 'MFA cannot be disabled for an active owner.';
  end if;

  if new.status <> 'active' then
    select count(*)
    into v_active_owner_count
    from public.user_role_assignments ura
    join public.app_roles r on r.id = ura.role_id
    join public.profiles p on p.id = ura.user_id
    where ura.status = 'active'
      and r.code = 'owner'
      and p.status = 'active';

    if v_active_owner_count <= 1 then
      raise exception 'The last active owner cannot be suspended or inactivated.';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function private.protect_owner_profile() from public, anon, authenticated;

create trigger profiles_protect_owner
before update of status, mfa_required on public.profiles
for each row execute function private.protect_owner_profile();

create or replace function private.protect_owner_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_role_id uuid;
  v_active_owner_count integer;
  v_removes_owner boolean;
begin
  select id into v_owner_role_id
  from public.app_roles
  where code = 'owner';

  if old.role_id <> v_owner_role_id or old.status <> 'active' then
    return coalesce(new, old);
  end if;

  v_removes_owner := tg_op = 'DELETE'
    or new.status <> 'active'
    or new.role_id <> old.role_id;

  if not v_removes_owner then
    return new;
  end if;

  select count(*)
  into v_active_owner_count
  from public.user_role_assignments ura
  join public.app_roles r on r.id = ura.role_id
  join public.profiles p on p.id = ura.user_id
  where ura.status = 'active'
    and r.code = 'owner'
    and p.status = 'active';

  if v_active_owner_count <= 1 then
    raise exception 'The last active owner assignment cannot be removed.';
  end if;

  return coalesce(new, old);
end;
$$;

revoke execute on function private.protect_owner_assignment() from public, anon, authenticated;

create trigger assignments_protect_owner
before update or delete on public.user_role_assignments
for each row execute function private.protect_owner_assignment();
