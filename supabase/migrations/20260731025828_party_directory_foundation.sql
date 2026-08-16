create schema if not exists private;

insert into public.permissions (code, module, action, description)
values
  ('parties.read', 'parties', 'read', 'Consultar organizações, pessoas, papéis, contatos, endereços e vínculos.'),
  ('parties.manage', 'parties', 'manage', 'Cadastrar e alterar organizações, pessoas e seus vínculos.'),
  ('parties.sensitive.read', 'parties', 'read_sensitive', 'Consultar documentos e referências sensíveis autorizadas.'),
  ('parties.sensitive.manage', 'parties', 'manage_sensitive', 'Administrar documentos e referências sensíveis autorizadas.')
on conflict (code) do update
set module = excluded.module,
    action = excluded.action,
    description = excluded.description;

with grants(role_code, permission_code) as (
  values
    ('owner', 'parties.read'),
    ('owner', 'parties.manage'),
    ('owner', 'parties.sensitive.read'),
    ('owner', 'parties.sensitive.manage'),
    ('corporate_admin', 'parties.read'),
    ('corporate_admin', 'parties.manage'),
    ('corporate_admin', 'parties.sensitive.read'),
    ('commercial', 'parties.read'),
    ('commercial', 'parties.manage'),
    ('finance_manager', 'parties.read'),
    ('finance_manager', 'parties.sensitive.read'),
    ('finance_manager', 'parties.sensitive.manage'),
    ('accounts_payable', 'parties.read'),
    ('accounts_payable', 'parties.sensitive.read'),
    ('accounts_receivable', 'parties.read'),
    ('accounts_receivable', 'parties.sensitive.read'),
    ('legal', 'parties.read'),
    ('legal', 'parties.sensitive.read'),
    ('legal', 'parties.sensitive.manage'),
    ('contract_manager', 'parties.read'),
    ('participation_manager', 'parties.read'),
    ('participation_manager', 'parties.sensitive.read'),
    ('compliance', 'parties.read'),
    ('compliance', 'parties.sensitive.read'),
    ('auditor', 'parties.read'),
    ('auditor', 'parties.sensitive.read'),
    ('executive_readonly', 'parties.read'),
    ('readonly', 'parties.read'),
    ('unit_manager', 'parties.read')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from grants g
join public.app_roles r on r.code = g.role_code
join public.permissions p on p.code = g.permission_code
on conflict do nothing;

create table public.parties (
  id uuid primary key default gen_random_uuid(),
  party_type text not null check (party_type in ('organization', 'person')),
  legal_name text not null check (char_length(btrim(legal_name)) between 2 and 200),
  trade_name text,
  tax_id text,
  country_code text not null default 'BR' check (country_code ~ '^[A-Z]{2}$'),
  preferred_currency_code text not null default 'BRL' references public.currencies(code),
  language_code text not null default 'pt-BR' check (char_length(language_code) between 2 and 20),
  primary_business_unit_id uuid references public.business_units(id) on delete restrict,
  status text not null default 'prospect' check (status in ('prospect', 'active', 'inactive', 'blocked')),
  notes text check (notes is null or char_length(notes) <= 2000),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.party_roles (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete restrict,
  role_code text not null check (role_code in (
    'client', 'supplier', 'partner', 'service_provider', 'participant', 'investor', 'carrier',
    'international_client', 'technology_client', 'education_client', 'services_client'
  )),
  business_unit_id uuid references public.business_units(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'inactive', 'revoked')),
  started_on date,
  ended_on date,
  notes text check (notes is null or char_length(notes) <= 2000),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_on is null or started_on is null or ended_on >= started_on)
);

