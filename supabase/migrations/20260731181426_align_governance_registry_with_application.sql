alter table public.corporate_assets
  add column product_id uuid references public.products(id) on delete restrict,
  add column service_line_id uuid references public.service_lines(id) on delete restrict,
  add column contract_id uuid references public.contracts(id) on delete restrict,
  add column acquisition_document_id uuid references public.financial_documents(id) on delete restrict,
  add column custodian_user_id uuid references public.profiles(id) on delete restrict,
  add column description text,
  add column asset_category text,
  add column asset_tag text,
  add column quantity numeric(18,6) not null default 1 check (quantity > 0),
  add column current_value numeric(18,2) not null default 0 check (current_value >= 0),
  add column depreciation_method text not null default 'none',
  add column acquired_on date,
  add column in_service_on date,
  add column expires_on date,
  add column external_reference text,
  add column storage_provider text not null default 'external',
  add column storage_bucket text,
  add column storage_object_key text,
  add column checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[a-f0-9]{64}$');
update public.corporate_assets set asset_category=asset_type,acquired_on=acquisition_date,current_value=acquisition_cost where asset_category is null;
alter table public.corporate_assets alter column asset_category set not null;

create table public.asset_events (
 id uuid primary key default gen_random_uuid(), asset_id uuid not null references public.corporate_assets(id) on delete restrict,
 event_type text not null, occurred_on date not null default current_date,
 from_business_unit_id uuid references public.business_units(id), to_business_unit_id uuid references public.business_units(id),
 from_custodian_user_id uuid references public.profiles(id), to_custodian_user_id uuid references public.profiles(id),
 from_location text,to_location text,financial_document_id uuid references public.financial_documents(id),currency_code text references public.currencies(code),amount numeric(18,2),
 reason text not null,evidence_reference text,status text not null default 'draft' check(status in('draft','pending_approval','approved','rejected','applied','cancelled')),
 requested_by uuid references public.profiles(id),approved_by uuid references public.profiles(id),decision_reason text,applied_by uuid references public.profiles(id),
 version integer not null default 1 check(version>0),created_by uuid not null default auth.uid() references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);

