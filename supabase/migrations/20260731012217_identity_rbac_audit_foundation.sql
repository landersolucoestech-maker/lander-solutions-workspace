create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default '',
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'inactive')),
  mfa_required boolean not null default true,
  last_seen_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_.-]*$'),
  name text not null,
  description text,
  is_system boolean not null default true,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_.-]*$'),
  module text not null,
  action text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.app_roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table public.user_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.app_roles(id) on delete restrict,
  unit_code text,
  status text not null default 'active' check (status in ('active', 'inactive', 'revoked')),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  granted_by uuid references public.profiles(id) on delete set null,
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  revocation_reason text,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_until > valid_from),
  check ((status = 'revoked' and revoked_at is not null) or status <> 'revoked')
);

create unique index user_role_assignments_active_unique
  on public.user_role_assignments(user_id, role_id, coalesce(unit_code, '__GLOBAL__'))
  where status = 'active' and valid_until is null;

create index user_role_assignments_user_idx on public.user_role_assignments(user_id);
create index user_role_assignments_role_idx on public.user_role_assignments(role_id);
create index user_role_assignments_unit_idx on public.user_role_assignments(unit_code) where unit_code is not null;

create table public.audit_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default clock_timestamp(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_session_id uuid,
  action text not null,
  entity_schema text not null,
  entity_table text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  request_id text
);

create index audit_events_occurred_at_idx on public.audit_events(occurred_at desc);
create index audit_events_actor_idx on public.audit_events(actor_user_id, occurred_at desc);
create index audit_events_entity_idx on public.audit_events(entity_table, entity_id, occurred_at desc);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  if to_jsonb(new) ? 'version' then
    new.version := coalesce(old.version, 0) + 1;
  end if;
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function private.touch_updated_at();

create trigger app_roles_touch_updated_at
before update on public.app_roles
for each row execute function private.touch_updated_at();

create trigger user_role_assignments_touch_updated_at
before update on public.user_role_assignments
for each row execute function private.touch_updated_at();

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, status, mfa_required)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email, ''),
    'pending',
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function private.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

create or replace function private.current_session_exists()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.sessions s
    where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
      and s.user_id = auth.uid()
  );
$$;

create or replace function private.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
  );
$$;