create table public.party_contacts (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete restrict,
  contact_type text not null check (contact_type in ('email', 'phone', 'mobile', 'website', 'other')),
  label text check (label is null or char_length(label) <= 120),
  value text not null check (char_length(btrim(value)) between 2 and 320),
  normalized_value text not null,
  is_primary boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.party_addresses (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete restrict,
  address_type text not null check (address_type in ('legal', 'billing', 'service', 'residential', 'other')),
  label text check (label is null or char_length(label) <= 120),
  address_line_1 text not null check (char_length(btrim(address_line_1)) between 2 and 255),
  address_line_2 text,
  city text not null check (char_length(btrim(city)) between 2 and 120),
  state_region text,
  postal_code text,
  country_code text not null default 'BR' check (country_code ~ '^[A-Z]{2}$'),
  is_primary boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.party_relationships (
  id uuid primary key default gen_random_uuid(),
  organization_party_id uuid not null references public.parties(id) on delete restrict,
  person_party_id uuid not null references public.parties(id) on delete restrict,
  relationship_type text not null check (relationship_type in ('contact', 'representative', 'employee', 'owner', 'partner', 'other')),
  title text check (title is null or char_length(title) <= 160),
  is_primary boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive', 'ended')),
  started_on date,
  ended_on date,
  notes text check (notes is null or char_length(notes) <= 2000),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (organization_party_id <> person_party_id),
  check (ended_on is null or started_on is null or ended_on >= started_on)
);

create table public.party_documents (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete restrict,
  document_type text not null check (char_length(btrim(document_type)) between 2 and 80),
  label text check (label is null or char_length(label) <= 160),
  reference_number_masked text check (reference_number_masked is null or char_length(reference_number_masked) <= 160),
  issued_on date,
  expires_on date,
  storage_provider text not null default 'none' check (storage_provider in ('none', 'r2', 'supabase', 'external')),
  storage_bucket text check (storage_bucket is null or char_length(storage_bucket) <= 160),
  storage_object_key text check (storage_object_key is null or char_length(storage_object_key) <= 1024),
  external_reference text check (external_reference is null or char_length(external_reference) <= 1024),
  status text not null default 'pending' check (status in ('pending', 'uploaded', 'verified', 'expired', 'rejected', 'inactive')),
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_on is null or issued_on is null or expires_on >= issued_on)
);

create table private.party_restricted_references (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete restrict,
  reference_type text not null check (reference_type in ('bank_account', 'payment_method', 'tax_document', 'identity_document', 'other')),
  label text not null check (char_length(btrim(label)) between 2 and 120),
  masked_value text check (masked_value is null or char_length(masked_value) <= 120),
  vault_reference text not null check (char_length(vault_reference) between 3 and 255 and vault_reference ~ '^[A-Za-z0-9/_:.-]+$'),
  status text not null default 'active' check (status in ('active', 'inactive', 'revoked')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index parties_tax_id_unique_idx
  on public.parties (country_code, upper(regexp_replace(tax_id, '[^A-Za-z0-9]', '', 'g')))
  where tax_id is not null and btrim(tax_id) <> '';
create index parties_primary_unit_idx on public.parties(primary_business_unit_id);
create index parties_status_idx on public.parties(status);
create index party_roles_party_idx on public.party_roles(party_id);
create index party_roles_unit_idx on public.party_roles(business_unit_id);
create unique index party_roles_active_unique_idx
  on public.party_roles(party_id, role_code, coalesce(business_unit_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'active';
create index party_contacts_party_idx on public.party_contacts(party_id);
create unique index party_contacts_active_unique_idx
  on public.party_contacts(party_id, contact_type, normalized_value)
  where status = 'active';
create unique index party_contacts_primary_unique_idx
  on public.party_contacts(party_id, contact_type)
  where status = 'active' and is_primary;
create index party_addresses_party_idx on public.party_addresses(party_id);
create unique index party_addresses_primary_unique_idx
  on public.party_addresses(party_id, address_type)
  where status = 'active' and is_primary;
create index party_relationships_organization_idx on public.party_relationships(organization_party_id);
create index party_relationships_person_idx on public.party_relationships(person_party_id);
create unique index party_relationships_active_unique_idx
  on public.party_relationships(organization_party_id, person_party_id, relationship_type)
  where status = 'active';
create index party_documents_party_idx on public.party_documents(party_id);
create index party_documents_verified_by_idx on public.party_documents(verified_by);
create index party_documents_status_idx on public.party_documents(status);
create index party_restricted_references_party_idx on private.party_restricted_references(party_id);
create unique index party_restricted_references_vault_unique_idx on private.party_restricted_references(vault_reference);
create index party_restricted_references_created_by_idx on private.party_restricted_references(created_by);
create index party_restricted_references_updated_by_idx on private.party_restricted_references(updated_by);

create or replace function private.party_unit_code(p_party_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.unit_code_for_id(p.primary_business_unit_id)
  from public.parties p
  where p.id = p_party_id;
$$;

create or replace function private.normalize_party_contact()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.value := btrim(new.value);
  if new.contact_type = 'email' then
    new.normalized_value := lower(new.value);
  elsif new.contact_type in ('phone', 'mobile') then
    new.normalized_value := regexp_replace(new.value, '[^0-9+]', '', 'g');
  elsif new.contact_type = 'website' then
    new.normalized_value := lower(regexp_replace(new.value, '/+$', ''));
  else
    new.normalized_value := lower(new.value);
  end if;

  if new.normalized_value is null or new.normalized_value = '' then
    raise exception 'O contato normalizado não pode ser vazio.';
  end if;
  return new;
end;
$$;

create or replace function private.validate_party_relationship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_type text;
  v_person_type text;
begin
  select party_type into v_org_type from public.parties where id = new.organization_party_id;
  select party_type into v_person_type from public.parties where id = new.person_party_id;
  if v_org_type is distinct from 'organization' then
    raise exception 'O vínculo exige uma organização válida.';
  end if;
  if v_person_type is distinct from 'person' then
    raise exception 'O vínculo exige uma pessoa válida.';
  end if;
  return new;
end;
$$;

create or replace function private.prevent_active_party_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'inactive' then
    raise exception 'Somente cadastros inativos podem ser excluídos fisicamente.';
  end if;
  return old;
end;
$$;

create or replace function private.audit_restricted_reference_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_actor uuid;
begin
  if tg_op = 'INSERT' then
    v_before := null;
    v_after := to_jsonb(new) - 'vault_reference';
    v_actor := new.created_by;
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old) - 'vault_reference';
    v_after := to_jsonb(new) - 'vault_reference';
    v_actor := coalesce(new.updated_by, old.updated_by, new.created_by, old.created_by);
  else
    v_before := to_jsonb(old) - 'vault_reference';
    v_after := null;
    v_actor := coalesce(old.updated_by, old.created_by);
  end if;

  insert into public.audit_events (
    actor_user_id, action, entity_schema, entity_table, entity_id, before_data, after_data
  ) values (
    v_actor, lower(tg_op), tg_table_schema, tg_table_name,
    coalesce(v_after ->> 'id', v_before ->> 'id'), v_before, v_after
  );
  return coalesce(new, old);
end;
$$;

revoke all on function private.party_unit_code(uuid) from public, anon;
grant execute on function private.party_unit_code(uuid) to authenticated, service_role;
revoke all on function private.normalize_party_contact() from public, anon, authenticated;
revoke all on function private.validate_party_relationship() from public, anon, authenticated;
revoke all on function private.prevent_active_party_delete() from public, anon, authenticated;
revoke all on function private.audit_restricted_reference_change() from public, anon, authenticated;

create trigger parties_touch_updated_at
before update on public.parties
for each row execute function private.touch_updated_at();
create trigger parties_audit
after insert or update or delete on public.parties
for each row execute function private.audit_row_change();
create trigger parties_prevent_active_delete
before delete on public.parties
for each row execute function private.prevent_active_party_delete();

create trigger party_roles_touch_updated_at
before update on public.party_roles
for each row execute function private.touch_updated_at();
create trigger party_roles_audit
after insert or update or delete on public.party_roles
for each row execute function private.audit_row_change();

create trigger party_contacts_normalize
before insert or update of contact_type, value on public.party_contacts
for each row execute function private.normalize_party_contact();
create trigger party_contacts_touch_updated_at
before update on public.party_contacts
for each row execute function private.touch_updated_at();
create trigger party_contacts_audit
after insert or update or delete on public.party_contacts
for each row execute function private.audit_row_change();

create trigger party_addresses_touch_updated_at
before update on public.party_addresses
for each row execute function private.touch_updated_at();
create trigger party_addresses_audit
after insert or update or delete on public.party_addresses
for each row execute function private.audit_row_change();

create trigger party_relationships_validate
before insert or update of organization_party_id, person_party_id on public.party_relationships
for each row execute function private.validate_party_relationship();
create trigger party_relationships_touch_updated_at
before update on public.party_relationships
for each row execute function private.touch_updated_at();
create trigger party_relationships_audit
after insert or update or delete on public.party_relationships
for each row execute function private.audit_row_change();

create trigger party_documents_touch_updated_at
before update on public.party_documents
for each row execute function private.touch_updated_at();
create trigger party_documents_audit
after insert or update or delete on public.party_documents
for each row execute function private.audit_row_change();

create trigger party_restricted_references_touch_updated_at
before update on private.party_restricted_references
for each row execute function private.touch_updated_at();
create trigger party_restricted_references_audit
after insert or update or delete on private.party_restricted_references
for each row execute function private.audit_restricted_reference_change();

alter table public.parties enable row level security;
alter table public.party_roles enable row level security;
alter table public.party_contacts enable row level security;
alter table public.party_addresses enable row level security;
alter table public.party_relationships enable row level security;
alter table public.party_documents enable row level security;
alter table private.party_restricted_references enable row level security;

create policy parties_select_authorized on public.parties
for select to authenticated
using (private.current_user_has_permission('parties.read', private.unit_code_for_id(primary_business_unit_id)));
create policy parties_insert_authorized on public.parties
for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('parties.manage', private.unit_code_for_id(primary_business_unit_id)));
create policy parties_update_authorized on public.parties
for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('parties.manage', private.unit_code_for_id(primary_business_unit_id)))
with check (private.current_user_has_aal2() and private.current_user_has_permission('parties.manage', private.unit_code_for_id(primary_business_unit_id)));
create policy parties_delete_authorized on public.parties
for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('parties.manage', private.unit_code_for_id(primary_business_unit_id)));

create policy party_roles_select_authorized on public.party_roles
for select to authenticated
using (private.current_user_has_permission('parties.read', private.party_unit_code(party_id)));
create policy party_roles_insert_authorized on public.party_roles
for insert to authenticated
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('parties.manage', private.party_unit_code(party_id))
  and (business_unit_id is null or private.current_user_has_permission('parties.manage', private.unit_code_for_id(business_unit_id)))
);
create policy party_roles_update_authorized on public.party_roles
for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('parties.manage', private.party_unit_code(party_id)))
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('parties.manage', private.party_unit_code(party_id))
  and (business_unit_id is null or private.current_user_has_permission('parties.manage', private.unit_code_for_id(business_unit_id)))
);
create policy party_roles_delete_authorized on public.party_roles
for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('parties.manage', private.party_unit_code(party_id)));

