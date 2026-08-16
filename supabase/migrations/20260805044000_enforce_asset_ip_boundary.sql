-- Corporate assets represent physical/digital operational patrimony and licenses.
-- Intellectual-property rights belong exclusively to the IP domain.

create or replace function private.enforce_corporate_asset_domain()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if lower(new.asset_type) in (
    'trademark','copyright','patent','industrial_design','utility_model',
    'plant_variety','trade_secret','intellectual_property','work','phonogram',
    'composition','master_recording','brand'
  ) then
    raise exception 'Tipo % pertence ao módulo de Propriedade Intelectual.',new.asset_type
      using errcode='23514';
  end if;
  return new;
end;
$$;

drop trigger if exists corporate_assets_enforce_domain on public.corporate_assets;
create trigger corporate_assets_enforce_domain
before insert or update of asset_type on public.corporate_assets
for each row execute function private.enforce_corporate_asset_domain();

revoke all on function private.enforce_corporate_asset_domain()
from public,anon,authenticated,service_role;

comment on function private.enforce_corporate_asset_domain() is
  'Rejects intellectual-property categories from the corporate patrimony ledger.';
