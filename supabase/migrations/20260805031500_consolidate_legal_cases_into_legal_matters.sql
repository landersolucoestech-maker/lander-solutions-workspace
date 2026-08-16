-- Consolidate legal_cases into legal_matters, the only writable legal master.
-- Preserve identifiers, timestamps, authorship, documents and auditability.

do $$
begin
  if to_regclass('public.legal_cases') is null
     or to_regclass('public.legal_matters') is null
     or to_regclass('public.legal_matter_events') is null
     or to_regclass('public.governance_documents') is null then
    raise exception 'Estruturas jurídicas necessárias não foram encontradas.';
  end if;

  if exists (
    select 1
    from public.legal_cases c
    join public.legal_matters m on m.id = c.id
  ) then
    raise exception 'Existe colisão de UUID entre legal_cases e legal_matters.';
  end if;

  if exists (
    select 1
    from public.legal_cases c
    join public.legal_matters m on m.code = c.code
  ) then
    raise exception 'Existe colisão de código entre legal_cases e legal_matters.';
  end if;
end;
$$;

insert into public.permissions (code, module, action, description)
values ('legal.close', 'legal', 'close', 'Encerrar assuntos jurídicos com resultado e justificativa.')
on conflict (code) do update
set module = excluded.module,
    action = excluded.action,
    description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select distinct rp.role_id, target.id
from public.role_permissions rp
join public.permissions source on source.id = rp.permission_id
join public.permissions target on target.code = 'legal.close'
where source.code = 'legal.manage'
on conflict do nothing;

alter table public.legal_matters
  add column if not exists legacy_source text,
  add column if not exists legacy_source_id uuid;

alter table public.legal_matters
  add constraint legal_matters_legacy_source_check
  check (legacy_source is null or legacy_source = 'legal_cases'),
  add constraint legal_matters_code_check
  check (code ~ '^(MAT|JUR)-[A-Z0-9-]{4,32}$'),
  add constraint legal_matters_title_check
  check (char_length(btrim(title)) between 2 and 180),
  add constraint legal_matters_type_check
  check (matter_type in (
    'analysis','contract_review','notice','claim','litigation','administrative',
    'labor','tax','intellectual_property','privacy','consumer','negotiation','other'
  )),
  add constraint legal_matters_status_check
  check (status in (
    'draft','open','awaiting_response','under_review','settled','won','lost','closed','cancelled'
  )),
  add constraint legal_matters_risk_level_check
  check (risk_level in ('low','medium','high','critical')),
  add constraint legal_matters_dates_check
  check (closed_on is null or closed_on >= opened_on),
  add constraint legal_matters_due_date_check
  check (due_date is null or due_date >= opened_on);

create unique index if not exists legal_matters_legacy_source_id_key
  on public.legal_matters (legacy_source, legacy_source_id)
  where legacy_source is not null and legacy_source_id is not null;

create index if not exists legal_matters_due_idx
  on public.legal_matters (due_date)
  where status not in ('closed','cancelled');

insert into public.legal_matters (
  id,
  legal_entity_id,
  business_unit_id,
  project_id,
  contract_id,
  counterparty_id,
  external_counsel_party_id,
  responsible_user_id,
  code,
  title,
  description,
  matter_type,
  status,
  risk_level,
  probability,
  exposure_currency_code,
  exposure_amount,
  opened_on,
  due_date,
  closed_on,
  outcome,
  notes,
  version,
  created_by,
  created_at,
  updated_at,
  legacy_source,
  legacy_source_id
)
select
  c.id,
  c.legal_entity_id,
  c.business_unit_id,
  c.project_id,
  c.contract_id,
  c.counterparty_id,
  c.external_counsel_party_id,
  c.responsible_user_id,
  c.code,
  c.title,
  c.summary,
  c.case_type,
  c.status,
  c.risk_level,
  0,
  c.currency_code,
  c.amount_at_risk,
  c.opened_on,
  c.due_date,
  c.closed_on,
  c.outcome,
  concat_ws(E'\n', nullif(c.notes, ''), 'Migrado do cadastro legado legal_cases; probabilidade histórica não informada.'),
  c.version,
  c.created_by,
  c.created_at,
  c.updated_at,
  'legal_cases',
  c.id
from public.legal_cases c;

alter table public.legal_matter_events
  add column if not exists created_by uuid references public.profiles(id) on delete restrict;

update public.legal_matter_events e
set created_by = m.created_by
from public.legal_matters m
where m.id = e.legal_matter_id
  and e.created_by is null;

alter table public.legal_matter_events
  alter column created_by set default auth.uid(),
  alter column created_by set not null,
  add constraint legal_matter_events_title_check
    check (char_length(btrim(title)) between 2 and 180),
  add constraint legal_matter_events_status_check
    check (status in ('planned','in_progress','completed','cancelled')),
  add constraint legal_matter_events_dates_check
    check (due_at is null or occurred_at is null or due_at >= occurred_at);

