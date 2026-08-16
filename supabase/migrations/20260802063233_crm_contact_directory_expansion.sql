-- Recria a view para permitir a evolução controlada do tipo da coluna status.
drop view if exists public.party_directory;

begin;

create or replace function private.only_digits(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g');
$$;

create or replace function private.is_valid_cpf(p_value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := private.only_digits(p_value);
  v_sum integer;
  v_digit integer;
  i integer;
begin
  if char_length(v) <> 11 or v ~ '^(\d)\1{10}$' then return false; end if;
  v_sum := 0;
  for i in 1..9 loop
    v_sum := v_sum + substr(v, i, 1)::integer * (11 - i);
  end loop;
  v_digit := (v_sum * 10) % 11;
  if v_digit = 10 then v_digit := 0; end if;
  if v_digit <> substr(v, 10, 1)::integer then return false; end if;
  v_sum := 0;
  for i in 1..10 loop
    v_sum := v_sum + substr(v, i, 1)::integer * (12 - i);
  end loop;
  v_digit := (v_sum * 10) % 11;
  if v_digit = 10 then v_digit := 0; end if;
  return v_digit = substr(v, 11, 1)::integer;
end;
$$;

create or replace function private.is_valid_cnpj(p_value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := private.only_digits(p_value);
  v_weights integer[];
  v_sum integer;
  v_remainder integer;
  v_digit integer;
  i integer;
begin
  if char_length(v) <> 14 or v ~ '^(\d)\1{13}$' then return false; end if;
  v_weights := array[5,4,3,2,9,8,7,6,5,4,3,2];
  v_sum := 0;
  for i in 1..12 loop
    v_sum := v_sum + substr(v, i, 1)::integer * v_weights[i];
  end loop;
  v_remainder := v_sum % 11;
  v_digit := case when v_remainder < 2 then 0 else 11 - v_remainder end;
  if v_digit <> substr(v, 13, 1)::integer then return false; end if;
  v_weights := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  v_sum := 0;
  for i in 1..13 loop
    v_sum := v_sum + substr(v, i, 1)::integer * v_weights[i];
  end loop;
  v_remainder := v_sum % 11;
  v_digit := case when v_remainder < 2 then 0 else 11 - v_remainder end;
  return v_digit = substr(v, 14, 1)::integer;
end;
$$;

alter table public.parties
  add column if not exists category text not null default 'other',
  add column if not exists internal_owner_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists registration_source text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table public.parties
  drop constraint if exists parties_status_check,
  add constraint parties_status_check check (status in ('prospect','active','inactive','blocked','under_review')),
  drop constraint if exists parties_category_check,
  add constraint parties_category_check check (category in ('client','supplier','partner','service_provider','collaborator','other')),
  drop constraint if exists parties_tags_check,
  add constraint parties_tags_check check (cardinality(tags) <= 50),
  drop constraint if exists parties_registration_source_check,
  add constraint parties_registration_source_check check (registration_source is null or char_length(registration_source) <= 160);

create table public.party_profiles (
  party_id uuid primary key references public.parties(id) on delete cascade,
  person_data jsonb not null default '{}'::jsonb,
  organization_data jsonb not null default '{}'::jsonb,
  address_data jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(person_data) = 'object'),
  check (jsonb_typeof(organization_data) = 'object'),
  check (jsonb_typeof(address_data) = 'object')
);

create table public.party_representatives (
  id uuid primary key default gen_random_uuid(),
  organization_party_id uuid not null references public.parties(id) on delete cascade,
  representative_type text not null check (representative_type in ('legal_representative','partner','administrator')),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 180),
  cpf text,
  rg text,
  role_title text,
  birth_date date,
  email text,
  phone text,
  whatsapp text,
  ownership_percentage numeric(7,4) check (ownership_percentage is null or ownership_percentage between 0 and 100),
  is_primary_legal_representative boolean not null default false,
  can_sign boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cpf is null or private.is_valid_cpf(cpf)),
  check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  check (phone is null or char_length(private.only_digits(phone)) between 10 and 15),
  check (whatsapp is null or char_length(private.only_digits(whatsapp)) between 10 and 15)
);

create unique index party_representatives_primary_idx
  on public.party_representatives(organization_party_id)
  where is_primary_legal_representative;
create index party_representatives_party_idx on public.party_representatives(organization_party_id);

create table public.party_company_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_party_id uuid not null references public.parties(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 180),
  role_title text,
  department text,
  email text,
  phone text,
  whatsapp text,
  is_primary boolean not null default false,
  receives_financial boolean not null default false,
  receives_fiscal boolean not null default false,
  receives_contractual boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  check (phone is null or char_length(private.only_digits(phone)) between 10 and 15),
  check (whatsapp is null or char_length(private.only_digits(whatsapp)) between 10 and 15),
  check (email is not null or phone is not null or whatsapp is not null)
);

