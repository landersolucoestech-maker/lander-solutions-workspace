-- Development-only public fiscal access while application authentication is disabled.
-- RLS remains enabled. Policies are explicitly scoped to the anon role.

alter table public.financial_fiscal_documents
  add column if not exists operation_type text not null default 'saida' check (operation_type in ('entrada','saida')),
  add column if not exists note_type text not null default 'nfse' check (note_type in ('nfse','nfe','nfce')),
  add column if not exists workflow_status text not null default 'pendente' check (workflow_status in ('emitida','pendente','paga','cancelada')),
  add column if not exists operation_nature text,
  add column if not exists municipality_code text,
  add column if not exists cfop text,
  add column if not exists service_description text,
  add column if not exists due_date date,
  add column if not exists party_id uuid references public.parties(id) on delete restrict,
  add column if not exists recipient_name text,
  add column if not exists recipient_state_registration text,
  add column if not exists recipient_municipal_registration text,
  add column if not exists recipient_email text,
  add column if not exists recipient_address text,
  add column if not exists recipient_city text,
  add column if not exists recipient_state text,
  add column if not exists recipient_postal_code text,
  add column if not exists service_amount numeric(20,6) not null default 0,
  add column if not exists deductions_amount numeric(20,6) not null default 0,
  add column if not exists calculation_base numeric(20,6) not null default 0,
  add column if not exists iss_rate numeric(9,4) not null default 0,
  add column if not exists iss_amount numeric(20,6) not null default 0,
  add column if not exists iss_withheld boolean not null default false,
  add column if not exists pis_amount numeric(20,6) not null default 0,
  add column if not exists cofins_amount numeric(20,6) not null default 0,
  add column if not exists inss_amount numeric(20,6) not null default 0,
  add column if not exists irrf_amount numeric(20,6) not null default 0,
  add column if not exists csll_amount numeric(20,6) not null default 0,
  add column if not exists net_amount numeric(20,6) not null default 0,
  add column if not exists payment_method text,
  add column if not exists payment_terms text,
  add column if not exists notes text;

create table if not exists public.financial_fiscal_document_items (
  id uuid primary key default gen_random_uuid(),
  fiscal_document_id uuid not null references public.financial_fiscal_documents(id) on delete cascade,
  sequence_no integer not null check (sequence_no > 0),
  description text not null check (char_length(btrim(description)) between 1 and 1000),
  service_code text not null default '',
  quantity numeric(20,6) not null check (quantity > 0),
  unit_amount numeric(20,6) not null check (unit_amount >= 0),
  total_amount numeric(20,6) not null check (total_amount >= 0),
  created_at timestamptz not null default now(),
  unique (fiscal_document_id, sequence_no)
);

alter table public.financial_fiscal_document_items enable row level security;

grant usage on schema public to anon;
grant select on table
  public.financial_fiscal_documents,
  public.financial_fiscal_events,
  public.financial_fiscal_document_items,
  public.financial_documents,
  public.parties,
  public.party_contacts,
  public.party_addresses,
  public.business_units,
  public.legal_entities
  to anon;
grant delete on table public.financial_fiscal_documents to anon;

drop policy if exists dev_public_fiscal_documents_select on public.financial_fiscal_documents;
create policy dev_public_fiscal_documents_select on public.financial_fiscal_documents
for select to anon using (true);

drop policy if exists dev_public_fiscal_events_select on public.financial_fiscal_events;
create policy dev_public_fiscal_events_select on public.financial_fiscal_events
for select to anon using (true);

drop policy if exists dev_public_fiscal_items_select on public.financial_fiscal_document_items;
create policy dev_public_fiscal_items_select on public.financial_fiscal_document_items
for select to anon using (true);

drop policy if exists dev_public_financial_documents_select on public.financial_documents;
create policy dev_public_financial_documents_select on public.financial_documents
for select to anon using (source_type = 'fiscal_document');

drop policy if exists dev_public_parties_select on public.parties;
create policy dev_public_parties_select on public.parties
for select to anon using (status = 'active');

drop policy if exists dev_public_party_contacts_select on public.party_contacts;
create policy dev_public_party_contacts_select on public.party_contacts
for select to anon using (status = 'active');

drop policy if exists dev_public_party_addresses_select on public.party_addresses;
create policy dev_public_party_addresses_select on public.party_addresses
for select to anon using (status = 'active');

drop policy if exists dev_public_business_units_select on public.business_units;
create policy dev_public_business_units_select on public.business_units
for select to anon using (status = 'active');

drop policy if exists dev_public_legal_entities_select on public.legal_entities;
create policy dev_public_legal_entities_select on public.legal_entities
for select to anon using (true);