create or replace function private.current_user_has_permission(
  p_permission_code text,
  p_unit_code text default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.current_session_exists()
    and private.current_user_is_active()
    and exists (
      select 1
      from public.user_role_assignments ura
      join public.role_permissions rp on rp.role_id = ura.role_id
      join public.permissions perm on perm.id = rp.permission_id
      where ura.user_id = auth.uid()
        and ura.status = 'active'
        and ura.valid_from <= now()
        and (ura.valid_until is null or ura.valid_until > now())
        and perm.code = p_permission_code
        and (
          p_unit_code is null
          or ura.unit_code is null
          or ura.unit_code = p_unit_code
        )
    );
$$;

create or replace function private.current_user_has_aal2()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

grant execute on function private.current_session_exists() to authenticated;
grant execute on function private.current_user_is_active() to authenticated;
grant execute on function private.current_user_has_permission(text, text) to authenticated;
grant execute on function private.current_user_has_aal2() to authenticated;

create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_entity_id text;
  v_session_id uuid;
begin
  if tg_op = 'INSERT' then
    v_before := null;
    v_after := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
  else
    v_before := to_jsonb(old);
    v_after := null;
  end if;

  v_entity_id := coalesce(v_after ->> 'id', v_before ->> 'id');
  begin
    v_session_id := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  exception when others then
    v_session_id := null;
  end;

  insert into public.audit_events (
    actor_user_id,
    actor_session_id,
    action,
    entity_schema,
    entity_table,
    entity_id,
    before_data,
    after_data
  ) values (
    auth.uid(),
    v_session_id,
    lower(tg_op),
    tg_table_schema,
    tg_table_name,
    v_entity_id,
    v_before,
    v_after
  );

  return coalesce(new, old);
end;
$$;

revoke execute on function private.audit_row_change() from public, anon, authenticated;

create trigger profiles_audit
  after insert or update or delete on public.profiles
  for each row execute function private.audit_row_change();

create trigger app_roles_audit
  after insert or update or delete on public.app_roles
  for each row execute function private.audit_row_change();

create trigger permissions_audit
  after insert or update or delete on public.permissions
  for each row execute function private.audit_row_change();

create trigger role_permissions_audit
  after insert or update or delete on public.role_permissions
  for each row execute function private.audit_row_change();

create trigger user_role_assignments_audit
  after insert or update or delete on public.user_role_assignments
  for each row execute function private.audit_row_change();

insert into public.app_roles (code, name, description) values
  ('owner', 'Proprietário', 'Controle corporativo total, sujeito a MFA e auditoria.'),
  ('corporate_admin', 'Administrador corporativo', 'Administração operacional do sistema corporativo.'),
  ('finance_manager', 'Gestor financeiro', 'Gestão financeira, aprovações e fechamento.'),
  ('accounts_payable', 'Contas a pagar', 'Cadastro e processamento de obrigações a pagar.'),
  ('accounts_receivable', 'Contas a receber', 'Cadastro e acompanhamento de recebíveis.'),
  ('commercial', 'Comercial', 'CRM, oportunidades e propostas.'),
  ('unit_manager', 'Gestor de unidade', 'Gestão limitada às unidades atribuídas.'),
  ('contract_manager', 'Gestor de contratos', 'Gestão de contratos e obrigações.'),
  ('participation_manager', 'Responsável por participações', 'Apurações, participantes e repasses.'),
  ('legal', 'Jurídico', 'Contratos jurídicos e propriedade intelectual.'),
  ('compliance', 'Compliance', 'Riscos, políticas, incidentes e evidências.'),
  ('auditor', 'Auditor', 'Leitura de dados e trilha de auditoria.'),
  ('executive_readonly', 'Executivo somente leitura', 'Relatórios e indicadores executivos.'),
  ('readonly', 'Somente leitura', 'Leitura limitada ao escopo atribuído.')
on conflict (code) do nothing;

insert into public.permissions (code, module, action, description) values
  ('access.users.read', 'access', 'read_users', 'Visualizar usuários e perfis.'),
  ('access.users.manage', 'access', 'manage_users', 'Ativar, suspender e administrar usuários.'),
  ('access.roles.read', 'access', 'read_roles', 'Visualizar papéis e permissões.'),
  ('access.roles.manage', 'access', 'manage_roles', 'Administrar papéis, permissões e atribuições.'),
  ('audit.read', 'audit', 'read', 'Consultar a trilha de auditoria.'),
  ('security.sessions.read', 'security', 'read_sessions', 'Consultar sessões de usuários.'),
  ('security.sessions.revoke', 'security', 'revoke_sessions', 'Revogar sessões de usuários.'),
  ('security.mfa.manage', 'security', 'manage_mfa', 'Administrar exigências de MFA.'),
  ('corporate.read', 'corporate', 'read', 'Consultar estrutura corporativa.'),
  ('corporate.manage', 'corporate', 'manage', 'Administrar estrutura corporativa.'),
  ('finance.read', 'finance', 'read', 'Consultar informações financeiras.'),
  ('finance.manage', 'finance', 'manage', 'Cadastrar e alterar documentos financeiros permitidos.'),
  ('finance.approve', 'finance', 'approve', 'Aprovar operações financeiras.'),
  ('contracts.read', 'contracts', 'read', 'Consultar contratos.'),
  ('contracts.manage', 'contracts', 'manage', 'Administrar contratos em estados editáveis.'),
  ('contracts.approve', 'contracts', 'approve', 'Aprovar contratos e versões.'),
  ('participations.read', 'participations', 'read', 'Consultar participações e apurações.'),
  ('participations.manage', 'participations', 'manage', 'Administrar participantes e simulações.'),
  ('participations.approve', 'participations', 'approve', 'Aprovar apurações e ajustes.'),
  ('payouts.read', 'payouts', 'read', 'Consultar repasses.'),
  ('payouts.manage', 'payouts', 'manage', 'Preparar repasses.'),
  ('payouts.approve', 'payouts', 'approve', 'Aprovar repasses.'),
  ('payouts.pay', 'payouts', 'pay', 'Registrar pagamento de repasse.'),
  ('payouts.reverse', 'payouts', 'reverse', 'Reverter repasse formalmente.'),
  ('allocation.read', 'allocation', 'read', 'Consultar regras e execuções de rateio.'),
  ('allocation.manage', 'allocation', 'manage', 'Administrar regras e simulações de rateio.'),
  ('allocation.approve', 'allocation', 'approve', 'Aprovar rateios definitivos.'),
  ('legal.read', 'legal', 'read', 'Consultar ativos e documentos jurídicos.'),
  ('legal.manage', 'legal', 'manage', 'Administrar ativos e documentos jurídicos.'),
  ('compliance.read', 'compliance', 'read', 'Consultar compliance e riscos.'),
  ('compliance.manage', 'compliance', 'manage', 'Administrar compliance, riscos e incidentes.'),
  ('reports.read', 'reports', 'read', 'Consultar relatórios.'),
  ('reports.export', 'reports', 'export', 'Exportar relatórios autorizados.')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.app_roles r
cross join public.permissions p
where r.code = 'owner'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.app_roles r
join public.permissions p on p.code in (
  'access.users.read', 'access.users.manage', 'access.roles.read',
  'audit.read', 'corporate.read', 'corporate.manage',
  'finance.read', 'contracts.read', 'contracts.manage',
  'participations.read', 'payouts.read', 'allocation.read',
  'legal.read', 'compliance.read', 'reports.read', 'reports.export'
)
where r.code = 'corporate_admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.app_roles r
join public.permissions p on p.code in (
  'finance.read', 'finance.manage', 'finance.approve',
  'reports.read', 'reports.export', 'allocation.read', 'allocation.approve',
  'participations.read', 'payouts.read', 'payouts.approve', 'payouts.pay'
)
where r.code = 'finance_manager'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.app_roles r
join public.permissions p on p.code in ('finance.read', 'finance.manage', 'reports.read')
where r.code in ('accounts_payable', 'accounts_receivable')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.app_roles r
join public.permissions p on p.code in (
  'corporate.read', 'finance.read', 'contracts.read', 'contracts.manage',
  'participations.read', 'payouts.read', 'allocation.read', 'reports.read', 'reports.export'
)
where r.code = 'unit_manager'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.app_roles r
join public.permissions p on p.code in ('contracts.read', 'contracts.manage', 'contracts.approve', 'reports.read')
where r.code = 'contract_manager'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.app_roles r
join public.permissions p on p.code in (
  'participations.read', 'participations.manage', 'participations.approve',
  'payouts.read', 'payouts.manage', 'reports.read', 'reports.export'
)
where r.code = 'participation_manager'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.app_roles r
join public.permissions p on p.code in ('legal.read', 'legal.manage', 'contracts.read', 'reports.read')
where r.code = 'legal'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.app_roles r
join public.permissions p on p.code in ('compliance.read', 'compliance.manage', 'audit.read', 'reports.read')
where r.code = 'compliance'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.app_roles r
join public.permissions p on p.code in (
  'access.users.read', 'access.roles.read', 'audit.read', 'corporate.read',
  'finance.read', 'contracts.read', 'participations.read', 'payouts.read',
  'allocation.read', 'legal.read', 'compliance.read', 'reports.read', 'reports.export'
)
where r.code = 'auditor'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.app_roles r
join public.permissions p on p.code in (
  'corporate.read', 'finance.read', 'contracts.read', 'participations.read',
  'payouts.read', 'allocation.read', 'reports.read', 'reports.export'
)
where r.code in ('executive_readonly', 'readonly')
on conflict do nothing;

create or replace function private.bootstrap_first_owner(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_role_id uuid;
begin
  if exists (
    select 1
    from public.user_role_assignments ura
    join public.app_roles r on r.id = ura.role_id
    where r.code = 'owner' and ura.status = 'active'
  ) then
    raise exception 'An active owner assignment already exists.';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'Profile not found for user %.', p_user_id;
  end if;

  select id into v_owner_role_id from public.app_roles where code = 'owner';

  update public.profiles
  set status = 'active', mfa_required = true
  where id = p_user_id;

  insert into public.user_role_assignments (
    user_id, role_id, unit_code, status, granted_by
  ) values (
    p_user_id, v_owner_role_id, null, 'active', p_user_id
  );
end;
$$;

revoke execute on function private.bootstrap_first_owner(uuid) from public, anon, authenticated;
grant execute on function private.bootstrap_first_owner(uuid) to service_role;

alter table public.profiles enable row level security;
alter table public.app_roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_role_assignments enable row level security;
alter table public.audit_events enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.app_roles from anon;
revoke all on table public.permissions from anon;
revoke all on table public.role_permissions from anon;
revoke all on table public.user_role_assignments from anon;
revoke all on table public.audit_events from anon;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.app_roles to authenticated;
grant select, insert, update, delete on table public.permissions to authenticated;
grant select, insert, update, delete on table public.role_permissions to authenticated;
grant select, insert, update, delete on table public.user_role_assignments to authenticated;
grant select on table public.audit_events to authenticated;

grant usage, select on sequence public.audit_events_id_seq to authenticated;

create policy profiles_select_own_or_authorized
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or private.current_user_has_permission('access.users.read', null)
);

create policy profiles_update_authorized
on public.profiles
for update
to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('access.users.manage', null)
)
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('access.users.manage', null)
);