insert into public.legal_matter_events (
  legal_matter_id,
  sequence_no,
  event_type,
  title,
  description,
  occurred_at,
  status,
  responsible_user_id,
  evidence_reference,
  outcome,
  version,
  created_by,
  created_at,
  updated_at
)
select
  c.id,
  1,
  'legacy_import',
  'Importação do histórico jurídico legado',
  'Assunto consolidado a partir de legal_cases sem perda de identificador ou metadados.',
  c.created_at,
  'completed',
  c.responsible_user_id,
  'legal_cases:' || c.id::text,
  'Registro incorporado à fonte canônica legal_matters.',
  1,
  c.created_by,
  c.created_at,
  c.updated_at
from public.legal_cases c;

create table public.legal_matter_intellectual_property_assets (
  legal_matter_id uuid not null references public.legal_matters(id) on delete cascade,
  intellectual_property_asset_id uuid not null references public.intellectual_property_assets(id) on delete restrict,
  relationship_type text not null default 'subject',
  notes text,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (legal_matter_id, intellectual_property_asset_id),
  constraint legal_matter_ip_relationship_type_check
    check (relationship_type in ('subject','conflict','license','ownership','opposition','enforcement','other'))
);

comment on table public.legal_matter_intellectual_property_assets
is 'Explicit relationship between legal matters and the canonical intellectual_property_assets master; no IP data is duplicated.';

create trigger legal_matter_ip_assets_audit
after insert or update or delete on public.legal_matter_intellectual_property_assets
for each row execute function private.audit_row_change();

alter table public.legal_matter_intellectual_property_assets enable row level security;

create policy legal_matter_ip_assets_read
on public.legal_matter_intellectual_property_assets for select to authenticated
using (
  exists (
    select 1
    from public.legal_matters m
    where m.id = legal_matter_intellectual_property_assets.legal_matter_id
      and private.current_user_has_permission(
        'legal.read',
        private.governance_unit_code(m.business_unit_id)
      )
  )
);

