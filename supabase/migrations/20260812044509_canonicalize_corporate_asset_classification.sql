-- Canonical corporate-asset classification:
--   asset_category = broad operational family used for navigation and ownership.
--   asset_type     = validated technical subtype inside that family.
-- Intellectual-property rights remain exclusively in intellectual_property_assets.

do $$
begin
  if exists (
    select 1
    from public.corporate_assets
    where lower(btrim(asset_type)) in (
      'trademark','copyright','patent','industrial_design','utility_model',
      'plant_variety','trade_secret','intellectual_property','work','phonogram',
      'composition','master_recording','brand','contractual_right'
    )
    or lower(btrim(asset_category)) in (
      'trademark','copyright','patent','industrial_design','utility_model',
      'plant_variety','trade_secret','intellectual_property','work','phonogram',
      'composition','master_recording','brand','contractual_right'
    )
  ) then
    raise exception 'corporate_assets contains intellectual-property classifications; migrate them to the IP domain before applying this migration.';
  end if;
end;
$$;

-- Normalize historical values introduced when asset_category was initially
-- backfilled from asset_type and by the first Assets form.
update public.corporate_assets
set
  asset_category = case lower(btrim(asset_category))
    when 'equipment' then 'equipment'
    when 'computer' then 'equipment'
    when 'mobile_device' then 'equipment'
    when 'audiovisual_equipment' then 'equipment'
    when 'vehicle' then 'vehicle'
    when 'furniture' then 'furniture'
    when 'software' then 'license'
    when 'software_license' then 'license'
    when 'certificate' then 'license'
    when 'digital_certificate' then 'license'
    when 'subscription' then 'digital_service'
    when 'domain' then 'digital_service'
    when 'insurance' then 'insurance'
    when 'intangible' then 'other'
    else lower(btrim(asset_category))
  end,
  asset_type = case
    when lower(btrim(asset_category)) = 'subscription' then 'subscription_license'
    when lower(btrim(asset_category)) = 'insurance' then 'insurance_policy'
    when lower(btrim(asset_category)) = 'certificate' then 'digital_certificate'
    when lower(btrim(asset_category)) = 'software' then 'software_license'
    when lower(btrim(asset_category)) = 'intangible' then 'other'
    else lower(btrim(asset_type))
  end;

alter table public.corporate_assets
  drop constraint corporate_assets_asset_type_check;

alter table public.corporate_assets
  add constraint corporate_assets_asset_category_check
  check (asset_category in (
    'equipment','vehicle','furniture','license','digital_service','insurance','other'
  )),
  add constraint corporate_assets_asset_type_check
  check (asset_type in (
    'equipment','computer','mobile_device','audiovisual_equipment',
    'vehicle','furniture','software_license','digital_certificate',
    'domain','subscription_license','insurance_policy','other'
  )),
  add constraint corporate_assets_classification_check
  check (
    (asset_category = 'equipment' and asset_type in (
      'equipment','computer','mobile_device','audiovisual_equipment'
    ))
    or (asset_category = 'vehicle' and asset_type = 'vehicle')
    or (asset_category = 'furniture' and asset_type = 'furniture')
    or (asset_category = 'license' and asset_type in (
      'software_license','digital_certificate'
    ))
    or (asset_category = 'digital_service' and asset_type in (
      'domain','subscription_license'
    ))
    or (asset_category = 'insurance' and asset_type = 'insurance_policy')
    or (asset_category = 'other' and asset_type = 'other')
  );

create or replace function private.enforce_corporate_asset_domain()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if lower(btrim(new.asset_type)) in (
    'trademark','copyright','patent','industrial_design','utility_model',
    'plant_variety','trade_secret','intellectual_property','work','phonogram',
    'composition','master_recording','brand','contractual_right'
  ) or lower(btrim(new.asset_category)) in (
    'trademark','copyright','patent','industrial_design','utility_model',
    'plant_variety','trade_secret','intellectual_property','work','phonogram',
    'composition','master_recording','brand','contractual_right'
  ) then
    raise exception 'Classificação de propriedade intelectual pertence ao módulo de PI.'
      using errcode='23514';
  end if;
  return new;
end;
$$;

drop trigger if exists corporate_assets_enforce_domain on public.corporate_assets;
create trigger corporate_assets_enforce_domain
before insert or update of asset_type, asset_category on public.corporate_assets
for each row execute function private.enforce_corporate_asset_domain();

revoke all on function private.enforce_corporate_asset_domain()
from public,anon,authenticated,service_role;

comment on column public.corporate_assets.asset_category is
  'Broad operational family: equipment, vehicle, furniture, license, digital_service, insurance or other.';
comment on column public.corporate_assets.asset_type is
  'Canonical technical subtype validated against asset_category.';
comment on constraint corporate_assets_classification_check on public.corporate_assets is
  'Enforces the canonical category-to-type matrix for Patrimônio e Licenças.';
comment on function private.enforce_corporate_asset_domain() is
  'Rejects intellectual-property classifications from the corporate patrimony ledger.';