create unique index party_company_contacts_primary_idx
  on public.party_company_contacts(organization_party_id)
  where is_primary;
create index party_company_contacts_party_idx on public.party_company_contacts(organization_party_id);

create table private.party_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  holder_name text not null check (char_length(btrim(holder_name)) between 2 and 200),
  holder_tax_id text not null,
  bank_name text not null check (char_length(btrim(bank_name)) between 2 and 160),
  bank_code text,
  agency text not null,
  agency_digit text,
  account_type text not null check (account_type in ('checking','savings','payment','salary','other')),
  account_number text not null,
  account_digit text,
  pix_key text,
  pix_key_type text check (pix_key_type is null or pix_key_type in ('cpf_cnpj','email','phone','random','other')),
  is_primary boolean not null default false,
  status text not null default 'active' check (status in ('active','inactive')),
  version integer not null default 1 check (version > 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (private.is_valid_cpf(holder_tax_id) or private.is_valid_cnpj(holder_tax_id))
);

create unique index party_bank_accounts_primary_idx
  on private.party_bank_accounts(party_id)
  where is_primary and status = 'active';
create index party_bank_accounts_party_idx on private.party_bank_accounts(party_id,status);

alter table public.party_documents
  add column if not exists file_name text,
  add column if not exists mime_type text,
  add column if not exists file_size_bytes bigint,
  add column if not exists uploaded_by uuid references public.profiles(id) on delete set null,
  add column if not exists uploaded_at timestamptz,
  add column if not exists linked_entity_type text not null default 'party',
  add column if not exists linked_entity_id uuid;

update public.party_documents
set linked_entity_id = party_id,
    uploaded_at = coalesce(uploaded_at, created_at)
where linked_entity_id is null;

alter table public.party_documents
  drop constraint if exists party_documents_file_name_check,
  add constraint party_documents_file_name_check check (file_name is null or char_length(file_name) between 1 and 255),
  drop constraint if exists party_documents_mime_type_check,
  add constraint party_documents_mime_type_check check (mime_type is null or char_length(mime_type) between 3 and 160),
  drop constraint if exists party_documents_file_size_check,
  add constraint party_documents_file_size_check check (file_size_bytes is null or file_size_bytes between 1 and 52428800),
  drop constraint if exists party_documents_linked_entity_type_check,
  add constraint party_documents_linked_entity_type_check check (linked_entity_type in ('party','representative','company_contact'));

create or replace function private.mask_value(p_value text, p_tail integer default 4)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value is null or p_value = '' then null
    when char_length(p_value) <= p_tail then repeat('*', char_length(p_value))
    else repeat('*', greatest(char_length(p_value) - p_tail, 4)) || right(p_value, p_tail)
  end;
$$;

