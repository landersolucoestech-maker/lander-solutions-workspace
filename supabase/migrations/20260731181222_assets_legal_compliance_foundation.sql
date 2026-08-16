create table public.corporate_assets (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  business_unit_id uuid references public.business_units(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  cost_center_id uuid references public.cost_centers(id) on delete restrict,
  code text not null unique check (code ~ '^ATV-[A-Z0-9-]{4,32}$'),
  name text not null check (char_length(btrim(name)) between 2 and 180),
  asset_type text not null check (asset_type in ('equipment','computer','mobile_device','vehicle','furniture','software_license','domain','trademark','copyright','contractual_right','other')),
  ownership_type text not null default 'owned' check (ownership_type in ('owned','leased','licensed','loaned','third_party')),
  status text not null default 'active' check (status in ('planned','active','maintenance','inactive','disposed','lost','cancelled')),
  acquisition_date date,
  acquisition_cost numeric(18,2) not null default 0 check (acquisition_cost >= 0),
  currency_code text not null default 'BRL' references public.currencies(code),
  useful_life_months integer check (useful_life_months is null or useful_life_months > 0),
  serial_number text,
  registration_number text,
  storage_location text,
  responsible_user_id uuid references public.profiles(id) on delete restrict,
  supplier_party_id uuid references public.parties(id) on delete restrict,
  warranty_until date,
  renewal_date date,
  disposal_date date,
  notes text,
  version integer not null default 1 check (version > 0),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.legal_cases (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  business_unit_id uuid references public.business_units(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  contract_id uuid references public.contracts(id) on delete restrict,
  counterparty_id uuid references public.parties(id) on delete restrict,
  code text not null unique check (code ~ '^JUR-[A-Z0-9-]{4,32}$'),
  title text not null check (char_length(btrim(title)) between 2 and 180),
  case_type text not null check (case_type in ('contract_review','notice','claim','litigation','administrative','labor','tax','intellectual_property','privacy','consumer','other')),
  status text not null default 'open' check (status in ('draft','open','awaiting_response','under_review','settled','won','lost','closed','cancelled')),
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high','critical')),
  amount_at_risk numeric(18,2) not null default 0 check (amount_at_risk >= 0),
  currency_code text not null default 'BRL' references public.currencies(code),
  opened_on date not null default current_date,
  due_date date,
  closed_on date,
  responsible_user_id uuid references public.profiles(id) on delete restrict,
  external_counsel_party_id uuid references public.parties(id) on delete restrict,
  summary text,
  outcome text,
  notes text,
  version integer not null default 1 check (version > 0),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closed_on is null or closed_on >= opened_on)
);

create table public.compliance_obligations (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  business_unit_id uuid references public.business_units(id) on delete restrict,
  code text not null unique check (code ~ '^COMP-[A-Z0-9-]{4,32}$'),
  title text not null check (char_length(btrim(title)) between 2 and 180),
  obligation_type text not null check (obligation_type in ('corporate','tax','accounting','labor','privacy','information_security','license','insurance','intellectual_property','contractual','regulatory','other')),
  authority text,
  frequency text not null default 'one_time' check (frequency in ('one_time','monthly','quarterly','semiannual','annual','event_based','continuous')),
  status text not null default 'pending' check (status in ('planned','pending','in_progress','compliant','overdue','waived','cancelled')),
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high','critical')),
  due_date date,
  next_due_date date,
  completed_at timestamptz,
  responsible_user_id uuid references public.profiles(id) on delete restrict,
  evidence_reference text,
  requirement_summary text not null,
  remediation_plan text,
  notes text,
  version integer not null default 1 check (version > 0),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.governance_documents (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  business_unit_id uuid references public.business_units(id) on delete restrict,
  asset_id uuid references public.corporate_assets(id) on delete cascade,
  legal_case_id uuid references public.legal_cases(id) on delete cascade,
  compliance_obligation_id uuid references public.compliance_obligations(id) on delete cascade,
  document_type text not null,
  label text not null check (char_length(btrim(label)) between 2 and 180),
  storage_provider text not null default 'external',
  storage_bucket text,
  storage_object_key text,
  external_reference text,
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[a-f0-9]{64}$'),
  valid_from date,
  valid_until date,
  status text not null default 'active' check (status in ('draft','active','expired','superseded','cancelled')),
  version integer not null default 1 check (version > 0),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(asset_id,legal_case_id,compliance_obligation_id)=1),
  check (valid_until is null or valid_from is null or valid_until >= valid_from)
);

create index corporate_assets_unit_status_idx on public.corporate_assets(business_unit_id,status,asset_type);
create index corporate_assets_project_idx on public.corporate_assets(project_id);
create index corporate_assets_responsible_idx on public.corporate_assets(responsible_user_id);
create index legal_cases_unit_status_idx on public.legal_cases(business_unit_id,status,risk_level);
create index legal_cases_due_idx on public.legal_cases(due_date) where status not in ('closed','cancelled');
create index legal_cases_contract_idx on public.legal_cases(contract_id);
create index compliance_obligations_unit_status_idx on public.compliance_obligations(business_unit_id,status,risk_level);
create index compliance_obligations_due_idx on public.compliance_obligations(coalesce(next_due_date,due_date)) where status not in ('compliant','waived','cancelled');
create index governance_documents_asset_idx on public.governance_documents(asset_id);
create index governance_documents_legal_idx on public.governance_documents(legal_case_id);
create index governance_documents_compliance_idx on public.governance_documents(compliance_obligation_id);

create or replace function private.governance_unit_code(p_business_unit_id uuid) returns text language sql stable security definer set search_path='' as $$select case when p_business_unit_id is null then null else private.unit_code_for_id(p_business_unit_id) end$$;
create or replace function private.governance_document_unit_code(p_id uuid) returns text language sql stable security definer set search_path='' as $$
select coalesce(private.governance_unit_code(gd.business_unit_id),private.governance_unit_code(a.business_unit_id),private.governance_unit_code(l.business_unit_id),private.governance_unit_code(c.business_unit_id))
from public.governance_documents gd
left join public.corporate_assets a on a.id=gd.asset_id
left join public.legal_cases l on l.id=gd.legal_case_id
left join public.compliance_obligations c on c.id=gd.compliance_obligation_id
where gd.id=p_id$$;

create trigger corporate_assets_touch before update on public.corporate_assets for each row execute function private.touch_updated_at();
create trigger legal_cases_touch before update on public.legal_cases for each row execute function private.touch_updated_at();
create trigger compliance_obligations_touch before update on public.compliance_obligations for each row execute function private.touch_updated_at();
create trigger governance_documents_touch before update on public.governance_documents for each row execute function private.touch_updated_at();
create trigger corporate_assets_audit after insert or update or delete on public.corporate_assets for each row execute function private.audit_row_change();
create trigger legal_cases_audit after insert or update or delete on public.legal_cases for each row execute function private.audit_row_change();
create trigger compliance_obligations_audit after insert or update or delete on public.compliance_obligations for each row execute function private.audit_row_change();
create trigger governance_documents_audit after insert or update or delete on public.governance_documents for each row execute function private.audit_row_change();

insert into public.permissions(code,module,action,description) values
('assets.read','assets','read','Consultar ativos corporativos'),
('assets.manage','assets','manage','Criar, editar e inativar ativos corporativos'),
('legal.read','legal','read','Consultar casos e demandas jurídicas'),
('legal.manage','legal','manage','Criar e editar casos jurídicos'),
('compliance.read','compliance','read','Consultar obrigações de compliance'),
('compliance.manage','compliance','manage','Criar, atualizar e concluir obrigações de compliance'),
('governance.documents.manage','governance','documents_manage','Gerenciar documentos de ativos, jurídico e compliance')
on conflict(code) do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.app_roles r cross join public.permissions p
where r.code in ('owner','corporate_admin','legal_manager','compliance_manager','asset_manager','finance_manager')
and p.code in ('assets.read','assets.manage','legal.read','legal.manage','compliance.read','compliance.manage','governance.documents.manage')
on conflict do nothing;

alter table public.corporate_assets enable row level security;
alter table public.legal_cases enable row level security;
alter table public.compliance_obligations enable row level security;
alter table public.governance_documents enable row level security;

create policy corporate_assets_select on public.corporate_assets for select to authenticated using(private.current_user_has_permission('assets.read',private.governance_unit_code(business_unit_id)));
create policy corporate_assets_insert on public.corporate_assets for insert to authenticated with check(private.current_user_has_permission('assets.manage',private.governance_unit_code(business_unit_id)));
create policy corporate_assets_update on public.corporate_assets for update to authenticated using(private.current_user_has_permission('assets.manage',private.governance_unit_code(business_unit_id))) with check(private.current_user_has_permission('assets.manage',private.governance_unit_code(business_unit_id)));
create policy corporate_assets_delete on public.corporate_assets for delete to authenticated using(status in ('planned','inactive','disposed','cancelled') and private.current_user_has_permission('assets.manage',private.governance_unit_code(business_unit_id)));

create policy legal_cases_select on public.legal_cases for select to authenticated using(private.current_user_has_permission('legal.read',private.governance_unit_code(business_unit_id)));
create policy legal_cases_insert on public.legal_cases for insert to authenticated with check(private.current_user_has_permission('legal.manage',private.governance_unit_code(business_unit_id)));
create policy legal_cases_update on public.legal_cases for update to authenticated using(private.current_user_has_permission('legal.manage',private.governance_unit_code(business_unit_id))) with check(private.current_user_has_permission('legal.manage',private.governance_unit_code(business_unit_id)));
create policy legal_cases_delete on public.legal_cases for delete to authenticated using(status in ('draft','closed','cancelled') and private.current_user_has_permission('legal.manage',private.governance_unit_code(business_unit_id)));

create policy compliance_obligations_select on public.compliance_obligations for select to authenticated using(private.current_user_has_permission('compliance.read',private.governance_unit_code(business_unit_id)));
create policy compliance_obligations_insert on public.compliance_obligations for insert to authenticated with check(private.current_user_has_permission('compliance.manage',private.governance_unit_code(business_unit_id)));
create policy compliance_obligations_update on public.compliance_obligations for update to authenticated using(private.current_user_has_permission('compliance.manage',private.governance_unit_code(business_unit_id))) with check(private.current_user_has_permission('compliance.manage',private.governance_unit_code(business_unit_id)));
create policy compliance_obligations_delete on public.compliance_obligations for delete to authenticated using(status in ('planned','compliant','waived','cancelled') and private.current_user_has_permission('compliance.manage',private.governance_unit_code(business_unit_id)));

create policy governance_documents_select on public.governance_documents for select to authenticated using(
  private.current_user_has_permission('assets.read',private.governance_document_unit_code(id)) or
  private.current_user_has_permission('legal.read',private.governance_document_unit_code(id)) or
  private.current_user_has_permission('compliance.read',private.governance_document_unit_code(id))
);
create policy governance_documents_insert on public.governance_documents for insert to authenticated with check(private.current_user_has_permission('governance.documents.manage',private.governance_unit_code(business_unit_id)));
create policy governance_documents_update on public.governance_documents for update to authenticated using(private.current_user_has_permission('governance.documents.manage',private.governance_document_unit_code(id))) with check(private.current_user_has_permission('governance.documents.manage',private.governance_unit_code(business_unit_id)));
create policy governance_documents_delete on public.governance_documents for delete to authenticated using(status in ('draft','expired','superseded','cancelled') and private.current_user_has_permission('governance.documents.manage',private.governance_document_unit_code(id)));

revoke all on public.corporate_assets,public.legal_cases,public.compliance_obligations,public.governance_documents from anon;
grant select,insert,update,delete on public.corporate_assets,public.legal_cases,public.compliance_obligations,public.governance_documents to authenticated;
