create sequence if not exists private.business_unit_code_seq start with 1 increment by 1;

create or replace function private.assign_business_unit_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text;
  v_candidate text;
begin
  if new.code is not null and btrim(new.code) <> '' then
    return new;
  end if;

  v_prefix := case new.unit_type
    when 'administrative' then 'ADM'
    when 'product' then 'PRD'
    when 'services' then 'SRV'
    else 'UNT'
  end;

  loop
    v_candidate := v_prefix || '_' || lpad(nextval('private.business_unit_code_seq')::text, 6, '0');
    exit when not exists (
      select 1
      from public.business_units
      where code = v_candidate
    );
  end loop;

  new.code := v_candidate;
  return new;
end;
$$;

revoke all on function private.assign_business_unit_code() from public, anon, authenticated;

drop trigger if exists business_units_assign_code on public.business_units;
create trigger business_units_assign_code
before insert on public.business_units
for each row
execute function private.assign_business_unit_code();

comment on function private.assign_business_unit_code() is
  'Generates immutable internal business-unit codes when the client omits the code.';