create table public.legal_matters (
 id uuid primary key default gen_random_uuid(),legal_entity_id uuid not null references public.legal_entities(id),business_unit_id uuid references public.business_units(id),
 product_id uuid references public.products(id),service_line_id uuid references public.service_lines(id),project_id uuid references public.projects(id),contract_id uuid references public.contracts(id),
 counterparty_id uuid references public.parties(id),external_counsel_party_id uuid references public.parties(id),responsible_user_id uuid references public.profiles(id),
 code text not null unique,title text not null,description text,matter_type text not null,jurisdiction text,authority text,case_number text,
 status text not null default 'open',risk_level text not null default 'medium',probability numeric(5,2) not null default 0 check(probability between 0 and 100),
 exposure_currency_code text not null default 'BRL' references public.currencies(code),exposure_amount numeric(18,2) not null default 0 check(exposure_amount>=0),
 opened_on date not null default current_date,due_date date,closed_on date,outcome text,storage_provider text not null default 'external',storage_bucket text,storage_object_key text,notes text,
 version integer not null default 1 check(version>0),created_by uuid not null default auth.uid() references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.legal_matter_events (
 id uuid primary key default gen_random_uuid(),legal_matter_id uuid not null references public.legal_matters(id) on delete cascade,sequence_no integer not null check(sequence_no>0),
 event_type text not null,title text not null,description text,occurred_at timestamptz,due_at timestamptz,status text not null default 'planned',responsible_user_id uuid references public.profiles(id),evidence_reference text,outcome text,
 version integer not null default 1 check(version>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(legal_matter_id,sequence_no)
);

create table public.intellectual_property_assets (
 id uuid primary key default gen_random_uuid(),legal_entity_id uuid not null references public.legal_entities(id),business_unit_id uuid references public.business_units(id),product_id uuid references public.products(id),service_line_id uuid references public.service_lines(id),
 creator_party_id uuid references public.parties(id),responsible_user_id uuid references public.profiles(id),code text not null unique,title text not null,description text,ip_type text not null,jurisdiction text,authority text,application_number text,registration_number text,
 classification_codes text[] not null default '{}',filing_date date,registration_date date,expires_on date,renewal_due_on date,status text not null default 'planned',storage_provider text not null default 'external',storage_bucket text,storage_object_key text,checksum_sha256 text,notes text,
 version integer not null default 1 check(version>0),created_by uuid not null default auth.uid() references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.intellectual_property_events (
 id uuid primary key default gen_random_uuid(),intellectual_property_id uuid not null references public.intellectual_property_assets(id) on delete cascade,sequence_no integer not null check(sequence_no>0),event_type text not null,event_status text not null default 'planned',occurred_on date,due_date date,protocol text,authority text,reason text,evidence_reference text,
 version integer not null default 1 check(version>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(intellectual_property_id,sequence_no)
);

alter table public.compliance_obligations
 add column product_id uuid references public.products(id),add column service_line_id uuid references public.service_lines(id),add column project_id uuid references public.projects(id),add column contract_id uuid references public.contracts(id),
 add column description text,add column category text,add column legal_basis text,add column due_rule text,add column first_due_date date,add column evidence_required boolean not null default true;
update public.compliance_obligations set category=obligation_type,description=requirement_summary,first_due_date=due_date where category is null;
alter table public.compliance_obligations alter column category set not null;

create table public.compliance_occurrences (
 id uuid primary key default gen_random_uuid(),compliance_obligation_id uuid not null references public.compliance_obligations(id) on delete cascade,reference_start date,reference_end date,due_date date not null,status text not null default 'pending',evidence_reference text,notes text,waiver_reason text,
 version integer not null default 1 check(version>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.corporate_policies (
 id uuid primary key default gen_random_uuid(),legal_entity_id uuid not null references public.legal_entities(id),business_unit_id uuid references public.business_units(id),owner_user_id uuid references public.profiles(id),code text not null unique,title text not null,policy_type text not null,description text,status text not null default 'draft',current_version_id uuid,
 version integer not null default 1 check(version>0),created_by uuid not null default auth.uid() references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.corporate_policy_versions (
 id uuid primary key default gen_random_uuid(),policy_id uuid not null references public.corporate_policies(id) on delete cascade,version_number integer not null check(version_number>0),effective_from date not null,effective_to date,change_summary text not null,storage_provider text not null default 'external',storage_bucket text,storage_object_key text not null,checksum_sha256 text not null,status text not null default 'draft',decision_reason text,
 requested_by uuid references public.profiles(id),approved_by uuid references public.profiles(id),published_by uuid references public.profiles(id),version integer not null default 1 check(version>0),created_by uuid not null default auth.uid() references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(policy_id,version_number)
);
alter table public.corporate_policies add constraint corporate_policies_current_version_fkey foreign key(current_version_id) references public.corporate_policy_versions(id) on delete restrict;

create index asset_events_asset_idx on public.asset_events(asset_id,occurred_on desc);
create index legal_matters_unit_status_idx on public.legal_matters(business_unit_id,status,risk_level);
create index legal_events_matter_idx on public.legal_matter_events(legal_matter_id,sequence_no);
create index ip_assets_unit_status_idx on public.intellectual_property_assets(business_unit_id,status,ip_type);
create index ip_events_asset_idx on public.intellectual_property_events(intellectual_property_id,sequence_no);
create index compliance_occurrences_obligation_idx on public.compliance_occurrences(compliance_obligation_id,due_date);
create index corporate_policies_unit_status_idx on public.corporate_policies(business_unit_id,status);
create index policy_versions_policy_idx on public.corporate_policy_versions(policy_id,version_number desc);

create trigger asset_events_touch before update on public.asset_events for each row execute function private.touch_updated_at();
create trigger legal_matters_touch before update on public.legal_matters for each row execute function private.touch_updated_at();
create trigger legal_events_touch before update on public.legal_matter_events for each row execute function private.touch_updated_at();
create trigger ip_assets_touch before update on public.intellectual_property_assets for each row execute function private.touch_updated_at();
create trigger ip_events_touch before update on public.intellectual_property_events for each row execute function private.touch_updated_at();
create trigger compliance_occurrences_touch before update on public.compliance_occurrences for each row execute function private.touch_updated_at();
create trigger corporate_policies_touch before update on public.corporate_policies for each row execute function private.touch_updated_at();
create trigger policy_versions_touch before update on public.corporate_policy_versions for each row execute function private.touch_updated_at();
create trigger asset_events_audit after insert or update or delete on public.asset_events for each row execute function private.audit_row_change();
create trigger legal_matters_audit after insert or update or delete on public.legal_matters for each row execute function private.audit_row_change();
create trigger legal_events_audit after insert or update or delete on public.legal_matter_events for each row execute function private.audit_row_change();
create trigger ip_assets_audit after insert or update or delete on public.intellectual_property_assets for each row execute function private.audit_row_change();
create trigger ip_events_audit after insert or update or delete on public.intellectual_property_events for each row execute function private.audit_row_change();
create trigger compliance_occurrences_audit after insert or update or delete on public.compliance_occurrences for each row execute function private.audit_row_change();
create trigger corporate_policies_audit after insert or update or delete on public.corporate_policies for each row execute function private.audit_row_change();
create trigger policy_versions_audit after insert or update or delete on public.corporate_policy_versions for each row execute function private.audit_row_change();

alter table public.asset_events enable row level security;alter table public.legal_matters enable row level security;alter table public.legal_matter_events enable row level security;alter table public.intellectual_property_assets enable row level security;alter table public.intellectual_property_events enable row level security;alter table public.compliance_occurrences enable row level security;alter table public.corporate_policies enable row level security;alter table public.corporate_policy_versions enable row level security;

create policy asset_events_all on public.asset_events for all to authenticated using(exists(select 1 from public.corporate_assets a where a.id=asset_id and private.current_user_has_permission('assets.manage',private.governance_unit_code(a.business_unit_id)))) with check(exists(select 1 from public.corporate_assets a where a.id=asset_id and private.current_user_has_permission('assets.manage',private.governance_unit_code(a.business_unit_id))));
create policy legal_matters_all on public.legal_matters for all to authenticated using(private.current_user_has_permission('legal.manage',private.governance_unit_code(business_unit_id))) with check(private.current_user_has_permission('legal.manage',private.governance_unit_code(business_unit_id)));
create policy legal_events_all on public.legal_matter_events for all to authenticated using(exists(select 1 from public.legal_matters m where m.id=legal_matter_id and private.current_user_has_permission('legal.manage',private.governance_unit_code(m.business_unit_id)))) with check(exists(select 1 from public.legal_matters m where m.id=legal_matter_id and private.current_user_has_permission('legal.manage',private.governance_unit_code(m.business_unit_id))));
create policy ip_assets_all on public.intellectual_property_assets for all to authenticated using(private.current_user_has_permission('legal.manage',private.governance_unit_code(business_unit_id))) with check(private.current_user_has_permission('legal.manage',private.governance_unit_code(business_unit_id)));
create policy ip_events_all on public.intellectual_property_events for all to authenticated using(exists(select 1 from public.intellectual_property_assets a where a.id=intellectual_property_id and private.current_user_has_permission('legal.manage',private.governance_unit_code(a.business_unit_id)))) with check(exists(select 1 from public.intellectual_property_assets a where a.id=intellectual_property_id and private.current_user_has_permission('legal.manage',private.governance_unit_code(a.business_unit_id))));
create policy compliance_occurrences_all on public.compliance_occurrences for all to authenticated using(exists(select 1 from public.compliance_obligations o where o.id=compliance_obligation_id and private.current_user_has_permission('compliance.manage',private.governance_unit_code(o.business_unit_id)))) with check(exists(select 1 from public.compliance_obligations o where o.id=compliance_obligation_id and private.current_user_has_permission('compliance.manage',private.governance_unit_code(o.business_unit_id))));
create policy corporate_policies_all on public.corporate_policies for all to authenticated using(private.current_user_has_permission('compliance.manage',private.governance_unit_code(business_unit_id))) with check(private.current_user_has_permission('compliance.manage',private.governance_unit_code(business_unit_id)));
create policy policy_versions_all on public.corporate_policy_versions for all to authenticated using(exists(select 1 from public.corporate_policies p where p.id=policy_id and private.current_user_has_permission('compliance.manage',private.governance_unit_code(p.business_unit_id)))) with check(exists(select 1 from public.corporate_policies p where p.id=policy_id and private.current_user_has_permission('compliance.manage',private.governance_unit_code(p.business_unit_id))));

revoke all on public.asset_events,public.legal_matters,public.legal_matter_events,public.intellectual_property_assets,public.intellectual_property_events,public.compliance_occurrences,public.corporate_policies,public.corporate_policy_versions from anon;
grant select,insert,update,delete on public.asset_events,public.legal_matters,public.legal_matter_events,public.intellectual_property_assets,public.intellectual_property_events,public.compliance_occurrences,public.corporate_policies,public.corporate_policy_versions to authenticated;
