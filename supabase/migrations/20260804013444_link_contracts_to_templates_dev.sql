alter table public.contracts
  add column if not exists template_id uuid
  references public.contract_templates(id)
  on delete restrict;

create index if not exists contracts_template_id_idx
  on public.contracts(template_id);

comment on column public.contracts.template_id is
  'Template versionado utilizado como origem do contrato.';
