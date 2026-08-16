alter table public.contract_templates
  add column if not exists business_unit_id uuid
  references public.business_units(id) on delete restrict;

create index if not exists contract_templates_business_unit_idx
  on public.contract_templates(business_unit_id)
  where business_unit_id is not null;

comment on column public.contract_templates.business_unit_id is
  'Unidade de negócio à qual o modelo contratual se aplica. Nullable para compatibilidade com modelos anteriores.';