create or replace function private.redact_contact_audit_row(p_row jsonb, p_table text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_row is null then return null; end if;
  if p_table = 'parties' then
    return (p_row - 'tax_id') || jsonb_build_object('tax_id_masked', private.mask_value(private.only_digits(p_row ->> 'tax_id'), 2));
  elsif p_table = 'party_profiles' then
    return (p_row - 'person_data' - 'organization_data') || jsonb_build_object(
      'person_data_digest', encode(extensions.digest(coalesce(p_row -> 'person_data','{}'::jsonb)::text, 'sha256'), 'hex'),
      'organization_data_digest', encode(extensions.digest(coalesce(p_row -> 'organization_data','{}'::jsonb)::text, 'sha256'), 'hex')
    );
  elsif p_table = 'party_representatives' then
    return (p_row - 'cpf' - 'rg') || jsonb_build_object(
      'cpf_masked', private.mask_value(private.only_digits(p_row ->> 'cpf'), 2),
      'rg_present', coalesce(p_row ->> 'rg','') <> ''
    );
  elsif p_table = 'party_bank_accounts' then
    return (p_row - 'holder_tax_id' - 'account_number' - 'pix_key') || jsonb_build_object(
      'holder_tax_id_masked', private.mask_value(private.only_digits(p_row ->> 'holder_tax_id'), 2),
      'account_number_masked', private.mask_value(p_row ->> 'account_number', 4),
      'pix_key_masked', private.mask_value(p_row ->> 'pix_key', 4)
    );
  end if;
  return p_row;
end;
$$;

create or replace function private.audit_contact_sensitive_change()
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
  v_before := case when tg_op = 'INSERT' then null else private.redact_contact_audit_row(to_jsonb(old), tg_table_name) end;
  v_after := case when tg_op = 'DELETE' then null else private.redact_contact_audit_row(to_jsonb(new), tg_table_name) end;
  v_actor := coalesce(
    case when tg_op <> 'DELETE' then new.updated_by end,
    case when tg_op <> 'DELETE' then new.created_by end,
    case when tg_op <> 'INSERT' then old.updated_by end,
    case when tg_op <> 'INSERT' then old.created_by end,
    auth.uid()
  );
  insert into public.audit_events (
    actor_user_id, action, entity_schema, entity_table, entity_id, before_data, after_data
  ) values (
    v_actor, lower(tg_op), tg_table_schema, tg_table_name,
    coalesce(v_after ->> 'id', v_after ->> 'party_id', v_before ->> 'id', v_before ->> 'party_id'),
    v_before, v_after
  );
  return coalesce(new, old);
end;
$$;

create or replace function private.validate_party_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tax text := private.only_digits(new.tax_id);
begin
  if new.tax_id is not null and btrim(new.tax_id) <> '' then
    if new.party_type = 'person' and not private.is_valid_cpf(v_tax) then
      raise exception 'CPF inválido.';
    elsif new.party_type = 'organization' and not private.is_valid_cnpj(v_tax) then
      raise exception 'CNPJ inválido.';
    end if;
    new.tax_id := v_tax;
  else
    new.tax_id := null;
  end if;
  if new.party_type = 'person' then new.trade_name := null; end if;
  return new;
end;
$$;

create or replace function private.validate_party_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_type text;
begin
  select party_type into v_type from public.parties where id = new.party_id;
  if v_type = 'person' then
    if new.organization_data <> '{}'::jsonb then raise exception 'Pessoa Física não aceita dados de Pessoa Jurídica.'; end if;
  elsif v_type = 'organization' then
    if new.person_data <> '{}'::jsonb then raise exception 'Pessoa Jurídica não aceita dados de Pessoa Física.'; end if;
  else
    raise exception 'Tipo de pessoa inválido.';
  end if;
  if new.person_data ?| array['bankAccounts','accountNumber','pixKey']
     or new.organization_data ?| array['bankAccounts','accountNumber','pixKey'] then
    raise exception 'Dados bancários não podem ser gravados no perfil público.';
  end if;
  return new;
end;
$$;

create or replace function private.validate_organization_child()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_type text;
  v_party uuid;
begin
  v_party := new.organization_party_id;
  select party_type into v_type from public.parties where id = v_party;
  if v_type is distinct from 'organization' then raise exception 'O registro exige Pessoa Jurídica.'; end if;
  return new;
end;
$$;

-- Replace the generic party audit because it exposed full CPF/CNPJ.
drop trigger if exists parties_audit on public.parties;
drop trigger if exists parties_validate_identity on public.parties;
create trigger parties_validate_identity
before insert or update of party_type, tax_id, trade_name on public.parties
for each row execute function private.validate_party_identity();
create trigger parties_audit
after insert or update or delete on public.parties
for each row execute function private.audit_contact_sensitive_change();

create trigger party_profiles_validate
before insert or update on public.party_profiles
for each row execute function private.validate_party_profile();
create trigger party_profiles_touch
before update on public.party_profiles
for each row execute function private.touch_updated_at();
create trigger party_profiles_audit
after insert or update or delete on public.party_profiles
for each row execute function private.audit_contact_sensitive_change();

create trigger party_representatives_validate
before insert or update on public.party_representatives
for each row execute function private.validate_organization_child();
create trigger party_representatives_touch
before update on public.party_representatives
for each row execute function private.touch_updated_at();
create trigger party_representatives_audit
after insert or update or delete on public.party_representatives
for each row execute function private.audit_contact_sensitive_change();

create trigger party_company_contacts_validate
before insert or update on public.party_company_contacts
for each row execute function private.validate_organization_child();
create trigger party_company_contacts_touch
before update on public.party_company_contacts
for each row execute function private.touch_updated_at();
create trigger party_company_contacts_audit
after insert or update or delete on public.party_company_contacts
for each row execute function private.audit_row_change();

create trigger party_bank_accounts_touch
before update on private.party_bank_accounts
for each row execute function private.touch_updated_at();
create trigger party_bank_accounts_audit
after insert or update or delete on private.party_bank_accounts
for each row execute function private.audit_contact_sensitive_change();

alter table public.party_profiles enable row level security;
alter table public.party_representatives enable row level security;
alter table public.party_company_contacts enable row level security;

create policy party_profiles_select_authorized on public.party_profiles
for select to authenticated
using (private.current_user_has_permission('parties.read', private.party_unit_code(party_id)));
create policy party_profiles_insert_authorized on public.party_profiles
for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('parties.manage', private.party_unit_code(party_id)));
create policy party_profiles_update_authorized on public.party_profiles
for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('parties.manage', private.party_unit_code(party_id)))
with check (private.current_user_has_aal2() and private.current_user_has_permission('parties.manage', private.party_unit_code(party_id)));
create policy party_profiles_delete_authorized on public.party_profiles
for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('parties.manage', private.party_unit_code(party_id)));

