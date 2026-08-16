create schema if not exists private;

create or replace function private.support_product_legal_entity_id(p_product_id uuid)
returns uuid language sql stable security definer set search_path=''
as $$
  select bu.legal_entity_id
  from public.products p
  join public.business_units bu on bu.id=p.business_unit_id
  where p.id=p_product_id and p.status in ('active','planned')
$$;

create or replace function private.support_product_unit_code(p_product_id uuid)
returns text language sql stable security definer set search_path=''
as $$
  select bu.code
  from public.products p
  join public.business_units bu on bu.id=p.business_unit_id
  where p.id=p_product_id
$$;

create or replace function private.support_assert_product_scope(p_legal_entity_id uuid,p_product_id uuid)
returns void language plpgsql stable security definer set search_path=''
as $$
declare v_legal_entity_id uuid;
begin
  if p_legal_entity_id is null or p_product_id is null then raise exception 'Pessoa jurídica e produto são obrigatórios.'; end if;
  v_legal_entity_id:=private.support_product_legal_entity_id(p_product_id);
  if v_legal_entity_id is null then raise exception 'Produto inexistente ou inativo.'; end if;
  if v_legal_entity_id<>p_legal_entity_id then raise exception 'O produto não pertence à pessoa jurídica informada.'; end if;
end
$$;

create table public.support_product_settings(
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  product_id uuid not null unique references public.products(id) on delete restrict,
  brand_name text not null,
  internal_description text,
  timezone text not null default 'America/Sao_Paulo',
  default_language text not null default 'pt-BR',
  status text not null default 'active' check(status in('active','inactive','archived')),
  identity_settings jsonb not null default '{}'::jsonb,
  automation_enabled boolean not null default false,
  fallback_queue_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  version bigint not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.support_product_members(
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  operation_role text not null check(operation_role in('admin','manager','supervisor','agent','viewer')),
  availability_status text not null default 'offline' check(availability_status in('offline','available','busy','away')),
  capacity integer not null default 5 check(capacity between 1 and 100),
  supervisor_user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'active' check(status in('active','inactive')),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  version bigint not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id,user_id)
);

