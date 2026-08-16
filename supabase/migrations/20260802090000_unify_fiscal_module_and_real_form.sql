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
revoke all on table public.financial_fiscal_document_items from public, anon;
grant select, insert, update, delete on table public.financial_fiscal_document_items to authenticated;

drop policy if exists fiscal_items_select on public.financial_fiscal_document_items;
create policy fiscal_items_select on public.financial_fiscal_document_items
for select to authenticated
using (exists (
  select 1
  from public.financial_fiscal_documents ffd
  join public.financial_documents fd on fd.id = ffd.financial_document_id
  where ffd.id = fiscal_document_id
    and private.current_user_has_permission('finance.read', private.unit_code_for_id(fd.business_unit_id))
));

drop policy if exists fiscal_items_manage on public.financial_fiscal_document_items;
create policy fiscal_items_manage on public.financial_fiscal_document_items
for all to authenticated
using (exists (
  select 1
  from public.financial_fiscal_documents ffd
  join public.financial_documents fd on fd.id = ffd.financial_document_id
  where ffd.id = fiscal_document_id
    and ffd.status = 'draft'
    and private.current_user_has_aal2()
    and private.current_user_has_permission('finance.documents.manage_draft', private.unit_code_for_id(fd.business_unit_id))
))
with check (exists (
  select 1
  from public.financial_fiscal_documents ffd
  join public.financial_documents fd on fd.id = ffd.financial_document_id
  where ffd.id = fiscal_document_id
    and ffd.status = 'draft'
    and private.current_user_has_aal2()
    and private.current_user_has_permission('finance.documents.manage_draft', private.unit_code_for_id(fd.business_unit_id))
));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('financial-fiscal-documents', 'financial-fiscal-documents', false, 10485760, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists fiscal_pdf_select on storage.objects;
create policy fiscal_pdf_select on storage.objects
for select to authenticated
using (bucket_id = 'financial-fiscal-documents' and private.current_user_has_permission('finance.read', null));

drop policy if exists fiscal_pdf_insert on storage.objects;
create policy fiscal_pdf_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'financial-fiscal-documents' and private.current_user_has_aal2() and private.current_user_has_permission('finance.documents.create', null));

drop policy if exists fiscal_pdf_delete on storage.objects;
create policy fiscal_pdf_delete on storage.objects
for delete to authenticated
using (bucket_id = 'financial-fiscal-documents' and private.current_user_has_aal2() and private.current_user_has_permission('finance.documents.manage_draft', null));

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
  v_document public.financial_documents%rowtype;
  v_fiscal public.financial_fiscal_documents%rowtype;
  v_item jsonb;
  v_sequence integer := 0;
  v_nature text;
  v_amount numeric(20,6);
  v_issue date;
  v_due date;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  select * into v_unit from public.business_units where id = (p_payload->>'business_unit_id')::uuid and status = 'active';
  if v_unit.id is null then raise exception 'Unidade de negócio inválida.'; end if;
  if not private.current_user_has_aal2() or not private.current_user_has_permission('finance.documents.create', v_unit.code) then
    raise exception 'Permissão insuficiente para criar a nota fiscal.';
  end if;
  select * into v_legal from public.legal_entities where id = v_unit.legal_entity_id;
  if not exists (select 1 from public.parties where id = (p_payload->>'party_id')::uuid and status = 'active') then
    raise exception 'Cliente ou fornecedor inválido.';
  end if;
  v_nature := case when p_payload->>'operation_type' = 'entrada' then 'payable' else 'receivable' end;
  v_amount := greatest((p_payload->>'valor_liquido')::numeric, 0);
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
    v_legal.id, v_unit.id, (p_payload->>'party_id')::uuid, v_nature, 'fiscal_document',
    btrim(p_payload->>'numero'), btrim(p_payload->>'descricao_servicos'), v_issue, v_issue, v_due,
    'BRL', v_amount, 1, v_issue, 'functional_currency', 'BRL', 'classified', v_account_id, 'draft', auth.uid()
  ) returning * into v_document;

  insert into public.financial_document_lines (
    financial_document_id, sequence_no, managerial_account_id, description, original_amount,
    functional_amount, tax_amount_functional, allocation_status
  ) values (
    v_document.id, 1, v_account_id, btrim(p_payload->>'descricao_servicos'), v_amount,
    v_amount, greatest((p_payload->>'valor_iss')::numeric, 0), 'direct'
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
    v_document.id, case p_payload->>'tipo_nota' when 'nfe' then 'nfe' when 'nfse' then 'nfse' else 'service_receipt' end,
    btrim(p_payload->>'numero'), nullif(btrim(p_payload->>'serie'), ''),
    case when p_payload->>'operation_type' = 'entrada' then p_payload->>'tomador_cnpj' else v_legal.tax_id end,
    case when p_payload->>'operation_type' = 'entrada' then v_legal.tax_id else p_payload->>'tomador_cnpj' end,
    nullif(btrim(p_payload->>'codigo_servico_municipal'), ''), v_issue::timestamptz, 'draft',
    case when p_payload->>'pdf_object_key' is null then 'external' else 'supabase' end,
    case when p_payload->>'pdf_object_key' is null then null else 'financial-fiscal-documents' end,
    nullif(p_payload->>'pdf_object_key', ''), p_payload->>'operation_type', p_payload->>'tipo_nota',
    p_payload->>'workflow_status', nullif(btrim(p_payload->>'natureza_operacao'), ''),
    nullif(btrim(p_payload->>'codigo_municipio'), ''), nullif(btrim(p_payload->>'cfop'), ''),
    nullif(btrim(p_payload->>'descricao_servicos'), ''), v_due, (p_payload->>'party_id')::uuid,
    nullif(btrim(p_payload->>'tomador_razao_social'), ''), nullif(btrim(p_payload->>'tomador_inscricao_estadual'), ''),
    nullif(btrim(p_payload->>'tomador_inscricao_municipal'), ''), nullif(btrim(p_payload->>'tomador_email'), ''),
    nullif(btrim(p_payload->>'tomador_endereco'), ''), nullif(btrim(p_payload->>'tomador_cidade'), ''),
    nullif(btrim(p_payload->>'tomador_uf'), ''), nullif(btrim(p_payload->>'tomador_cep'), ''),
    (p_payload->>'valor_servicos')::numeric, (p_payload->>'valor_deducoes')::numeric,
    (p_payload->>'base_calculo')::numeric, (p_payload->>'aliquota_iss')::numeric,
    (p_payload->>'valor_iss')::numeric, coalesce((p_payload->>'iss_retido')::boolean, false),
    (p_payload->>'valor_pis')::numeric, (p_payload->>'valor_cofins')::numeric,
    (p_payload->>'valor_inss')::numeric, (p_payload->>'valor_ir')::numeric,
    (p_payload->>'valor_csll')::numeric, v_amount, nullif(btrim(p_payload->>'forma_pagamento'), ''),
    nullif(btrim(p_payload->>'condicao_pagamento'), ''), nullif(btrim(p_payload->>'observacoes'), ''), auth.uid()
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
exception when others then
  raise;
end;
$$;

alter function public.create_fiscal_document_bundle(jsonb) owner to postgres;
revoke all on function public.create_fiscal_document_bundle(jsonb) from public, anon;
grant execute on function public.create_fiscal_document_bundle(jsonb) to authenticated;