create policy party_representatives_select_authorized on public.party_representatives
for select to authenticated
using (private.current_user_has_permission('parties.read', private.party_unit_code(organization_party_id)));
create policy party_representatives_insert_authorized on public.party_representatives
for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('parties.manage', private.party_unit_code(organization_party_id)));
create policy party_representatives_update_authorized on public.party_representatives
for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('parties.manage', private.party_unit_code(organization_party_id)))
with check (private.current_user_has_aal2() and private.current_user_has_permission('parties.manage', private.party_unit_code(organization_party_id)));
create policy party_representatives_delete_authorized on public.party_representatives
for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('parties.manage', private.party_unit_code(organization_party_id)));

create policy party_company_contacts_select_authorized on public.party_company_contacts
for select to authenticated
using (private.current_user_has_permission('parties.read', private.party_unit_code(organization_party_id)));
create policy party_company_contacts_insert_authorized on public.party_company_contacts
for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('parties.manage', private.party_unit_code(organization_party_id)));
create policy party_company_contacts_update_authorized on public.party_company_contacts
for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('parties.manage', private.party_unit_code(organization_party_id)))
with check (private.current_user_has_aal2() and private.current_user_has_permission('parties.manage', private.party_unit_code(organization_party_id)));
create policy party_company_contacts_delete_authorized on public.party_company_contacts
for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('parties.manage', private.party_unit_code(organization_party_id)));

grant select, insert, update, delete on public.party_profiles, public.party_representatives, public.party_company_contacts to authenticated;
grant all on public.party_profiles, public.party_representatives, public.party_company_contacts to service_role;
revoke all on private.party_bank_accounts from public, anon, authenticated;
grant all on private.party_bank_accounts to service_role;


