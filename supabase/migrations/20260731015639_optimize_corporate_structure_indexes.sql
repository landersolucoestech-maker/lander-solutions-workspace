create index if not exists legal_entities_functional_currency_idx
  on public.legal_entities(functional_currency_code);

create index if not exists business_units_primary_currency_idx
  on public.business_units(primary_currency_code);
