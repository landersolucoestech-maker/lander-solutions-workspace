-- Consolidate legacy HR equipment into corporate_assets and canonical asset_assignments.
-- Legacy tables remain readable but become non-writable after reconciliation.

do $$
begin
  if exists (
    select 1
    from public.equipment e
    left join public.business_units bu on bu.id = e.business_unit_id
    where bu.id is null or bu.legal_entity_id is null
  ) then
    raise exception 'Existem equipamentos sem unidade ou entidade jurídica derivável.';
  end if;

  if exists (
    select 1 from public.equipment e
    join public.corporate_assets a on a.id = e.id
  ) then
    raise exception 'Existe colisão de UUID entre equipment e corporate_assets.';
  end if;

  if exists (
    select 1
    from public.corporate_assets
    where asset_type in ('trademark','copyright','contractual_right')
  ) then
    raise exception 'Existem ativos incompatíveis com a fronteira Patrimônio e Licenças.';
  end if;

  if exists (select 1 from public.equipment)
    and not exists (select 1 from public.profiles) then
    raise exception 'Nenhum perfil disponível para preservar autoria da migração patrimonial.';
  end if;
end;
$$;

insert into public.permissions (code, module, action, description)
values ('assets.approve_events', 'assets', 'approve_events', 'Aprovar e aplicar eventos patrimoniais críticos.')
on conflict (code) do update
set module = excluded.module,
    action = excluded.action,
    description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select distinct rp.role_id, target.id
from public.role_permissions rp
join public.permissions source on source.id = rp.permission_id
join public.permissions target on target.code = 'assets.approve_events'
where source.code = 'assets.approve'
on conflict do nothing;

alter table public.corporate_assets
  add column manufacturer text,
  add column model text,
  add column equipment_type text,
  add column operational_condition text,
  add column legacy_source text,
  add column legacy_source_id uuid;

alter table public.corporate_assets
  add constraint corporate_assets_operational_condition_check
  check (operational_condition is null or operational_condition in ('new','good','fair','damaged','unknown'));

alter table public.corporate_assets
  add constraint corporate_assets_legacy_source_check
  check (legacy_source is null or legacy_source in ('equipment'));

create unique index corporate_assets_legacy_source_id_key
  on public.corporate_assets (legacy_source, legacy_source_id)
  where legacy_source is not null and legacy_source_id is not null;

alter table public.corporate_assets
  drop constraint corporate_assets_asset_type_check;

alter table public.corporate_assets
  add constraint corporate_assets_asset_type_check
  check (asset_type in (
    'equipment','computer','mobile_device','vehicle','furniture','audiovisual_equipment',
    'software_license','domain','digital_certificate','other'
  ));

create table public.asset_assignments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.corporate_assets(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  delivered_at date not null,
  expected_return_date date,
  returned_at date,
  delivery_condition text not null,
  return_condition text,
  status text not null default 'active',
  notes text,
  assigned_by uuid references auth.users(id) on delete set null,
  returned_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  legacy_source text,
  legacy_source_id uuid,
  constraint asset_assignments_dates_check check (returned_at is null or returned_at >= delivered_at),
  constraint asset_assignments_expected_return_check check (expected_return_date is null or expected_return_date >= delivered_at),
  constraint asset_assignments_delivery_condition_check check (delivery_condition in ('new','good','fair','damaged','unknown')),
  constraint asset_assignments_return_condition_check check (return_condition is null or return_condition in ('new','good','fair','damaged','unknown')),
  constraint asset_assignments_status_check check (status in ('active','returned','cancelled')),
  constraint asset_assignments_return_check check (
    status <> 'returned' or (returned_at is not null and return_condition is not null and returned_by is not null)
  ),
  constraint asset_assignments_legacy_source_check check (legacy_source is null or legacy_source = 'equipment_assignments')
);

create unique index asset_assignments_one_active_per_asset_idx
  on public.asset_assignments (asset_id)
  where status = 'active';
create index asset_assignments_employee_status_idx
  on public.asset_assignments (employee_id, status, delivered_at desc);