create policy legal_matter_ip_assets_manage
on public.legal_matter_intellectual_property_assets for all to authenticated
using (
  exists (
    select 1
    from public.legal_matters m
    where m.id = legal_matter_intellectual_property_assets.legal_matter_id
      and private.current_user_has_permission(
        'legal.manage',
        private.governance_unit_code(m.business_unit_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.legal_matters m
    where m.id = legal_matter_intellectual_property_assets.legal_matter_id
      and private.current_user_has_permission(
        'legal.manage',
        private.governance_unit_code(m.business_unit_id)
      )
  )
);

revoke all on public.legal_matter_intellectual_property_assets from anon;
grant select, insert, update, delete on public.legal_matter_intellectual_property_assets to authenticated;

alter table public.governance_documents
  add column legal_matter_id uuid;

update public.governance_documents
set legal_matter_id = legal_case_id
where legal_case_id is not null;

alter table public.governance_documents
  add constraint governance_documents_legal_matter_id_fkey
    foreign key (legal_matter_id) references public.legal_matters(id) on delete restrict;

create index governance_documents_legal_matter_idx
  on public.governance_documents (legal_matter_id);

alter table public.governance_documents
  drop constraint governance_documents_check,
  add constraint governance_documents_subject_check
    check (num_nonnulls(asset_id, legal_matter_id, compliance_obligation_id) = 1);

alter table public.governance_documents
  drop constraint governance_documents_legal_case_id_fkey;

drop index if exists public.governance_documents_legal_idx;

alter table public.governance_documents
  drop column legal_case_id;

create or replace function private.governance_document_unit_code(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
select coalesce(
  private.governance_unit_code(gd.business_unit_id),
  private.governance_unit_code(a.business_unit_id),
  private.governance_unit_code(m.business_unit_id),
  private.governance_unit_code(c.business_unit_id)
)
from public.governance_documents gd
left join public.corporate_assets a on a.id = gd.asset_id
left join public.legal_matters m on m.id = gd.legal_matter_id
left join public.compliance_obligations c on c.id = gd.compliance_obligation_id
where gd.id = p_id
$$;

-- Replace broad ALL policies with explicit read and mutation boundaries.
drop policy if exists legal_matters_all on public.legal_matters;
create policy legal_matters_read
on public.legal_matters for select to authenticated
using (
  private.current_user_has_permission(
    'legal.read',
    private.governance_unit_code(business_unit_id)
  )
  or private.current_user_has_permission(
    'legal.manage',
    private.governance_unit_code(business_unit_id)
  )
  or private.current_user_has_permission(
    'legal.close',
    private.governance_unit_code(business_unit_id)
  )
);
create policy legal_matters_insert
on public.legal_matters for insert to authenticated
with check (
  private.current_user_has_permission(
    'legal.manage',
    private.governance_unit_code(business_unit_id)
  )
);
create policy legal_matters_update
on public.legal_matters for update to authenticated
using (
  private.current_user_has_permission(
    'legal.manage',
    private.governance_unit_code(business_unit_id)
  )
  or private.current_user_has_permission(
    'legal.close',
    private.governance_unit_code(business_unit_id)
  )
)
with check (
  private.current_user_has_permission(
    'legal.manage',
    private.governance_unit_code(business_unit_id)
  )
  or private.current_user_has_permission(
    'legal.close',
    private.governance_unit_code(business_unit_id)
  )
);
create policy legal_matters_delete
on public.legal_matters for delete to authenticated
using (
  status in ('draft','closed','cancelled')
  and private.current_user_has_permission(
    'legal.manage',
    private.governance_unit_code(business_unit_id)
  )
);

drop policy if exists legal_events_all on public.legal_matter_events;
create policy legal_matter_events_read
on public.legal_matter_events for select to authenticated
using (
  exists (
    select 1
    from public.legal_matters m
    where m.id = legal_matter_events.legal_matter_id
      and (
        private.current_user_has_permission('legal.read', private.governance_unit_code(m.business_unit_id))
        or private.current_user_has_permission('legal.manage', private.governance_unit_code(m.business_unit_id))
        or private.current_user_has_permission('legal.close', private.governance_unit_code(m.business_unit_id))
      )
  )
);
create policy legal_matter_events_manage
on public.legal_matter_events for all to authenticated
using (
  exists (
    select 1
    from public.legal_matters m
    where m.id = legal_matter_events.legal_matter_id
      and private.current_user_has_permission('legal.manage', private.governance_unit_code(m.business_unit_id))
  )
)
with check (
  exists (
    select 1
    from public.legal_matters m
    where m.id = legal_matter_events.legal_matter_id
      and private.current_user_has_permission('legal.manage', private.governance_unit_code(m.business_unit_id))
  )
);

create or replace function private.block_legacy_legal_case_write()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_setting('app.allow_legacy_governance_write', true) = 'on' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  raise exception 'Cadastro jurídico legado somente leitura. Utilize legal_matters.';
end;
$$;

create trigger legal_cases_block_legacy_write
before insert or update or delete on public.legal_cases
for each row execute function private.block_legacy_legal_case_write();

-- Remove development anonymous visibility from confidential legal records and evidence.
drop policy if exists dev_public_read on public.legal_cases;
drop policy if exists dev_public_read on public.legal_matters;
drop policy if exists dev_public_read on public.legal_matter_events;
drop policy if exists dev_public_read on public.governance_documents;

revoke all on public.legal_cases from anon;
revoke all on public.legal_matters from anon;
revoke all on public.legal_matter_events from anon;
revoke all on public.governance_documents from anon;

grant select, insert, update, delete on public.legal_matters to authenticated;
grant select, insert, update, delete on public.legal_matter_events to authenticated;
grant select on public.legal_cases to authenticated;

do $$
declare
  v_legacy_count bigint;
  v_migrated_count bigint;
  v_legacy_document_count bigint;
  v_canonical_document_count bigint;
begin
  select count(*) into v_legacy_count from public.legal_cases;
  select count(*) into v_migrated_count
  from public.legal_matters
  where legacy_source = 'legal_cases';

  if v_legacy_count <> v_migrated_count then
    raise exception 'Reconciliação jurídica falhou: legado %, canônico %.', v_legacy_count, v_migrated_count;
  end if;

  select count(*) into v_legacy_document_count
  from public.governance_documents
  where legal_matter_id in (
    select id from public.legal_matters where legacy_source = 'legal_cases'
  );

  select count(*) into v_canonical_document_count
  from public.governance_documents gd
  join public.legal_matters m on m.id = gd.legal_matter_id
  where m.legacy_source = 'legal_cases';

  if v_legacy_document_count <> v_canonical_document_count then
    raise exception 'Reconciliação de documentos jurídicos falhou.';
  end if;

  if exists (
    select 1
    from public.governance_documents gd
    left join public.legal_matters m on m.id = gd.legal_matter_id
    where gd.legal_matter_id is not null and m.id is null
  ) then
    raise exception 'Existem documentos jurídicos órfãos após a migração.';
  end if;

  if exists (
    select 1
    from public.legal_matter_events e
    left join public.legal_matters m on m.id = e.legal_matter_id
    where m.id is null
  ) then
    raise exception 'Existem eventos jurídicos órfãos após a migração.';
  end if;
end;
$$;

comment on table public.legal_matters
is 'Canonical legal master for analyses, notices, disputes, judicial and administrative proceedings, risks and outcomes.';
comment on column public.legal_matters.legacy_source_id
is 'Traceability key for controlled migration from legal_cases; not a second source of truth.';
comment on column public.governance_documents.legal_matter_id
is 'Canonical legal subject associated with this evidence or governance document.';