create policy app_roles_select_authorized
on public.app_roles
for select
to authenticated
using (private.current_user_has_permission('access.roles.read', null));

create policy app_roles_manage_authorized
on public.app_roles
for all
to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('access.roles.manage', null)
)
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('access.roles.manage', null)
);

create policy permissions_select_authorized
on public.permissions
for select
to authenticated
using (private.current_user_has_permission('access.roles.read', null));

create policy permissions_manage_authorized
on public.permissions
for all
to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('access.roles.manage', null)
)
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('access.roles.manage', null)
);

create policy role_permissions_select_authorized
on public.role_permissions
for select
to authenticated
using (private.current_user_has_permission('access.roles.read', null));

create policy role_permissions_manage_authorized
on public.role_permissions
for all
to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('access.roles.manage', null)
)
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('access.roles.manage', null)
);

create policy assignments_select_own_or_authorized
on public.user_role_assignments
for select
to authenticated
using (
  user_id = auth.uid()
  or private.current_user_has_permission('access.users.read', unit_code)
);

create policy assignments_manage_authorized
on public.user_role_assignments
for all
to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('access.roles.manage', unit_code)
)
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('access.roles.manage', unit_code)
);

create policy audit_events_select_authorized
on public.audit_events
for select
to authenticated
using (private.current_user_has_permission('audit.read', null));