create policy party_contacts_select_authorized on public.party_contacts
for select to authenticated
using (private.current_user_has_permission('parties.read', private.party_unit_code(party_id)));
create policy party_contacts_insert_authorized on public.party_contacts
for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('parties.manage', private.party_unit_code(party_id)));
create policy party_contacts_update_authorized on public.party_contacts
for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('parties.manage', private.party_unit_code(party_id)))
with check (private.current_user_has_aal2() and private.current_user_has_permission('parties.manage', private.party_unit_code(party_id)));
create policy party_contacts_delete_authorized on public.party_contacts
for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('parties.manage', private.party_unit_code(party_id)));

create policy party_addresses_select_authorized on public.party_addresses
for select to authenticated
using (private.current_user_has_permission('parties.read', private.party_unit_code(party_id)));
create policy party_addresses_insert_authorized on public.party_addresses
for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('parties.manage', private.party_unit_code(party_id)));
create policy party_addresses_update_authorized on public.party_addresses
for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('parties.manage', private.party_unit_code(party_id)))
with check (private.current_user_has_aal2() and private.current_user_has_permission('parties.manage', private.party_unit_code(party_id)));
create policy party_addresses_delete_authorized on public.party_addresses
for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('parties.manage', private.party_unit_code(party_id)));

create policy party_relationships_select_authorized on public.party_relationships
for select to authenticated
using (
  private.current_user_has_permission('parties.read', private.party_unit_code(organization_party_id))
  or private.current_user_has_permission('parties.read', private.party_unit_code(person_party_id))
);
create policy party_relationships_insert_authorized on public.party_relationships
for insert to authenticated
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('parties.manage', private.party_unit_code(organization_party_id))
  and private.current_user_has_permission('parties.manage', private.party_unit_code(person_party_id))
);
create policy party_relationships_update_authorized on public.party_relationships
for update to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('parties.manage', private.party_unit_code(organization_party_id))
  and private.current_user_has_permission('parties.manage', private.party_unit_code(person_party_id))
)
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('parties.manage', private.party_unit_code(organization_party_id))
  and private.current_user_has_permission('parties.manage', private.party_unit_code(person_party_id))
);
create policy party_relationships_delete_authorized on public.party_relationships
for delete to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('parties.manage', private.party_unit_code(organization_party_id))
  and private.current_user_has_permission('parties.manage', private.party_unit_code(person_party_id))
);