create unique index asset_assignments_legacy_source_id_key
  on public.asset_assignments (legacy_source, legacy_source_id)
  where legacy_source is not null and legacy_source_id is not null;

insert into public.corporate_assets (
  id,
  legal_entity_id,
  business_unit_id,
  code,
  name,
  description,
  asset_type,
  ownership_type,
  status,
  serial_number,
  asset_category,
  asset_tag,
  quantity,
  current_value,
  depreciation_method,
  custodian_user_id,
  responsible_user_id,
  manufacturer,
  model,
  equipment_type,
  operational_condition,
  notes,
  legacy_source,
  legacy_source_id,
  created_by,
  created_at,
  updated_at
)
select
  e.id,
  bu.legal_entity_id,
  e.business_unit_id,
  'ATV-' || left(upper(regexp_replace(coalesce(nullif(e.asset_number, ''), 'EQ-' || left(replace(e.id::text, '-', ''), 8)), '[^A-Z0-9-]', '-', 'g')), 32),
  e.name,
  concat_ws(' · ', nullif(e.manufacturer, ''), nullif(e.model, '')),
  case
    when e.equipment_type in ('NOTEBOOK','DESKTOP','COMPUTER') then 'computer'
    when e.equipment_type in ('CELULAR','SMARTPHONE','TABLET','MOBILE_DEVICE') then 'mobile_device'
    when e.equipment_type in ('VEICULO','VEHICLE') then 'vehicle'
    when e.equipment_type in ('MOBILIARIO','FURNITURE') then 'furniture'
    when e.equipment_type in ('CAMERA','AUDIO','VIDEO','HEADSET','MICROFONE') then 'audiovisual_equipment'
    else 'equipment'
  end,
  'owned',
  case
    when e.status = 'MANUTENCAO' then 'maintenance'
    when e.status = 'INATIVO' then 'inactive'
    when e.status = 'BAIXADO' then 'disposed'
    when e.status = 'PERDIDO' then 'lost'
    when e.status = 'CANCELADO' then 'cancelled'
    else 'active'
  end,
  e.serial_number,
  'equipment',
  e.asset_number,
  1,
  0,
  'none',
  (
    select emp.user_id
    from public.equipment_assignments ea
    join public.employees emp on emp.id = ea.employee_id
    where ea.equipment_id = e.id and ea.status = 'ATIVO'
    order by ea.delivered_at desc
    limit 1
  ),
  (
    select emp.user_id
    from public.equipment_assignments ea
    join public.employees emp on emp.id = ea.employee_id
    where ea.equipment_id = e.id and ea.status = 'ATIVO'
    order by ea.delivered_at desc
    limit 1
  ),
  e.manufacturer,
  e.model,
  e.equipment_type,
  case e.condition
    when 'NOVO' then 'new'
    when 'BOM' then 'good'
    when 'REGULAR' then 'fair'
    when 'DANIFICADO' then 'damaged'
    else 'unknown'
  end,
  concat_ws(E'\n', nullif(e.notes, ''), 'Migrado do cadastro legado de equipamentos.'),
  'equipment',
  e.id,
  coalesce((select p.id from public.profiles p where p.id = e.created_by), (select p.id from public.profiles p order by p.created_at limit 1)),
  e.created_at,
  e.updated_at
from public.equipment e
join public.business_units bu on bu.id = e.business_unit_id;

insert into public.asset_assignments (
  id,
  asset_id,
  employee_id,
  delivered_at,
  expected_return_date,
  returned_at,
  delivery_condition,
  return_condition,
  status,
  notes,
  assigned_by,
  returned_by,
  created_by,
  updated_by,
  version,
  created_at,
  updated_at,
  legacy_source,
  legacy_source_id
)
select
  ea.id,
  ea.equipment_id,
  ea.employee_id,
  ea.delivered_at,
  ea.expected_return_date,
  ea.returned_at,
  case ea.delivery_condition
    when 'NOVO' then 'new'
    when 'BOM' then 'good'
    when 'REGULAR' then 'fair'
    when 'DANIFICADO' then 'damaged'
    else 'unknown'
  end,
  case ea.return_condition
    when 'NOVO' then 'new'
    when 'BOM' then 'good'
    when 'REGULAR' then 'fair'
    when 'DANIFICADO' then 'damaged'
    else null
  end,
  case ea.status when 'DEVOLVIDO' then 'returned' else 'active' end,
  ea.notes,
  ea.assigned_by,
  ea.returned_by,
  ea.created_by,
  ea.updated_by,
  ea.version,
  ea.created_at,
  ea.updated_at,
  'equipment_assignments',
  ea.id
