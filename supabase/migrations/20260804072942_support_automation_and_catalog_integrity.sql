create table public.support_automation_flows(
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  product_id uuid not null unique references public.products(id) on delete cascade,
  status text not null default 'active' check(status in('active','inactive','archived')),
  published_version_id uuid,
  draft_version_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  version bigint not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.support_automation_versions(
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.support_automation_flows(id) on delete cascade,
  version_number integer not null check(version_number>0),
  status text not null default 'draft' check(status in('draft','published','archived')),
  welcome_message text,
  invalid_option_message text,
  inactivity_message text,
  out_of_hours_message text,
  human_handoff_message text,
  closing_message text,
  return_commands text[] not null default array['menu','voltar']::text[],
  invalid_attempt_limit integer not null default 3 check(invalid_attempt_limit between 1 and 20),
  inactivity_minutes integer not null default 30 check(inactivity_minutes between 1 and 10080),
  inactivity_action text not null default 'return_to_menu' check(inactivity_action in('return_to_menu','human_handoff','close_conversation','none')),
  fallback_queue_id uuid references public.support_queues(id) on delete restrict,
  language_code text not null default 'pt-BR',
  timezone text not null default 'America/Sao_Paulo',
  menu_render_mode text not null default 'auto_generated' check(menu_render_mode in('auto_generated','custom')),
  custom_menu_text text,
  validation_errors jsonb not null default '[]'::jsonb,
  published_at timestamptz,
  published_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  version bigint not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(flow_id,version_number),
  check(menu_render_mode<>'custom' or nullif(btrim(custom_menu_text),'') is not null),
  check(status<>'published' or(published_at is not null and published_by is not null))
);

alter table public.support_automation_flows add constraint support_automation_flows_published_version_id_fkey foreign key(published_version_id) references public.support_automation_versions(id) on delete set null;
alter table public.support_automation_flows add constraint support_automation_flows_draft_version_id_fkey foreign key(draft_version_id) references public.support_automation_versions(id) on delete set null;

create table public.support_routing_options(
  id uuid primary key default gen_random_uuid(),
  automation_version_id uuid not null references public.support_automation_versions(id) on delete cascade,
  display_order integer not null check(display_order>0),
  title text not null,
  description text,
  status text not null default 'active' check(status in('active','inactive')),
  category_id uuid references public.support_categories(id) on delete restrict,
  queue_id uuid references public.support_queues(id) on delete restrict,
  default_assignee_user_id uuid references public.profiles(id) on delete set null,
  priority text not null default 'normal' check(priority in('low','normal','high','urgent','critical')),
  response_template_id uuid references public.support_message_templates(id) on delete restrict,
  form_id uuid references public.support_forms(id) on delete restrict,
  action_type text not null check(action_type in('collect_form','assign_queue','assign_agent','create_ticket','send_template','close_conversation','return_to_menu','human_handoff')),
  action_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(automation_version_id,display_order)
);

create table public.support_routing_option_tags(
  routing_option_id uuid not null references public.support_routing_options(id) on delete cascade,
  tag_id uuid not null references public.support_tags(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(routing_option_id,tag_id)
);

create table public.support_external_identities(
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete cascade,
  party_id uuid not null references public.parties(id) on delete cascade,
  integration_connection_id uuid references public.integration_connections(id) on delete cascade,
  identity_type text not null check(identity_type in('external_user_id','external_tenant_id','external_account_id','channel_identifier')),
  external_value text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index support_external_identities_unique on public.support_external_identities(product_id,integration_connection_id,identity_type,external_value) nulls not distinct;

create or replace function private.support_validate_product_scope_trigger()
returns trigger language plpgsql set search_path=''
as $$ begin perform private.support_assert_product_scope(new.legal_entity_id,new.product_id); return new; end $$;

create or replace function private.support_validate_optional_product_scope_trigger()
returns trigger language plpgsql set search_path=''
as $$
begin
  if new.product_id is not null then perform private.support_assert_product_scope(new.legal_entity_id,new.product_id);
  elsif not exists(select 1 from public.legal_entities where id=new.legal_entity_id and status='active') then raise exception 'Pessoa jurídica inexistente ou inativa.';
  end if;
  return new;
end
$$;

create or replace function private.support_user_is_eligible(p_product_id uuid,p_user_id uuid,p_queue_id uuid default null)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.profiles pr
    join public.support_product_members pm on pm.user_id=pr.id and pm.product_id=p_product_id and pm.status='active' and pm.operation_role in('admin','manager','supervisor','agent')
    where pr.id=p_user_id and pr.status='active'
      and(p_queue_id is null or exists(select 1 from public.support_queue_members qm where qm.queue_id=p_queue_id and qm.user_id=p_user_id and qm.status='active' and qm.membership_role in('manager','supervisor','agent')))
  )
$$;

create or replace function private.support_validate_product_member_trigger()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  perform private.support_assert_product_scope(new.legal_entity_id,new.product_id);
  if not exists(select 1 from public.profiles where id=new.user_id and status='active') then raise exception 'Somente usuários ativos podem participar do atendimento.'; end if;
  if new.supervisor_user_id is not null and not exists(select 1 from public.profiles where id=new.supervisor_user_id and status='active') then raise exception 'Supervisor inexistente ou inativo.'; end if;
  return new;
end
$$;

create or replace function private.support_validate_queue_member_trigger()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_queue public.support_queues%rowtype;
begin
  select * into v_queue from public.support_queues where id=new.queue_id and status='active';
  if not found then raise exception 'Fila inexistente ou inativa.'; end if;
  if not exists(select 1 from public.profiles where id=new.user_id and status='active') then raise exception 'Somente usuários ativos podem participar de filas.'; end if;
  if v_queue.product_id is not null and not exists(select 1 from public.support_product_members where product_id=v_queue.product_id and user_id=new.user_id and status='active') then raise exception 'O usuário não possui vínculo ativo com o produto da fila.'; end if;
  return new;
end
$$;

create or replace function private.support_validate_product_settings_trigger()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_queue record;
begin
  perform private.support_assert_product_scope(new.legal_entity_id,new.product_id);
  if new.fallback_queue_id is not null then
    select legal_entity_id,product_id,status into v_queue from public.support_queues where id=new.fallback_queue_id;
    if not found or v_queue.status<>'active' or v_queue.legal_entity_id<>new.legal_entity_id or(v_queue.product_id is not null and v_queue.product_id<>new.product_id) then raise exception 'Fila de fallback inválida para o produto.'; end if;
  end if;
  return new;
end
$$;

create or replace function private.support_validate_sla_trigger()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_hours record;
begin
  perform private.support_assert_product_scope(new.legal_entity_id,new.product_id);
  if new.business_hours_id is not null then
    select legal_entity_id,product_id,status into v_hours from public.support_business_hours where id=new.business_hours_id;
    if not found or v_hours.status<>'active' or v_hours.legal_entity_id<>new.legal_entity_id or(v_hours.product_id is not null and v_hours.product_id<>new.product_id) then raise exception 'Horário de atendimento inválido para a política de SLA.'; end if;
  end if;
  return new;
end
$$;

create or replace function private.support_validate_queue_trigger()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_hours record;v_sla record;
begin
  if new.product_id is not null then perform private.support_assert_product_scope(new.legal_entity_id,new.product_id);
  elsif not exists(select 1 from public.legal_entities where id=new.legal_entity_id and status='active') then raise exception 'Pessoa jurídica inexistente ou inativa.';
  end if;
  if new.business_hours_id is not null then
    select legal_entity_id,product_id,status into v_hours from public.support_business_hours where id=new.business_hours_id;
    if not found or v_hours.status<>'active' or v_hours.legal_entity_id<>new.legal_entity_id or(new.product_id is not null and v_hours.product_id is not null and v_hours.product_id<>new.product_id) then raise exception 'Horário de atendimento inválido para a fila.'; end if;
  end if;
  if new.sla_policy_id is not null then
    if new.product_id is null then raise exception 'Fila compartilhada não pode usar SLA específico sem produto.'; end if;
    select legal_entity_id,product_id,status into v_sla from public.support_sla_policies where id=new.sla_policy_id;
    if not found or v_sla.status<>'active' or v_sla.legal_entity_id<>new.legal_entity_id or v_sla.product_id<>new.product_id then raise exception 'Política de SLA inválida para a fila.'; end if;
  end if;
  return new;
end
$$;

create or replace function private.support_validate_template_variables()
returns trigger language plpgsql set search_path=''
as $$
declare v_variable text;
begin
  for v_variable in select(regexp_matches(new.content,'\{\{([a-z][a-z0-9_]*)\}\}','g'))[1] loop
    if not(v_variable=any(new.allowed_variables)) then raise exception 'Variável não autorizada no template: %',v_variable; end if;
  end loop;
  if lower(new.content)~'<script|javascript:|onerror\s*=|onload\s*=' then raise exception 'Conteúdo potencialmente inseguro no template.'; end if;
  return new;
end
$$;

create or replace function private.support_protect_published_automation_version()
returns trigger language plpgsql set search_path=''
as $$
begin
  if old.status='published' then raise exception 'Versões publicadas de automação são imutáveis.'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end
$$;

create or replace function private.support_validate_flow_links()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.published_version_id is not null and not exists(select 1 from public.support_automation_versions where id=new.published_version_id and flow_id=new.id and status='published') then raise exception 'Versão publicada inválida para o fluxo.'; end if;
  if new.draft_version_id is not null and not exists(select 1 from public.support_automation_versions where id=new.draft_version_id and flow_id=new.id and status='draft') then raise exception 'Rascunho inválido para o fluxo.'; end if;
  return new;
end
$$;

create or replace function private.support_validate_routing_option()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_product uuid;v_version_status text;v_queue record;v_reference_product uuid;
begin
  select f.product_id,v.status into v_product,v_version_status from public.support_automation_versions v join public.support_automation_flows f on f.id=v.flow_id where v.id=new.automation_version_id;
  if not found or v_version_status<>'draft' then raise exception 'Opções só podem ser alteradas em rascunhos.'; end if;
  if new.queue_id is not null then
    select product_id,status into v_queue from public.support_queues where id=new.queue_id;
    if not found or v_queue.status<>'active' or(v_queue.product_id is not null and v_queue.product_id<>v_product) then raise exception 'Fila inválida para a opção.'; end if;
  end if;
  if new.default_assignee_user_id is not null and not private.support_user_is_eligible(v_product,new.default_assignee_user_id,new.queue_id) then raise exception 'Responsável padrão inválido.'; end if;
  if new.response_template_id is not null then select product_id into v_reference_product from public.support_message_templates where id=new.response_template_id and status='active';if not found or v_reference_product<>v_product then raise exception 'Template inválido para a opção.';end if;end if;
  if new.form_id is not null then select product_id into v_reference_product from public.support_forms where id=new.form_id and status='active';if not found or v_reference_product<>v_product then raise exception 'Formulário inválido para a opção.';end if;end if;
  if new.category_id is not null then select product_id into v_reference_product from public.support_categories where id=new.category_id and status='active';if not found or v_reference_product<>v_product then raise exception 'Categoria inválida para a opção.';end if;end if;
  return new;
end
$$;

create or replace function private.support_validate_routing_option_tag()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_option_product uuid;v_tag_product uuid;v_status text;
begin
  select f.product_id,v.status into v_option_product,v_status from public.support_routing_options o join public.support_automation_versions v on v.id=o.automation_version_id join public.support_automation_flows f on f.id=v.flow_id where o.id=new.routing_option_id;
  select product_id into v_tag_product from public.support_tags where id=new.tag_id and status='active';
  if v_option_product is null or v_tag_product is null or v_option_product<>v_tag_product then raise exception 'Tag pertence a outro produto ou está inativa.'; end if;
  if v_status<>'draft' then raise exception 'Tags só podem ser alteradas em rascunhos.'; end if;
  return new;
end
$$;

create or replace function public.support_calculate_due_at(p_started_at timestamptz,p_minutes integer,p_business_hours_id uuid default null)
returns timestamptz language plpgsql stable security definer set search_path=''
as $$
declare v_calendar record;v_local timestamp;v_date date;v_remaining integer:=p_minutes;v_interval record;v_start timestamp;v_end timestamp;v_available integer;v_holiday record;v_guard integer:=0;
begin
  if p_minutes is null or p_minutes<=0 then raise exception 'Minutos de SLA inválidos.'; end if;
  if p_business_hours_id is null then return p_started_at+make_interval(mins=>p_minutes); end if;
  select timezone,is_24_hours into v_calendar from public.support_business_hours where id=p_business_hours_id and status='active';
  if not found then raise exception 'Calendário de atendimento inexistente ou inativo.'; end if;
  if v_calendar.is_24_hours then return p_started_at+make_interval(mins=>p_minutes); end if;
  v_local:=p_started_at at time zone v_calendar.timezone;
  while v_remaining>0 loop
    v_guard:=v_guard+1;if v_guard>400 then raise exception 'Não foi possível calcular o SLA no calendário configurado.';end if;
    v_date:=v_local::date;
    select * into v_holiday from public.support_holidays where business_hours_id=p_business_hours_id and holiday_date=v_date;
    if found and v_holiday.is_closed then v_local:=(v_date+1)::timestamp;continue;end if;
    if found and not v_holiday.is_closed then
      v_start:=v_date+v_holiday.special_starts_at;v_end:=v_date+v_holiday.special_ends_at;if v_local<v_start then v_local:=v_start;end if;
      if v_local<v_end then v_available:=floor(extract(epoch from(v_end-v_local))/60);if v_available>=v_remaining then v_local:=v_local+make_interval(mins=>v_remaining);v_remaining:=0;else v_remaining:=v_remaining-greatest(v_available,0);v_local:=(v_date+1)::timestamp;end if;else v_local:=(v_date+1)::timestamp;end if;
      continue;
    end if;
    for v_interval in select starts_at,ends_at from public.support_business_hour_intervals where business_hours_id=p_business_hours_id and weekday=extract(isodow from v_date)::int order by starts_at loop
      v_start:=v_date+v_interval.starts_at;v_end:=v_date+v_interval.ends_at;if v_local<v_start then v_local:=v_start;end if;if v_local>=v_end then continue;end if;
      v_available:=floor(extract(epoch from(v_end-v_local))/60);if v_available>=v_remaining then v_local:=v_local+make_interval(mins=>v_remaining);v_remaining:=0;exit;end if;v_remaining:=v_remaining-greatest(v_available,0);v_local:=v_end;
    end loop;
    if v_remaining>0 then v_local:=(v_date+1)::timestamp;end if;
  end loop;
  return v_local at time zone v_calendar.timezone;
end
$$;

do $$ declare v_table text;begin
  foreach v_table in array array['support_categories','support_tags','support_channels','support_message_templates','support_forms','support_automation_flows','support_external_identities'] loop
    execute format('create trigger %I_scope before insert or update on public.%I for each row execute function private.support_validate_product_scope_trigger()',v_table,v_table);
  end loop;
end $$;
create trigger support_product_settings_scope before insert or update on public.support_product_settings for each row execute function private.support_validate_product_settings_trigger();
create trigger support_product_members_scope before insert or update on public.support_product_members for each row execute function private.support_validate_product_member_trigger();
create trigger support_business_hours_scope before insert or update on public.support_business_hours for each row execute function private.support_validate_optional_product_scope_trigger();
create trigger support_sla_policies_scope before insert or update on public.support_sla_policies for each row execute function private.support_validate_sla_trigger();
create trigger support_queues_scope before insert or update on public.support_queues for each row execute function private.support_validate_queue_trigger();
create trigger support_queue_members_scope before insert or update on public.support_queue_members for each row execute function private.support_validate_queue_member_trigger();
create trigger support_templates_validate before insert or update on public.support_message_templates for each row execute function private.support_validate_template_variables();
create trigger support_automation_versions_protect before update or delete on public.support_automation_versions for each row execute function private.support_protect_published_automation_version();
create constraint trigger support_automation_flows_links after insert or update of published_version_id,draft_version_id on public.support_automation_flows deferrable initially deferred for each row execute function private.support_validate_flow_links();
create trigger support_routing_options_scope before insert or update on public.support_routing_options for each row execute function private.support_validate_routing_option();
create trigger support_routing_option_tags_scope before insert or update on public.support_routing_option_tags for each row execute function private.support_validate_routing_option_tag();

do $$ declare v_table text;begin
  foreach v_table in array array['support_product_settings','support_product_members','support_business_hours','support_sla_policies','support_queues','support_categories','support_tags','support_channels','support_message_templates','support_forms','support_automation_flows','support_automation_versions'] loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function private.touch_updated_at()',v_table,v_table);
  end loop;
  foreach v_table in array array['support_product_settings','support_product_members','support_business_hours','support_business_hour_intervals','support_holidays','support_sla_policies','support_queues','support_queue_members','support_categories','support_tags','support_channels','support_message_templates','support_forms','support_form_fields','support_automation_flows','support_automation_versions','support_routing_options','support_routing_option_tags','support_external_identities'] loop
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function private.audit_row_change()',v_table,v_table);
  end loop;
end $$;

create index support_product_members_product_status_idx on public.support_product_members(product_id,status,user_id);
create index support_queues_tenant_product_status_idx on public.support_queues(legal_entity_id,product_id,status);
create index support_queue_members_queue_status_idx on public.support_queue_members(queue_id,status,user_id);
create index support_channels_product_status_idx on public.support_channels(product_id,status,channel_type);
create index support_templates_product_status_idx on public.support_message_templates(product_id,status,code);
create index support_forms_product_status_idx on public.support_forms(product_id,status,code);
create index support_automation_versions_flow_status_idx on public.support_automation_versions(flow_id,status,version_number desc);

revoke all on function public.support_calculate_due_at(timestamptz,integer,uuid) from public,anon;
grant execute on function public.support_calculate_due_at(timestamptz,integer,uuid) to authenticated,service_role;