create policy party_documents_select_authorized on public.party_documents
for select to authenticated
using (private.current_user_has_permission('parties.sensitive.read', private.party_unit_code(party_id)));
create policy party_documents_insert_authorized on public.party_documents
for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('parties.sensitive.manage', private.party_unit_code(party_id)));
create policy party_documents_update_authorized on public.party_documents
for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('parties.sensitive.manage', private.party_unit_code(party_id)))
with check (private.current_user_has_aal2() and private.current_user_has_permission('parties.sensitive.manage', private.party_unit_code(party_id)));
create policy party_documents_delete_authorized on public.party_documents
for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('parties.sensitive.manage', private.party_unit_code(party_id)));

revoke all on public.parties, public.party_roles, public.party_contacts, public.party_addresses,
  public.party_relationships, public.party_documents from anon;
grant select, insert, update, delete on public.parties, public.party_roles, public.party_contacts,
  public.party_addresses, public.party_relationships, public.party_documents to authenticated;
grant all on public.parties, public.party_roles, public.party_contacts, public.party_addresses,
  public.party_relationships, public.party_documents to service_role;

revoke all on schema private from public, anon, authenticated;
revoke all on private.party_restricted_references from public, anon, authenticated;
grant usage on schema private to service_role;
grant all on private.party_restricted_references to service_role;

