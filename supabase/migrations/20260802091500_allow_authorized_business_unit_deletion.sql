create or replace function private.protect_business_unit_system_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_system and new.code <> old.code then
    raise exception 'The code of a system business unit cannot be changed.';
  end if;
  return new;
end;
$$;

revoke all on function private.protect_business_unit_system_code() from public, anon, authenticated;

drop trigger if exists business_units_protect_system on public.business_units;
create trigger business_units_protect_system
before update on public.business_units
for each row execute function private.protect_business_unit_system_code();