from public.equipment_assignments ea;

create trigger asset_assignments_touch
before update on public.asset_assignments
for each row execute function private.touch_updated_at();

create trigger asset_assignments_audit
after insert or update or delete on public.asset_assignments
for each row execute function private.audit_row_change();

alter table public.asset_assignments enable row level security;

create policy asset_assignments_read
on public.asset_assignments for select to authenticated
using (
  public.has_permission('assets.read', null)
  or public.has_permission('assets.manage', null)
  or public.has_permission('assets.approve_events', null)
  or exists (
    select 1
    from public.corporate_assets a
    left join public.business_units bu on bu.id = a.business_unit_id
    where a.id = asset_assignments.asset_id
      and public.has_permission('hr.equipment.manage', bu.code)
  )
);

create policy asset_assignments_manage
on public.asset_assignments for all to authenticated
using (
  public.has_permission('assets.manage', null)
  or exists (
    select 1
    from public.corporate_assets a
    left join public.business_units bu on bu.id = a.business_unit_id
    where a.id = asset_assignments.asset_id
      and public.has_permission('hr.equipment.manage', bu.code)
  )
)
with check (
  public.has_permission('assets.manage', null)
  or exists (
    select 1
    from public.corporate_assets a
    left join public.business_units bu on bu.id = a.business_unit_id
    where a.id = asset_assignments.asset_id
      and public.has_permission('hr.equipment.manage', bu.code)
  )
);

revoke all on public.asset_assignments from anon;
grant select, insert, update, delete on public.asset_assignments to authenticated;

create or replace function private.block_legacy_equipment_write()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_setting('app.allow_legacy_governance_write', true) = 'on' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  raise exception 'Cadastro legado somente leitura. Utilize corporate_assets e asset_assignments.';
end;
$$;

create trigger equipment_block_legacy_write
before insert or update or delete on public.equipment
for each row execute function private.block_legacy_equipment_write();

create trigger equipment_assignments_block_legacy_write
before insert or update or delete on public.equipment_assignments
for each row execute function private.block_legacy_equipment_write();

do $$
declare
  v_equipment_count bigint;
  v_migrated_asset_count bigint;
  v_assignment_count bigint;
  v_migrated_assignment_count bigint;
begin
  select count(*) into v_equipment_count from public.equipment;
  select count(*) into v_migrated_asset_count
  from public.corporate_assets
  where legacy_source = 'equipment';

  select count(*) into v_assignment_count from public.equipment_assignments;
  select count(*) into v_migrated_assignment_count
  from public.asset_assignments
  where legacy_source = 'equipment_assignments';

  if v_equipment_count <> v_migrated_asset_count then
    raise exception 'Reconciliação patrimonial falhou: equipment %, corporate_assets migrados %.', v_equipment_count, v_migrated_asset_count;
  end if;
  if v_assignment_count <> v_migrated_assignment_count then
    raise exception 'Reconciliação de atribuições falhou: legado %, canônico %.', v_assignment_count, v_migrated_assignment_count;
  end if;
  if exists (
    select 1
    from public.asset_assignments aa
    left join public.corporate_assets a on a.id = aa.asset_id
    left join public.employees e on e.id = aa.employee_id
    where a.id is null or e.id is null
  ) then
    raise exception 'Existem atribuições patrimoniais órfãs após a migração.';
  end if;
end;
$$;

comment on table public.asset_assignments is 'Historical custody assignments referencing the canonical corporate_assets master.';
comment on column public.corporate_assets.equipment_type is 'Operational subtype used for equipment without creating a second asset master.';
comment on column public.corporate_assets.legacy_source_id is 'Traceability key for controlled legacy migrations; not a second source of truth.';
