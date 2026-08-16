create table public.allocation_rules (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  code text not null,
  name text not null,
  description text,
  source_business_unit_id uuid not null references public.business_units(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','active','inactive','archived')),
  current_version_id uuid,
  is_system boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (legal_entity_id, code),
  check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
  check (char_length(btrim(name)) between 3 and 160)
);

create table public.allocation_rule_versions (
  id uuid primary key default gen_random_uuid(),
  allocation_rule_id uuid not null references public.allocation_rules(id) on delete cascade,
  version_no integer not null check (version_no > 0),
  method text not null check (method in (
    'fixed_percentage','equal','revenue','direct_cost','transaction_count',
    'headcount','usage','manual_driver'
  )),
  effective_start date not null,
  effective_end date,
  source_managerial_account_id uuid references public.managerial_accounts(id) on delete restrict,
  source_cost_center_id uuid references public.cost_centers(id) on delete restrict,
  source_category_id uuid references public.financial_categories(id) on delete restrict,
  source_project_id uuid references public.projects(id) on delete restrict,
  residual_strategy text not null default 'largest_fraction'
    check (residual_strategy in ('largest_fraction','designated_target')),
  residual_business_unit_id uuid references public.business_units(id) on delete restrict,
  notes text,
  status text not null default 'draft'
    check (status in ('draft','pending_approval','approved','rejected','superseded')),
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  decision_reason text,
  version integer not null default 1 check (version > 0),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (allocation_rule_id, version_no),
  check (effective_end is null or effective_end >= effective_start),
  check (
    (status = 'pending_approval' and requested_by is not null and requested_at is not null)
    or status <> 'pending_approval'
  ),
  check (
    (status in ('approved','rejected') and approved_by is not null and approved_at is not null)
    or status not in ('approved','rejected')
  )
);

alter table public.allocation_rules
  add constraint allocation_rules_current_version_id_fkey
  foreign key (current_version_id) references public.allocation_rule_versions(id) on delete restrict;

create table public.allocation_rule_targets (
  id uuid primary key default gen_random_uuid(),
  allocation_rule_version_id uuid not null references public.allocation_rule_versions(id) on delete cascade,
  business_unit_id uuid not null references public.business_units(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  service_line_id uuid references public.service_lines(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  cost_center_id uuid references public.cost_centers(id) on delete restrict,
  fixed_percentage numeric(9,6),
  sequence_no integer not null default 1 check (sequence_no between 1 and 10000),
  is_active boolean not null default true,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (product_id is null or service_line_id is null),
  check (fixed_percentage is null or (fixed_percentage >= 0 and fixed_percentage <= 100))
);

create unique index allocation_rule_targets_dimension_uidx
on public.allocation_rule_targets (
  allocation_rule_version_id,
  business_unit_id,
  coalesce(product_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(service_line_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(project_id, '00000000-0000-0000-8000-000000000000'::uuid),
  coalesce(cost_center_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

create table public.allocation_driver_values (
  id uuid primary key default gen_random_uuid(),
  allocation_rule_version_id uuid not null references public.allocation_rule_versions(id) on delete cascade,
  financial_period_id uuid not null references public.financial_periods(id) on delete restrict,
  allocation_target_id uuid not null references public.allocation_rule_targets(id) on delete cascade,
  driver_value numeric(24,8) not null check (driver_value >= 0),
  source_type text not null default 'manual'
    check (source_type in ('manual','system','xlsx_import')),
  source_reference text,
  evidence text,
  status text not null default 'draft' check (status in ('draft','confirmed')),
  version integer not null default 1 check (version > 0),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (allocation_rule_version_id, financial_period_id, allocation_target_id)
);

create table public.allocation_runs (
  id uuid primary key default gen_random_uuid(),
  allocation_rule_version_id uuid not null references public.allocation_rule_versions(id) on delete restrict,
  financial_period_id uuid not null references public.financial_periods(id) on delete restrict,
  competence_date date not null,
  description text not null,
  status text not null default 'draft'
    check (status in ('draft','simulated','pending_approval','approved','posted','reversed','cancelled')),
  method_snapshot text not null,
  source_total numeric(18,2) not null default 0 check (source_total >= 0),
  allocated_total numeric(18,2) not null default 0 check (allocated_total >= 0),
  residual_amount numeric(18,2) not null default 0,
  journal_entry_id uuid references public.journal_entries(id) on delete restrict,
  reversal_entry_id uuid references public.journal_entries(id) on delete restrict,
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  posted_by uuid references auth.users(id) on delete set null,
  posted_at timestamptz,
  reversed_by uuid references auth.users(id) on delete set null,
  reversed_at timestamptz,
  cancellation_reason text,
  version integer not null default 1 check (version > 0),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(btrim(description)) between 3 and 500),
  check (
    (status = 'pending_approval' and requested_by is not null and requested_at is not null)
    or status <> 'pending_approval'
  ),
  check (
    (status in ('approved','posted','reversed') and approved_by is not null and approved_at is not null)
    or status not in ('approved','posted','reversed')
  ),
  check (
    (status in ('posted','reversed') and journal_entry_id is not null and posted_by is not null and posted_at is not null)
    or status not in ('posted','reversed')
  ),
  check (
    (status = 'reversed' and reversal_entry_id is not null and reversed_by is not null and reversed_at is not null)
    or status <> 'reversed'
  )
);

create table public.allocation_run_sources (
  id uuid primary key default gen_random_uuid(),
  allocation_run_id uuid not null references public.allocation_runs(id) on delete cascade,
  journal_line_id uuid not null references public.journal_lines(id) on delete restrict,
  available_amount_snapshot numeric(18,2) not null check (available_amount_snapshot > 0),
  selected_amount numeric(18,2) not null check (selected_amount > 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (allocation_run_id, journal_line_id),
  check (selected_amount <= available_amount_snapshot)
);

create table public.allocation_run_distributions (
  id uuid primary key default gen_random_uuid(),
  allocation_run_id uuid not null references public.allocation_runs(id) on delete cascade,
  allocation_run_source_id uuid not null references public.allocation_run_sources(id) on delete cascade,
  allocation_target_id uuid not null references public.allocation_rule_targets(id) on delete restrict,
  business_unit_id uuid not null references public.business_units(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  service_line_id uuid references public.service_lines(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  cost_center_id uuid references public.cost_centers(id) on delete restrict,
  driver_value numeric(24,8) not null check (driver_value >= 0),
  normalized_weight numeric(24,12) not null check (normalized_weight >= 0 and normalized_weight <= 1),
  allocation_percentage numeric(12,8) not null check (allocation_percentage >= 0 and allocation_percentage <= 100),
  allocated_amount numeric(18,2) not null check (allocated_amount >= 0),
  rounding_adjustment numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (allocation_run_source_id, allocation_target_id),
  check (product_id is null or service_line_id is null)
);

create table public.allocation_approvals (
  id uuid primary key default gen_random_uuid(),
  allocation_run_id uuid not null references public.allocation_runs(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_at timestamptz not null default now(),
  approver_user_id uuid references auth.users(id) on delete restrict,
  decision text not null default 'pending'
    check (decision in ('pending','approved','rejected','cancelled')),
  reason text,
  decided_at timestamptz,
  version integer not null default 1 check (version > 0),
  check (approver_user_id is null or approver_user_id <> requested_by),
  check (
    (decision = 'pending' and decided_at is null)
    or (decision <> 'pending' and decided_at is not null)
  )
);

create index allocation_rules_source_unit_idx on public.allocation_rules(source_business_unit_id);
create index allocation_rule_versions_rule_status_idx on public.allocation_rule_versions(allocation_rule_id,status);
create index allocation_targets_version_idx on public.allocation_rule_targets(allocation_rule_version_id);
create index allocation_targets_unit_idx on public.allocation_rule_targets(business_unit_id);
create index allocation_driver_period_idx on public.allocation_driver_values(financial_period_id);
create index allocation_runs_version_period_idx on public.allocation_runs(allocation_rule_version_id,financial_period_id);
create index allocation_runs_status_idx on public.allocation_runs(status);
create index allocation_run_sources_line_idx on public.allocation_run_sources(journal_line_id);
create index allocation_distributions_run_idx on public.allocation_run_distributions(allocation_run_id);
create index allocation_approvals_run_idx on public.allocation_approvals(allocation_run_id);

create or replace function private.allocation_rule_unit_code(p_rule_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select bu.code
  from public.allocation_rules r
  join public.business_units bu on bu.id = r.source_business_unit_id
  where r.id = p_rule_id
$$;

create or replace function private.allocation_version_unit_code(p_version_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.allocation_rule_unit_code(v.allocation_rule_id)
  from public.allocation_rule_versions v
  where v.id = p_version_id
$$;

create or replace function private.allocation_run_unit_code(p_run_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.allocation_version_unit_code(r.allocation_rule_version_id)
  from public.allocation_runs r
  where r.id = p_run_id
$$;

create or replace function private.validate_allocation_rule_source()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_legal_entity uuid;
begin
  select legal_entity_id into v_legal_entity
  from public.business_units
  where id = new.source_business_unit_id;

  if v_legal_entity is null or v_legal_entity <> new.legal_entity_id then
    raise exception 'A unidade de origem deve pertencer à pessoa jurídica da regra.';
  end if;

  return new;
end;
$$;

create or replace function private.validate_allocation_version_source()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_source_unit uuid;
  v_dimension_unit uuid;
begin
  select source_business_unit_id into v_source_unit
  from public.allocation_rules
  where id = new.allocation_rule_id;

  if new.source_cost_center_id is not null then
    select business_unit_id into v_dimension_unit
    from public.cost_centers
    where id = new.source_cost_center_id;
    if v_dimension_unit is not null and v_dimension_unit <> v_source_unit then
      raise exception 'O centro de custo de origem não pertence à unidade de origem.';
    end if;
  end if;

  if new.source_project_id is not null then
    select business_unit_id into v_dimension_unit
    from public.projects
    where id = new.source_project_id;
    if v_dimension_unit <> v_source_unit then
      raise exception 'O projeto de origem não pertence à unidade de origem.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.validate_allocation_target_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_unit uuid;
begin
  if new.product_id is not null then
    select business_unit_id into v_unit from public.products where id = new.product_id;
    if v_unit <> new.business_unit_id then
      raise exception 'O produto de destino não pertence à unidade informada.';
    end if;
  end if;

  if new.service_line_id is not null then
    select business_unit_id into v_unit from public.service_lines where id = new.service_line_id;
    if v_unit <> new.business_unit_id then
      raise exception 'A linha de serviço de destino não pertence à unidade informada.';
    end if;
  end if;

  if new.project_id is not null then
    select business_unit_id into v_unit from public.projects where id = new.project_id;
    if v_unit <> new.business_unit_id then
      raise exception 'O projeto de destino não pertence à unidade informada.';
    end if;
  end if;

  if new.cost_center_id is not null then
    select business_unit_id into v_unit from public.cost_centers where id = new.cost_center_id;
    if v_unit is not null and v_unit <> new.business_unit_id then
      raise exception 'O centro de custo de destino não pertence à unidade informada.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.ensure_allocation_version_draft()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_version_id uuid;
  v_status text;
begin
  v_version_id := coalesce(new.allocation_rule_version_id, old.allocation_rule_version_id);
  select status into v_status from public.allocation_rule_versions where id = v_version_id;
  if v_status <> 'draft' then
    raise exception 'Somente versões de regra em rascunho podem ser alteradas.';
  end if;
  return coalesce(new,old);
end;
$$;

create or replace function private.protect_allocation_rule_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Somente versão em rascunho pode ser excluída.';
    end if;
    return old;
  end if;

  if old.status = 'draft' then
    if new.status not in ('draft','pending_approval') then
      raise exception 'Transição inválida da versão de rateio.';
    end if;
    return new;
  end if;

  if old.status = 'pending_approval' then
    if new.status not in ('approved','rejected') then
      raise exception 'Versão pendente só pode ser aprovada ou rejeitada.';
    end if;
    if row(
      new.allocation_rule_id,new.version_no,new.method,new.effective_start,new.effective_end,
      new.source_managerial_account_id,new.source_cost_center_id,new.source_category_id,
      new.source_project_id,new.residual_strategy,new.residual_business_unit_id,new.notes
    ) is distinct from row(
      old.allocation_rule_id,old.version_no,old.method,old.effective_start,old.effective_end,
      old.source_managerial_account_id,old.source_cost_center_id,old.source_category_id,
      old.source_project_id,old.residual_strategy,old.residual_business_unit_id,old.notes
    ) then
      raise exception 'A memória econômica não pode ser alterada durante a aprovação.';
    end if;
    return new;
  end if;

  if old.status = 'approved' and new.status = 'superseded' then
    if row(
      new.allocation_rule_id,new.version_no,new.method,new.effective_start,new.effective_end,
      new.source_managerial_account_id,new.source_cost_center_id,new.source_category_id,
      new.source_project_id,new.residual_strategy,new.residual_business_unit_id,new.notes
    ) is distinct from row(
      old.allocation_rule_id,old.version_no,old.method,old.effective_start,old.effective_end,
      old.source_managerial_account_id,old.source_cost_center_id,old.source_category_id,
      old.source_project_id,old.residual_strategy,old.residual_business_unit_id,old.notes
    ) then
      raise exception 'Versão aprovada é imutável.';
    end if;
    return new;
  end if;

  raise exception 'Versão de rateio consolidada é imutável.';
end;
$$;

create or replace function private.ensure_allocation_run_editable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_run_id uuid;
  v_status text;
begin
  v_run_id := coalesce(new.allocation_run_id, old.allocation_run_id);
  select status into v_status from public.allocation_runs where id = v_run_id;
  if v_status not in ('draft','simulated') then
    raise exception 'A execução de rateio não pode mais ser alterada.';
  end if;
  return coalesce(new,old);
end;
$$;

create or replace function private.validate_allocation_run_source()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_run public.allocation_runs;
  v_version public.allocation_rule_versions;
  v_rule public.allocation_rules;
  v_line public.journal_lines;
  v_entry public.journal_entries;
  v_account public.managerial_accounts;
  v_net numeric(18,2);
  v_already numeric(18,2);
begin
  select * into v_run from public.allocation_runs where id = new.allocation_run_id;
  if not found or v_run.status not in ('draft','simulated') then
    raise exception 'Execução de rateio não permite alteração de origens.';
  end if;

  select * into v_version from public.allocation_rule_versions where id = v_run.allocation_rule_version_id;
  select * into v_rule from public.allocation_rules where id = v_version.allocation_rule_id;
  select * into v_line from public.journal_lines where id = new.journal_line_id;
  select * into v_entry from public.journal_entries where id = v_line.journal_entry_id;
  select * into v_account from public.managerial_accounts where id = v_line.managerial_account_id;

  if v_entry.status <> 'posted' or v_entry.source_type in ('allocation','reversal') then
    raise exception 'Somente partidas postadas e não originadas de rateio/estorno podem ser rateadas.';
  end if;

  if v_line.business_unit_id <> v_rule.source_business_unit_id then
    raise exception 'A partida não pertence à unidade de origem da regra.';
  end if;

  if v_account.account_type not in ('expense','investment') then
    raise exception 'Somente custos, despesas ou investimentos podem ser rateados.';
  end if;

  if v_version.source_managerial_account_id is not null
     and v_line.managerial_account_id <> v_version.source_managerial_account_id then
    raise exception 'A partida não corresponde à conta de origem da regra.';
  end if;
  if v_version.source_cost_center_id is not null
     and v_line.cost_center_id is distinct from v_version.source_cost_center_id then
    raise exception 'A partida não corresponde ao centro de custo de origem.';
  end if;
  if v_version.source_category_id is not null
     and v_line.category_id is distinct from v_version.source_category_id then
    raise exception 'A partida não corresponde à categoria de origem.';
  end if;
  if v_version.source_project_id is not null
     and v_line.project_id is distinct from v_version.source_project_id then
    raise exception 'A partida não corresponde ao projeto de origem.';
  end if;

  v_net := round(v_line.debit_amount - v_line.credit_amount,2);
  if v_net <= 0 then
    raise exception 'A partida de origem não possui saldo devedor rateável.';
  end if;

  select coalesce(sum(s.selected_amount),0)
  into v_already
  from public.allocation_run_sources s
  join public.allocation_runs r on r.id=s.allocation_run_id
  where s.journal_line_id=new.journal_line_id
    and s.id is distinct from new.id
    and r.status='posted';

  new.available_amount_snapshot := round(v_net - v_already,2);
  if new.available_amount_snapshot <= 0 or new.selected_amount > new.available_amount_snapshot then
    raise exception 'O valor selecionado excede o saldo disponível para rateio.';
  end if;

  return new;
end;
$$;

create trigger allocation_rules_validate_source
before insert or update on public.allocation_rules
for each row execute function private.validate_allocation_rule_source();

create trigger allocation_versions_validate_source
before insert or update on public.allocation_rule_versions
for each row execute function private.validate_allocation_version_source();

create trigger allocation_versions_protect
before update or delete on public.allocation_rule_versions
for each row execute function private.protect_allocation_rule_version();

create trigger allocation_targets_validate_scope
before insert or update on public.allocation_rule_targets
for each row execute function private.validate_allocation_target_scope();

create trigger allocation_targets_require_draft
before insert or update or delete on public.allocation_rule_targets
for each row execute function private.ensure_allocation_version_draft();

create trigger allocation_driver_require_draft
before insert or update or delete on public.allocation_driver_values
for each row execute function private.ensure_allocation_version_draft();

create trigger allocation_run_sources_validate
before insert or update on public.allocation_run_sources
for each row execute function private.validate_allocation_run_source();

create trigger allocation_run_sources_editable
before delete on public.allocation_run_sources
for each row execute function private.ensure_allocation_run_editable();

create trigger allocation_distributions_editable
before insert or update or delete on public.allocation_run_distributions
for each row execute function private.ensure_allocation_run_editable();

do $$
declare t text;
begin
  foreach t in array array[
    'allocation_rules','allocation_rule_versions','allocation_rule_targets',
    'allocation_driver_values','allocation_runs','allocation_run_sources'
  ] loop
    execute format(
      'create trigger %I_touch before update on public.%I for each row execute function private.touch_updated_at()',
      t,t
    );
  end loop;

  foreach t in array array[
    'allocation_rules','allocation_rule_versions','allocation_rule_targets',
    'allocation_driver_values','allocation_runs','allocation_run_sources',
    'allocation_run_distributions','allocation_approvals'
  ] loop
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I for each row execute function private.audit_row_change()',
      t,t
    );
  end loop;
end $$;

alter table public.allocation_rules enable row level security;
alter table public.allocation_rule_versions enable row level security;
alter table public.allocation_rule_targets enable row level security;
alter table public.allocation_driver_values enable row level security;
alter table public.allocation_runs enable row level security;
alter table public.allocation_run_sources enable row level security;
alter table public.allocation_run_distributions enable row level security;
alter table public.allocation_approvals enable row level security;

create policy allocation_rules_select on public.allocation_rules
for select to authenticated
using (private.current_user_has_permission('allocation.read', private.unit_code_for_id(source_business_unit_id)));

create policy allocation_rules_insert on public.allocation_rules
for insert to authenticated
with check (
  status='draft'
  and private.current_user_has_permission('allocation.manage', private.unit_code_for_id(source_business_unit_id))
);

create policy allocation_rules_update on public.allocation_rules
for update to authenticated
using (
  status in ('draft','active','inactive')
  and private.current_user_has_permission('allocation.manage', private.unit_code_for_id(source_business_unit_id))
)
with check (
  private.current_user_has_permission('allocation.manage', private.unit_code_for_id(source_business_unit_id))
);

create policy allocation_rules_delete on public.allocation_rules
for delete to authenticated
using (
  status='draft'
  and not is_system
  and private.current_user_has_permission('allocation.manage', private.unit_code_for_id(source_business_unit_id))
);

create policy allocation_versions_select on public.allocation_rule_versions
for select to authenticated
using (private.current_user_has_permission('allocation.read', private.allocation_rule_unit_code(allocation_rule_id)));

create policy allocation_versions_insert on public.allocation_rule_versions
for insert to authenticated
with check (
  status='draft'
  and private.current_user_has_permission('allocation.manage', private.allocation_rule_unit_code(allocation_rule_id))
);

create policy allocation_versions_update_draft on public.allocation_rule_versions
for update to authenticated
using (
  status='draft'
  and private.current_user_has_permission('allocation.manage', private.allocation_rule_unit_code(allocation_rule_id))
)
with check (
  private.current_user_has_permission('allocation.manage', private.allocation_rule_unit_code(allocation_rule_id))
);

create policy allocation_versions_delete_draft on public.allocation_rule_versions
for delete to authenticated
using (
  status='draft'
  and private.current_user_has_permission('allocation.manage', private.allocation_rule_unit_code(allocation_rule_id))
);

create policy allocation_targets_select on public.allocation_rule_targets
for select to authenticated
using (private.current_user_has_permission('allocation.read', private.allocation_version_unit_code(allocation_rule_version_id)));

create policy allocation_targets_manage on public.allocation_rule_targets
for all to authenticated
using (
  private.current_user_has_permission('allocation.manage', private.allocation_version_unit_code(allocation_rule_version_id))
)
with check (
  private.current_user_has_permission('allocation.manage', private.allocation_version_unit_code(allocation_rule_version_id))
);

create policy allocation_drivers_select on public.allocation_driver_values
for select to authenticated
using (private.current_user_has_permission('allocation.read', private.allocation_version_unit_code(allocation_rule_version_id)));

create policy allocation_drivers_manage on public.allocation_driver_values
for all to authenticated
using (
  private.current_user_has_permission('allocation.manage', private.allocation_version_unit_code(allocation_rule_version_id))
)
with check (
  private.current_user_has_permission('allocation.manage', private.allocation_version_unit_code(allocation_rule_version_id))
);

create policy allocation_runs_select on public.allocation_runs
for select to authenticated
using (private.current_user_has_permission('allocation.read', private.allocation_version_unit_code(allocation_rule_version_id)));

create policy allocation_runs_insert on public.allocation_runs
for insert to authenticated
with check (
  status='draft'
  and private.current_user_has_permission('allocation.manage', private.allocation_version_unit_code(allocation_rule_version_id))
);

create policy allocation_runs_update_draft on public.allocation_runs
for update to authenticated
using (
  status in ('draft','simulated')
  and private.current_user_has_permission('allocation.manage', private.allocation_version_unit_code(allocation_rule_version_id))
)
with check (
  private.current_user_has_permission('allocation.manage', private.allocation_version_unit_code(allocation_rule_version_id))
);

create policy allocation_runs_delete_draft on public.allocation_runs
for delete to authenticated
using (
  status in ('draft','simulated','cancelled')
  and private.current_user_has_permission('allocation.manage', private.allocation_version_unit_code(allocation_rule_version_id))
);

create policy allocation_sources_select on public.allocation_run_sources
for select to authenticated
using (private.current_user_has_permission('allocation.read', private.allocation_run_unit_code(allocation_run_id)));

create policy allocation_sources_manage on public.allocation_run_sources
for all to authenticated
using (
  private.current_user_has_permission('allocation.manage', private.allocation_run_unit_code(allocation_run_id))
)
with check (
  private.current_user_has_permission('allocation.manage', private.allocation_run_unit_code(allocation_run_id))
);

create policy allocation_distributions_select on public.allocation_run_distributions
for select to authenticated
using (private.current_user_has_permission('allocation.read', private.allocation_run_unit_code(allocation_run_id)));

create policy allocation_approvals_select on public.allocation_approvals
for select to authenticated
using (private.current_user_has_permission('allocation.read', private.allocation_run_unit_code(allocation_run_id)));

grant select,insert,update,delete on public.allocation_rules to authenticated;
grant select,insert,update,delete on public.allocation_rule_versions to authenticated;
grant select,insert,update,delete on public.allocation_rule_targets to authenticated;
grant select,insert,update,delete on public.allocation_driver_values to authenticated;
grant select,insert,update,delete on public.allocation_runs to authenticated;
grant select,insert,update,delete on public.allocation_run_sources to authenticated;
grant select on public.allocation_run_distributions to authenticated;
grant select on public.allocation_approvals to authenticated;

revoke all on all tables in schema public from anon;