create or replace function public.admin_save_contact_form(
  p_payload jsonb,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_party_id uuid;
  v_expected_version integer;
  v_party_type text := p_payload ->> 'partyType';
  v_status text := p_payload ->> 'status';
  v_category text := p_payload ->> 'category';
  v_person jsonb := coalesce(p_payload -> 'person', 'null'::jsonb);
  v_org jsonb := coalesce(p_payload -> 'organization', 'null'::jsonb);
  v_comm jsonb := coalesce(p_payload -> 'communications', '{}'::jsonb);
  v_address jsonb := coalesce(p_payload -> 'address', '{}'::jsonb);
  v_legal_name text;
  v_trade_name text;
  v_tax_id text;
  v_unit_id uuid;
  v_owner_id uuid;
  v_item jsonb;
  v_contact_value text;
  v_contact_type text;
  v_contact_label text;
  v_bank_id uuid;
  v_bank_ids uuid[] := '{}'::uuid[];
  v_account_number text;
  v_pix_key text;
  v_source_lead uuid;
begin
  if p_actor_user_id is null then raise exception 'Usuário responsável obrigatório.'; end if;
  if v_party_type not in ('person','organization') then raise exception 'Tipo de pessoa obrigatório.'; end if;
  if v_status not in ('active','inactive','blocked','under_review') then raise exception 'Status inválido.'; end if;
  if v_category not in ('client','supplier','partner','service_provider','collaborator','other') then raise exception 'Categoria inválida.'; end if;
  if v_party_type = 'person' then
    if v_org <> 'null'::jsonb then raise exception 'Pessoa Física não aceita dados de Pessoa Jurídica.'; end if;
    v_legal_name := nullif(btrim(v_person ->> 'fullName'), '');
    v_trade_name := null;
    v_tax_id := private.only_digits(v_person ->> 'cpf');
    if v_legal_name is null then raise exception 'Nome completo obrigatório.'; end if;
    if not private.is_valid_cpf(v_tax_id) then raise exception 'CPF inválido.'; end if;
  else
    if v_person <> 'null'::jsonb then raise exception 'Pessoa Jurídica não aceita dados de Pessoa Física.'; end if;
    v_legal_name := nullif(btrim(v_org ->> 'legalName'), '');
    v_trade_name := nullif(btrim(v_org ->> 'tradeName'), '');
    v_tax_id := private.only_digits(v_org ->> 'cnpj');
    if v_legal_name is null then raise exception 'Razão social obrigatória.'; end if;
    if v_trade_name is null then raise exception 'Nome fantasia obrigatório.'; end if;
    if not private.is_valid_cnpj(v_tax_id) then raise exception 'CNPJ inválido.'; end if;
  end if;

  if nullif(btrim(v_comm ->> 'primaryEmail'),'') is null
     and nullif(btrim(v_comm ->> 'primaryPhone'),'') is null
     and nullif(btrim(v_comm ->> 'whatsapp'),'') is null then
    raise exception 'Informe pelo menos um e-mail ou telefone.';
  end if;

  for v_contact_value in
    select value from jsonb_each_text(v_comm)
    where key ilike '%email' and btrim(value) <> ''
  loop
    if v_contact_value !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido.'; end if;
  end loop;
  for v_contact_value in
    select value from jsonb_each_text(v_comm)
    where (key ilike '%phone' or key = 'whatsapp') and btrim(value) <> ''
  loop
    if char_length(private.only_digits(v_contact_value)) not between 10 and 15 then
      raise exception 'Telefone deve possuir DDD e até 15 dígitos.';
    end if;
  end loop;

  v_unit_id := nullif(p_payload ->> 'businessUnitId','')::uuid;
  v_owner_id := nullif(p_payload ->> 'responsibleUserId','')::uuid;
  v_party_id := nullif(p_payload ->> 'id','')::uuid;
  v_expected_version := nullif(p_payload ->> 'expectedVersion','')::integer;

  if v_party_id is null then
    insert into public.parties (
      party_type, legal_name, trade_name, tax_id, country_code, preferred_currency_code,
      language_code, primary_business_unit_id, status, category, internal_owner_user_id,
      registration_source, tags, notes, created_by, updated_by
    ) values (
      v_party_type, v_legal_name, v_trade_name, v_tax_id, 'BR', 'BRL', 'pt-BR', v_unit_id,
      v_status, v_category, v_owner_id, nullif(btrim(p_payload ->> 'registrationOrigin'),''),
      coalesce(array(select jsonb_array_elements_text(coalesce(p_payload -> 'tags','[]'::jsonb))), '{}'::text[]),
      nullif(btrim(p_payload ->> 'notes'),''), p_actor_user_id, p_actor_user_id
    ) returning id into v_party_id;
  else
    if v_expected_version is null then raise exception 'Versão esperada obrigatória.'; end if;
    update public.parties
    set party_type = v_party_type,
        legal_name = v_legal_name,
        trade_name = v_trade_name,
        tax_id = v_tax_id,
        primary_business_unit_id = v_unit_id,
        status = v_status,
        category = v_category,
        internal_owner_user_id = v_owner_id,
        registration_source = nullif(btrim(p_payload ->> 'registrationOrigin'),''),
        tags = coalesce(array(select jsonb_array_elements_text(coalesce(p_payload -> 'tags','[]'::jsonb))), '{}'::text[]),
        notes = nullif(btrim(p_payload ->> 'notes'),''),
        updated_by = p_actor_user_id
    where id = v_party_id and version = v_expected_version;
    if not found then raise exception 'O contato foi alterado por outro usuário.'; end if;
  end if;

  insert into public.party_profiles (
    party_id, person_data, organization_data, address_data, created_by, updated_by
  ) values (
    v_party_id,
    case when v_party_type = 'person' then v_person else '{}'::jsonb end,
    case when v_party_type = 'organization' then v_org else '{}'::jsonb end,
    v_address,
    p_actor_user_id,
    p_actor_user_id
  )
  on conflict (party_id) do update
  set person_data = excluded.person_data,
      organization_data = excluded.organization_data,
      address_data = excluded.address_data,
      updated_by = p_actor_user_id;

  delete from public.party_roles
  where party_id = v_party_id and role_code in ('client','supplier','partner','service_provider');
  if v_category in ('client','supplier','partner','service_provider') then
    insert into public.party_roles (
      party_id, role_code, business_unit_id, status, started_on, notes
    ) values (v_party_id, v_category, v_unit_id, 'active', current_date, null);
  end if;

  delete from public.party_contacts where party_id = v_party_id;
  for v_contact_type, v_contact_label, v_contact_value in
    select * from (values
      ('email','E-mail principal',v_comm ->> 'primaryEmail'),
      ('email','E-mail secundário',v_comm ->> 'secondaryEmail'),
      ('email','E-mail financeiro',v_comm ->> 'financialEmail'),
      ('email','E-mail fiscal',v_comm ->> 'fiscalEmail'),
      ('email','E-mail jurídico',v_comm ->> 'legalEmail'),
      ('phone','Telefone principal',v_comm ->> 'primaryPhone'),
      ('phone','Telefone secundário',v_comm ->> 'secondaryPhone'),
      ('mobile','WhatsApp',v_comm ->> 'whatsapp'),
      ('website','Site',v_comm ->> 'website'),
      ('other','Instagram',v_comm ->> 'instagram'),
      ('other','LinkedIn',v_comm ->> 'linkedin')
    ) as x(contact_type,label,value)
  loop
    if nullif(btrim(v_contact_value),'') is not null then
      insert into public.party_contacts (
        party_id, contact_type, label, value, normalized_value, is_primary, status
      ) values (
        v_party_id, v_contact_type, v_contact_label, btrim(v_contact_value),
        case when v_contact_type = 'email' then lower(btrim(v_contact_value))
             when v_contact_type in ('phone','mobile') then private.only_digits(v_contact_value)
             else lower(btrim(v_contact_value)) end,
        v_contact_label in ('E-mail principal','Telefone principal','WhatsApp'), 'active'
      );
    end if;
  end loop;

  delete from public.party_addresses where party_id = v_party_id;
  if nullif(btrim(v_address ->> 'street'),'') is not null
     or nullif(btrim(v_address ->> 'postalCode'),'') is not null then
    insert into public.party_addresses (
      party_id, address_type, label, address_line_1, address_line_2, city,
      state_region, postal_code, country_code, is_primary, status
    ) values (
      v_party_id,
      case when v_party_type = 'person' then 'residential' else 'legal' end,
      'Endereço principal',
      coalesce(nullif(concat_ws(', ', nullif(btrim(v_address ->> 'street'),''), nullif(btrim(v_address ->> 'number'),'')),''),'Não informado'),
      nullif(concat_ws(' — ', nullif(btrim(v_address ->> 'complement'),''), nullif(btrim(v_address ->> 'district'),''), nullif(btrim(v_address ->> 'reference'),'')),''),
      coalesce(nullif(btrim(v_address ->> 'city'),''),'Não informado'),
      nullif(btrim(v_address ->> 'state'),''),
      nullif(private.only_digits(v_address ->> 'postalCode'),''),
      'BR', true, 'active'
    );
  end if;

  delete from public.party_representatives where organization_party_id = v_party_id;
  delete from public.party_company_contacts where organization_party_id = v_party_id;
  if v_party_type = 'organization' then
    for v_item in select value from jsonb_array_elements(coalesce(p_payload -> 'representatives','[]'::jsonb)) loop
      if nullif(btrim(v_item ->> 'fullName'),'') is not null then
        insert into public.party_representatives (
          organization_party_id, representative_type, full_name, cpf, rg, role_title,
          birth_date, email, phone, whatsapp, ownership_percentage,
          is_primary_legal_representative, can_sign, created_by, updated_by
        ) values (
          v_party_id,
          coalesce(nullif(v_item ->> 'representativeType',''),'legal_representative'),
          btrim(v_item ->> 'fullName'),
          nullif(private.only_digits(v_item ->> 'cpf'),''),
          nullif(btrim(v_item ->> 'rg'),''),
          nullif(btrim(v_item ->> 'roleTitle'),''),
          nullif(v_item ->> 'birthDate','')::date,
          nullif(lower(btrim(v_item ->> 'email')),''),
          nullif(btrim(v_item ->> 'phone'),''),
          nullif(btrim(v_item ->> 'whatsapp'),''),
          nullif(v_item ->> 'ownershipPercentage','')::numeric,
          coalesce((v_item ->> 'isPrimaryLegalRepresentative')::boolean,false),
          coalesce((v_item ->> 'canSign')::boolean,false),
          p_actor_user_id, p_actor_user_id
        );
      end if;
    end loop;

    for v_item in select value from jsonb_array_elements(coalesce(p_payload -> 'companyContacts','[]'::jsonb)) loop
      if nullif(btrim(v_item ->> 'fullName'),'') is not null then
        insert into public.party_company_contacts (
          organization_party_id, full_name, role_title, department, email, phone, whatsapp,
          is_primary, receives_financial, receives_fiscal, receives_contractual, created_by, updated_by
        ) values (
          v_party_id, btrim(v_item ->> 'fullName'), nullif(btrim(v_item ->> 'roleTitle'),''),
          nullif(btrim(v_item ->> 'department'),''), nullif(lower(btrim(v_item ->> 'email')),''),
          nullif(btrim(v_item ->> 'phone'),''), nullif(btrim(v_item ->> 'whatsapp'),''),
          coalesce((v_item ->> 'isPrimary')::boolean,false),
          coalesce((v_item ->> 'receivesFinancial')::boolean,false),
          coalesce((v_item ->> 'receivesFiscal')::boolean,false),
          coalesce((v_item ->> 'receivesContractual')::boolean,false),
          p_actor_user_id, p_actor_user_id
        );
      end if;
    end loop;
  end if;

  if p_payload ? 'bankAccounts' then
    update private.party_bank_accounts
    set is_primary=false, updated_by=p_actor_user_id
    where party_id=v_party_id and is_primary;

    for v_item in select value from jsonb_array_elements(coalesce(p_payload -> 'bankAccounts','[]'::jsonb)) loop
      v_bank_id := nullif(v_item ->> 'id','')::uuid;
      v_account_number := nullif(btrim(v_item ->> 'accountNumber'),'');
      v_pix_key := nullif(btrim(v_item ->> 'pixKey'),'');
      if v_bank_id is null then
        if v_account_number is null then raise exception 'Número da conta obrigatório para nova conta bancária.'; end if;
        insert into private.party_bank_accounts (
          party_id, holder_name, holder_tax_id, bank_name, bank_code, agency, agency_digit,
          account_type, account_number, account_digit, pix_key, pix_key_type, is_primary,
          created_by, updated_by
        ) values (
          v_party_id, btrim(v_item ->> 'holderName'), private.only_digits(v_item ->> 'holderTaxId'),
          btrim(v_item ->> 'bankName'), nullif(btrim(v_item ->> 'bankCode'),''), btrim(v_item ->> 'agency'),
          nullif(btrim(v_item ->> 'agencyDigit'),''), coalesce(nullif(v_item ->> 'accountType',''),'checking'),
          v_account_number, nullif(btrim(v_item ->> 'accountDigit'),''), v_pix_key,
          nullif(v_item ->> 'pixKeyType',''), coalesce((v_item ->> 'isPrimary')::boolean,false),
          p_actor_user_id, p_actor_user_id
        ) returning id into v_bank_id;
      else
        update private.party_bank_accounts
        set holder_name = btrim(v_item ->> 'holderName'),
            holder_tax_id = private.only_digits(v_item ->> 'holderTaxId'),
            bank_name = btrim(v_item ->> 'bankName'),
            bank_code = nullif(btrim(v_item ->> 'bankCode'),''),
            agency = btrim(v_item ->> 'agency'),
            agency_digit = nullif(btrim(v_item ->> 'agencyDigit'),''),
            account_type = coalesce(nullif(v_item ->> 'accountType',''),'checking'),
            account_number = coalesce(v_account_number, account_number),
            account_digit = nullif(btrim(v_item ->> 'accountDigit'),''),
            pix_key = coalesce(v_pix_key, pix_key),
            pix_key_type = nullif(v_item ->> 'pixKeyType',''),
            is_primary = coalesce((v_item ->> 'isPrimary')::boolean,false),
            updated_by = p_actor_user_id
        where id = v_bank_id and party_id = v_party_id;
        if not found then raise exception 'Conta bancária alterada por outro usuário.'; end if;
      end if;
      v_bank_ids := array_append(v_bank_ids, v_bank_id);
    end loop;

    if cardinality(v_bank_ids) = 0 then
      delete from private.party_bank_accounts where party_id = v_party_id;
    else
      delete from private.party_bank_accounts where party_id = v_party_id and not (id = any(v_bank_ids));
    end if;
  end if;

  v_source_lead := nullif(p_payload ->> 'sourceLeadId','')::uuid;
  if v_source_lead is not null then
    update public.crm_leads
    set converted_party_id = v_party_id,
        status = 'converted',
        updated_by = p_actor_user_id,
        updated_at = now()
    where id = v_source_lead and converted_party_id is null;
    if not found then raise exception 'Lead já convertido ou indisponível.'; end if;
  end if;

  return v_party_id;
end;
$$;

create or replace function public.admin_get_contact_form(p_party_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'expectedVersion', p.version,
    'partyType', p.party_type,
    'status', case when p.status = 'prospect' then 'under_review' else p.status end,
    'category', p.category,
    'businessUnitId', coalesce(p.primary_business_unit_id::text,''),
    'responsibleUserId', coalesce(p.internal_owner_user_id::text,''),
    'registrationOrigin', coalesce(p.registration_source,''),
    'tags', to_jsonb(p.tags),
    'notes', coalesce(p.notes,''),
    'communications', jsonb_build_object(
      'primaryEmail', coalesce((select value from public.party_contacts where party_id=p.id and label='E-mail principal' and status='active' limit 1),''),
      'secondaryEmail', coalesce((select value from public.party_contacts where party_id=p.id and label='E-mail secundário' and status='active' limit 1),''),
      'financialEmail', coalesce((select value from public.party_contacts where party_id=p.id and label='E-mail financeiro' and status='active' limit 1),''),
      'fiscalEmail', coalesce((select value from public.party_contacts where party_id=p.id and label='E-mail fiscal' and status='active' limit 1),''),
      'legalEmail', coalesce((select value from public.party_contacts where party_id=p.id and label='E-mail jurídico' and status='active' limit 1),''),
      'primaryPhone', coalesce((select value from public.party_contacts where party_id=p.id and label='Telefone principal' and status='active' limit 1),''),
      'secondaryPhone', coalesce((select value from public.party_contacts where party_id=p.id and label='Telefone secundário' and status='active' limit 1),''),
      'whatsapp', coalesce((select value from public.party_contacts where party_id=p.id and label='WhatsApp' and status='active' limit 1),''),
      'website', coalesce((select value from public.party_contacts where party_id=p.id and label='Site' and status='active' limit 1),''),
      'instagram', coalesce((select value from public.party_contacts where party_id=p.id and label='Instagram' and status='active' limit 1),''),
      'linkedin', coalesce((select value from public.party_contacts where party_id=p.id and label='LinkedIn' and status='active' limit 1),'')
    ),
    'address', coalesce(pp.address_data,'{}'::jsonb),
    'person', case when p.party_type='person' then pp.person_data else null end,
    'organization', case when p.party_type='organization' then pp.organization_data else null end,
    'representatives', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,'representativeType',r.representative_type,'fullName',r.full_name,
        'cpf',coalesce(r.cpf,''),'rg',coalesce(r.rg,''),'roleTitle',coalesce(r.role_title,''),
        'birthDate',coalesce(r.birth_date::text,''),'email',coalesce(r.email,''),
        'phone',coalesce(r.phone,''),'whatsapp',coalesce(r.whatsapp,''),
        'ownershipPercentage',coalesce(r.ownership_percentage::text,''),
        'isPrimaryLegalRepresentative',r.is_primary_legal_representative,'canSign',r.can_sign
      ) order by r.is_primary_legal_representative desc,r.created_at)
      from public.party_representatives r where r.organization_party_id=p.id
    ),'[]'::jsonb),
    'companyContacts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',c.id,'fullName',c.full_name,'roleTitle',coalesce(c.role_title,''),
        'department',coalesce(c.department,''),'email',coalesce(c.email,''),
        'phone',coalesce(c.phone,''),'whatsapp',coalesce(c.whatsapp,''),
        'isPrimary',c.is_primary,'receivesFinancial',c.receives_financial,
        'receivesFiscal',c.receives_fiscal,'receivesContractual',c.receives_contractual
      ) order by c.is_primary desc,c.created_at)
      from public.party_company_contacts c where c.organization_party_id=p.id
    ),'[]'::jsonb),
    'bankAccounts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',b.id,'version',b.version,'holderName',b.holder_name,
        'holderTaxId',b.holder_tax_id,'bankName',b.bank_name,'bankCode',coalesce(b.bank_code,''),
        'agency',b.agency,'agencyDigit',coalesce(b.agency_digit,''),'accountType',b.account_type,
        'accountNumber','','accountNumberMasked',private.mask_value(b.account_number,4),
        'accountDigit',coalesce(b.account_digit,''),'pixKey','','pixKeyMasked',private.mask_value(b.pix_key,4),
        'pixKeyType',coalesce(b.pix_key_type,''),'isPrimary',b.is_primary
      ) order by b.is_primary desc,b.created_at)
      from private.party_bank_accounts b where b.party_id=p.id and b.status='active'
    ),'[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.created_at desc)
      from public.party_documents d where d.party_id=p.id and d.status <> 'inactive'
    ),'[]'::jsonb)
  )
  from public.parties p
  left join public.party_profiles pp on pp.party_id=p.id
  where p.id=p_party_id;
$$;

revoke all on function public.admin_save_contact_form(jsonb,uuid) from public, anon, authenticated;
revoke all on function public.admin_get_contact_form(uuid) from public, anon, authenticated;
grant execute on function public.admin_save_contact_form(jsonb,uuid) to service_role;
grant execute on function public.admin_get_contact_form(uuid) to service_role;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'party-documents',
  'party-documents',
  false,
  52428800,
  array['application/pdf','image/jpeg','image/png','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

commit;

-- Mantém o padrão interno: nenhum acesso de tabela ou sequência para o papel anônimo.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