create table public.support_business_hours(
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  product_id uuid references public.products(id) on delete cascade,
  name text not null,
  timezone text not null default 'America/Sao_Paulo',
  is_24_hours boolean not null default false,
  status text not null default 'active' check(status in('active','inactive','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  version bigint not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index support_business_hours_scope_name_unique on public.support_business_hours(legal_entity_id,product_id,name) nulls not distinct;

create table public.support_business_hour_intervals(
  id uuid primary key default gen_random_uuid(),
  business_hours_id uuid not null references public.support_business_hours(id) on delete cascade,
  weekday smallint not null check(weekday between 1 and 7),
  starts_at time not null,
  ends_at time not null,
  created_at timestamptz not null default now(),
  check(ends_at>starts_at),
  unique(business_hours_id,weekday,starts_at,ends_at)
);

create table public.support_holidays(
  id uuid primary key default gen_random_uuid(),
  business_hours_id uuid not null references public.support_business_hours(id) on delete cascade,
  holiday_date date not null,
  name text not null,
  is_closed boolean not null default true,
  special_starts_at time,
  special_ends_at time,
  created_at timestamptz not null default now(),
  check(is_closed or(special_starts_at is not null and special_ends_at is not null and special_ends_at>special_starts_at)),
  unique(business_hours_id,holiday_date)
);

create table public.support_sla_policies(
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  status text not null default 'active' check(status in('active','inactive','archived')),
  business_hours_id uuid references public.support_business_hours(id) on delete restrict,
  priority text check(priority is null or priority in('low','normal','high','urgent','critical')),
  conditions jsonb not null default '{}'::jsonb,
  first_response_minutes integer not null check(first_response_minutes>0),
  next_response_minutes integer check(next_response_minutes is null or next_response_minutes>0),
  resolution_minutes integer not null check(resolution_minutes>0),
  pause_statuses text[] not null default array['waiting_for_customer']::text[],
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  version bigint not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id,name)
);

create table public.support_queues(
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  product_id uuid references public.products(id) on delete cascade,
  code text not null check(code~'^[A-Z][A-Z0-9_]*$'),
  name text not null,
  description text,
  status text not null default 'active' check(status in('active','inactive','archived')),
  default_priority text not null default 'normal' check(default_priority in('low','normal','high','urgent','critical')),
  distribution_strategy text not null default 'manual' check(distribution_strategy in('manual','round_robin','least_loaded','specific_agent')),
  business_hours_id uuid references public.support_business_hours(id) on delete restrict,
  sla_policy_id uuid references public.support_sla_policies(id) on delete restrict,
  capacity integer check(capacity is null or capacity>0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  version bigint not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index support_queues_scope_code_unique on public.support_queues(legal_entity_id,product_id,code) nulls not distinct;
alter table public.support_product_settings add constraint support_product_settings_fallback_queue_id_fkey foreign key(fallback_queue_id) references public.support_queues(id) on delete set null;

create table public.support_queue_members(
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.support_queues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  membership_role text not null default 'agent' check(membership_role in('manager','supervisor','agent','viewer')),
  capacity integer check(capacity is null or capacity between 1 and 100),
  status text not null default 'active' check(status in('active','inactive')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(queue_id,user_id)
);

create table public.support_categories(
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete cascade,
  parent_id uuid references public.support_categories(id) on delete restrict,
  code text not null check(code~'^[A-Z][A-Z0-9_]*$'),
  name text not null,
  description text,
  status text not null default 'active' check(status in('active','inactive','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  version bigint not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id,code)
);

create table public.support_tags(
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete cascade,
  code text not null check(code~'^[A-Z][A-Z0-9_]*$'),
  name text not null,
  status text not null default 'active' check(status in('active','inactive','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  version bigint not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id,code)
);

create table public.support_channels(
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete cascade,
  channel_type text not null check(channel_type in('web_chat','in_app','email','whatsapp','sms','manual','api')),
  name text not null,
  provider text,
  status text not null default 'not_configured' check(status in('not_configured','configured','active','disabled','error')),
  integration_connection_id uuid references public.integration_connections(id) on delete set null,
  external_identifier text,
  settings jsonb not null default '{}'::jsonb,
  last_error text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  version bigint not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id,channel_type,name),
  check(status not in('configured','active') or integration_connection_id is not null or channel_type in('manual','web_chat','in_app','api'))
);

create table public.support_message_templates(
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete cascade,
  code text not null check(code~'^[A-Z][A-Z0-9_]*$'),
  name text not null,
  category text not null,
  channel_type text check(channel_type is null or channel_type in('web_chat','in_app','email','whatsapp','sms','manual','api')),
  language_code text not null default 'pt-BR',
  status text not null default 'draft' check(status in('draft','active','archived')),
  content text not null,
  allowed_variables text[] not null default '{}'::text[],
  template_version integer not null default 1 check(template_version>0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  version bigint not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id,code,template_version)
);
create unique index support_templates_one_active_code on public.support_message_templates(product_id,code) where status='active';

create table public.support_forms(
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete cascade,
  code text not null check(code~'^[A-Z][A-Z0-9_]*$'),
  name text not null,
  description text,
  status text not null default 'draft' check(status in('draft','active','archived')),
  form_version integer not null default 1 check(form_version>0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  version bigint not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id,code,form_version)
);
create unique index support_forms_one_active_code on public.support_forms(product_id,code) where status='active';

create table public.support_form_fields(
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.support_forms(id) on delete cascade,
  field_key text not null check(field_key~'^[a-z][a-z0-9_]*$'),
  label text not null,
  field_type text not null check(field_type in('text','textarea','email','phone','number','date','datetime','select','multi_select','checkbox','radio','file')),
  display_order integer not null check(display_order>0),
  is_required boolean not null default false,
  placeholder text,
  help_text text,
  default_value jsonb,
  validation_rules jsonb not null default '{}'::jsonb,
  options jsonb not null default '[]'::jsonb,
  display_condition jsonb,
  privacy_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(form_id,field_key),
  unique(form_id,display_order)
);