create or replace function public.admin_list_party_restricted_references(p_party_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(to_jsonb(r) - 'created_by' - 'updated_by' order by r.created_at desc),
    '[]'::jsonb
  )
  from private.party_restricted_references r
  where r.party_id = p_party_id;
$$;

create or replace function public.admin_create_party_restricted_reference(
  p_party_id uuid,
  p_reference_type text,
  p_label text,
  p_masked_value text,
  p_vault_reference text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row private.party_restricted_references;
begin
  insert into private.party_restricted_references (
    party_id, reference_type, label, masked_value, vault_reference, status, created_by, updated_by
  ) values (
    p_party_id, p_reference_type, btrim(p_label), nullif(btrim(p_masked_value), ''),
    btrim(p_vault_reference), 'active', p_actor_user_id, p_actor_user_id
  ) returning * into v_row;
  return to_jsonb(v_row) - 'created_by' - 'updated_by';
end;
$$;

create or replace function public.admin_update_party_restricted_reference(
  p_id uuid,
  p_expected_version integer,
  p_reference_type text,
  p_label text,
  p_masked_value text,
  p_vault_reference text,
  p_status text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row private.party_restricted_references;
begin
  update private.party_restricted_references
  set reference_type = p_reference_type,
      label = btrim(p_label),
      masked_value = nullif(btrim(p_masked_value), ''),
      vault_reference = btrim(p_vault_reference),
      status = p_status,
      updated_by = p_actor_user_id
  where id = p_id and version = p_expected_version
  returning * into v_row;
  if not found then return null; end if;
  return to_jsonb(v_row) - 'created_by' - 'updated_by';
end;
$$;

create or replace function public.admin_delete_party_restricted_reference(
  p_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row private.party_restricted_references;
begin
  select * into v_row
  from private.party_restricted_references
  where id = p_id and version = p_expected_version
  for update;
  if not found then return null; end if;

  if v_row.status = 'active' then
    update private.party_restricted_references
    set status = 'inactive', updated_by = p_actor_user_id
    where id = p_id and version = p_expected_version
    returning * into v_row;
    return jsonb_build_object('result', 'inactivated', 'reference', to_jsonb(v_row) - 'created_by' - 'updated_by');
  end if;

  delete from private.party_restricted_references
  where id = p_id and version = p_expected_version;
  return jsonb_build_object('result', 'deleted', 'id', p_id);
end;
$$;

revoke all on function public.admin_list_party_restricted_references(uuid) from public, anon, authenticated;
revoke all on function public.admin_create_party_restricted_reference(uuid, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.admin_update_party_restricted_reference(uuid, integer, text, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.admin_delete_party_restricted_reference(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.admin_list_party_restricted_references(uuid) to service_role;
grant execute on function public.admin_create_party_restricted_reference(uuid, text, text, text, text, uuid) to service_role;
grant execute on function public.admin_update_party_restricted_reference(uuid, integer, text, text, text, text, text, uuid) to service_role;
grant execute on function public.admin_delete_party_restricted_reference(uuid, integer, uuid) to service_role;