drop policy if exists dev_public_fiscal_documents_delete on public.financial_fiscal_documents;
create policy dev_public_fiscal_documents_delete on public.financial_fiscal_documents
for delete to anon using (status = 'draft');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('financial-fiscal-documents', 'financial-fiscal-documents', false, 10485760, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists dev_public_fiscal_pdf_select on storage.objects;
create policy dev_public_fiscal_pdf_select on storage.objects
for select to anon
using (bucket_id = 'financial-fiscal-documents' and name like 'public-dev/%');

drop policy if exists dev_public_fiscal_pdf_insert on storage.objects;
create policy dev_public_fiscal_pdf_insert on storage.objects
for insert to anon
with check (bucket_id = 'financial-fiscal-documents' and name like 'public-dev/%');

drop policy if exists dev_public_fiscal_pdf_delete on storage.objects;
create policy dev_public_fiscal_pdf_delete on storage.objects
for delete to anon
using (bucket_id = 'financial-fiscal-documents' and name like 'public-dev/%');

create or replace function public.create_fiscal_document_bundle(p_payload jsonb)
returns public.financial_fiscal_documents
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_unit public.business_units%rowtype;
  v_legal public.legal_entities%rowtype;
  v_account_id uuid;
  v_actor_id uuid;
  v_party_id uuid;
  v_document public.financial_documents%rowtype;
  v_fiscal public.financial_fiscal_documents%rowtype;
  v_item jsonb;
  v_sequence integer := 0;
  v_nature text;
  v_amount numeric(20,6);
  v_issue date;
  v_due date;
  v_party_name text;
  v_party_tax_id text;
begin
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Dados da nota fiscal inválidos.';
  end if;

  select * into v_unit
  from public.business_units
  where id = nullif(p_payload->>'business_unit_id', '')::uuid
    and status = 'active';
  if v_unit.id is null then raise exception 'Unidade de negócio inválida.'; end if;

  select * into v_legal from public.legal_entities where id = v_unit.legal_entity_id;
  if v_legal.id is null then raise exception 'Pessoa jurídica da unidade não encontrada.'; end if;

  select id into v_actor_id from public.profiles order by created_at nulls last, id limit 1;
  if v_actor_id is null then raise exception 'Perfil técnico de desenvolvimento não encontrado.'; end if;

  v_party_name := nullif(btrim(p_payload->>'tomador_razao_social'), '');
  v_party_tax_id := nullif(regexp_replace(coalesce(p_payload->>'tomador_cnpj', ''), '[^0-9]', '', 'g'), '');

  if nullif(p_payload->>'party_id', '') is not null then
    select id into v_party_id
    from public.parties
    where id = (p_payload->>'party_id')::uuid and status = 'active';
  end if;

  if v_party_id is null and v_party_tax_id is not null then
    select id into v_party_id
    from public.parties
    where regexp_replace(coalesce(tax_id, ''), '[^0-9]', '', 'g') = v_party_tax_id
    order by created_at
    limit 1;
  end if;

  if v_party_id is null then
    if v_party_name is null then raise exception 'Informe a razão social ou nome do tomador/fornecedor.'; end if;
    insert into public.parties (
      party_type, legal_name, trade_name, tax_id, primary_business_unit_id,
      status, category, registration_source, created_by, updated_by
    ) values (
      case when length(coalesce(v_party_tax_id, '')) = 11 then 'person' else 'organization' end,
      v_party_name, v_party_name, nullif(p_payload->>'tomador_cnpj', ''), v_unit.id,
      'active', case when p_payload->>'operation_type' = 'entrada' then 'supplier' else 'client' end,
      'nota_fiscal_public_dev', v_actor_id, v_actor_id
    ) returning id into v_party_id;
  end if;

  if p_payload->>'operation_type' not in ('entrada', 'saida') then
    raise exception 'Tipo de operação inválido.';
  end if;
  if p_payload->>'tipo_nota' not in ('nfse', 'nfe', 'nfce') then
    raise exception 'Tipo de nota inválido.';
  end if;

  v_nature := case when p_payload->>'operation_type' = 'entrada' then 'payable' else 'receivable' end;
  v_amount := greatest(coalesce((p_payload->>'valor_liquido')::numeric, 0), 0);
  if v_amount <= 0 then raise exception 'O valor líquido deve ser maior que zero.'; end if;

  v_issue := (p_payload->>'data_emissao')::date;
  v_due := (p_payload->>'vencimento')::date;
  if v_due < v_issue then raise exception 'O vencimento não pode ser anterior à emissão.'; end if;

  select id into v_account_id
  from public.managerial_accounts
  where status = 'active'
    and posting_allowed = true
    and account_type = case when v_nature = 'receivable' then 'revenue' else 'expense' end
  order by is_system desc, code
  limit 1;
  if v_account_id is null then raise exception 'Conta gerencial compatível não encontrada.'; end if;

  insert into public.financial_documents (
    legal_entity_id, business_unit_id, party_id, document_nature, source_type,
    document_number, description, issue_date, competence_date, due_date,
    original_currency_code, original_amount, fx_rate, fx_date, fx_source,
    functional_currency_code, classification_status, counterparty_account_id, status, created_by
  ) values (
    v_legal.id, v_unit.id, v_party_id, v_nature, 'fiscal_document',
    btrim(p_payload->>'numero'), btrim(p_payload->>'descricao_servicos'), v_issue, v_issue, v_due,
    'BRL', v_amount, 1, v_issue, 'functional_currency', 'BRL', 'classified', v_account_id, 'draft', v_actor_id
  ) returning * into v_document;

  insert into public.financial_document_lines (
    financial_document_id, sequence_no, managerial_account_id, description, original_amount,
    functional_amount, tax_amount_functional, allocation_status
  ) values (
    v_document.id, 1, v_account_id, btrim(p_payload->>'descricao_servicos'), v_amount,
    v_amount, greatest(coalesce((p_payload->>'valor_iss')::numeric, 0), 0), 'direct'
  );

  insert into public.financial_fiscal_documents (
    financial_document_id, fiscal_document_type, fiscal_number, series, issuer_tax_id, recipient_tax_id,
    service_code, issued_at, status, storage_provider, pdf_bucket, pdf_object_key, operation_type,
    note_type, workflow_status, operation_nature, municipality_code, cfop, service_description, due_date,
    party_id, recipient_name, recipient_state_registration, recipient_municipal_registration, recipient_email,
    recipient_address, recipient_city, recipient_state, recipient_postal_code, service_amount, deductions_amount,
    calculation_base, iss_rate, iss_amount, iss_withheld, pis_amount, cofins_amount, inss_amount, irrf_amount,
    csll_amount, net_amount, payment_method, payment_terms, notes, created_by
  ) values (
    v_document.id,
    case p_payload->>'tipo_nota' when 'nfe' then 'nfe' when 'nfse' then 'nfse' else 'service_receipt' end,
    btrim(p_payload->>'numero'), nullif(btrim(p_payload->>'serie'), ''),
    case when p_payload->>'operation_type' = 'entrada' then p_payload->>'tomador_cnpj' else v_legal.tax_id end,
    case when p_payload->>'operation_type' = 'entrada' then v_legal.tax_id else p_payload->>'tomador_cnpj' end,
    nullif(btrim(p_payload->>'codigo_servico_municipal'), ''), v_issue::timestamptz, 'draft',
    case when nullif(p_payload->>'pdf_object_key', '') is null then 'external' else 'supabase' end,
    case when nullif(p_payload->>'pdf_object_key', '') is null then null else 'financial-fiscal-documents' end,
    nullif(p_payload->>'pdf_object_key', ''), p_payload->>'operation_type', p_payload->>'tipo_nota',
    p_payload->>'workflow_status', nullif(btrim(p_payload->>'natureza_operacao'), ''),
    nullif(btrim(p_payload->>'codigo_municipio'), ''), nullif(btrim(p_payload->>'cfop'), ''),
    nullif(btrim(p_payload->>'descricao_servicos'), ''), v_due, v_party_id,
    v_party_name, nullif(btrim(p_payload->>'tomador_inscricao_estadual'), ''),
    nullif(btrim(p_payload->>'tomador_inscricao_municipal'), ''), nullif(btrim(p_payload->>'tomador_email'), ''),
    nullif(btrim(p_payload->>'tomador_endereco'), ''), nullif(btrim(p_payload->>'tomador_cidade'), ''),
    nullif(btrim(p_payload->>'tomador_uf'), ''), nullif(btrim(p_payload->>'tomador_cep'), ''),
    coalesce((p_payload->>'valor_servicos')::numeric, 0), coalesce((p_payload->>'valor_deducoes')::numeric, 0),
    coalesce((p_payload->>'base_calculo')::numeric, 0), coalesce((p_payload->>'aliquota_iss')::numeric, 0),
    coalesce((p_payload->>'valor_iss')::numeric, 0), coalesce((p_payload->>'iss_retido')::boolean, false),
    coalesce((p_payload->>'valor_pis')::numeric, 0), coalesce((p_payload->>'valor_cofins')::numeric, 0),
    coalesce((p_payload->>'valor_inss')::numeric, 0), coalesce((p_payload->>'valor_ir')::numeric, 0),
    coalesce((p_payload->>'valor_csll')::numeric, 0), v_amount,
    nullif(btrim(p_payload->>'forma_pagamento'), ''), nullif(btrim(p_payload->>'condicao_pagamento'), ''),
    nullif(btrim(p_payload->>'observacoes'), ''), v_actor_id
  ) returning * into v_fiscal;

  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'itens', '[]'::jsonb)) loop
    v_sequence := v_sequence + 1;
    insert into public.financial_fiscal_document_items (
      fiscal_document_id, sequence_no, description, service_code, quantity, unit_amount, total_amount
    ) values (
      v_fiscal.id, v_sequence, btrim(v_item->>'description'), coalesce(v_item->>'service_code', ''),
      (v_item->>'quantity')::numeric, (v_item->>'unit_amount')::numeric, (v_item->>'total_amount')::numeric
    );
  end loop;
  if v_sequence = 0 then raise exception 'Inclua pelo menos um item na nota.'; end if;

  return v_fiscal;
end;
$$;

alter function public.create_fiscal_document_bundle(jsonb) owner to postgres;
revoke all on function public.create_fiscal_document_bundle(jsonb) from public;
grant execute on function public.create_fiscal_document_bundle(jsonb) to anon, authenticated;
