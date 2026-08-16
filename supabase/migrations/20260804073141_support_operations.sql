create table public.support_conversations(
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  channel_id uuid not null references public.support_channels(id) on delete restrict,
  contact_party_id uuid not null references public.parties(id) on delete restrict,
  organization_party_id uuid references public.parties(id) on delete set null,
  subject text,
  status text not null default 'new' check(status in('new','automation','waiting_for_customer','waiting_for_agent','open','pending','resolved','closed')),
  current_queue_id uuid references public.support_queues(id) on delete restrict,
  current_agent_user_id uuid references public.profiles(id) on delete set null,
  priority text not null default 'normal' check(priority in('low','normal','high','urgent','critical')),
  origin text not null default 'manual',
  external_identifier text,
  automation_version_id uuid references public.support_automation_versions(id) on delete restrict,
  last_message_preview text,
  last_activity_at timestamptz not null default now(),
  last_customer_reply_at timestamptz,
  last_agent_reply_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  version bigint not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(status<>'resolved' or resolved_at is not null),
  check(status<>'closed' or closed_at is not null)
);
create unique index support_conversations_external_unique on public.support_conversations(product_id,channel_id,external_identifier) where external_identifier is not null;

create table public.support_messages(
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  direction text not null check(direction in('inbound','outbound','internal')),
  sender_type text not null check(sender_type in('customer','agent','automation','system')),
  sender_user_id uuid references public.profiles(id) on delete set null,
  content_type text not null default 'text' check(content_type in('text','html','file','event')),
  body text,
  attachments jsonb not null default '[]'::jsonb,
  external_identifier text,
  delivery_status text not null default 'stored' check(delivery_status in('stored','queued','sent','delivered','failed','read')),
  idempotency_key text,
  created_at timestamptz not null default now(),
  check(jsonb_typeof(attachments)='array')
);
create unique index support_messages_idempotency_unique on public.support_messages(product_id,idempotency_key) where idempotency_key is not null;

create sequence public.support_ticket_number_seq;
create table public.support_tickets(
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  conversation_id uuid references public.support_conversations(id) on delete set null,
  contact_party_id uuid not null references public.parties(id) on delete restrict,
  organization_party_id uuid references public.parties(id) on delete set null,
  category_id uuid references public.support_categories(id) on delete restrict,
  subcategory_id uuid references public.support_categories(id) on delete restrict,
  queue_id uuid references public.support_queues(id) on delete restrict,
  agent_user_id uuid references public.profiles(id) on delete set null,
  priority text not null default 'normal' check(priority in('low','normal','high','urgent','critical')),
  status text not null default 'new' check(status in('new','open','pending','waiting_for_customer','waiting_for_agent','resolved','closed')),
  title text not null,
  description text,
  collected_data jsonb not null default '{}'::jsonb,
  sla_policy_id uuid references public.support_sla_policies(id) on delete restrict,
  first_response_due_at timestamptz,
  resolution_due_at timestamptz,
  first_responded_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  closure_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  version bigint not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(status<>'resolved' or resolved_at is not null),
  check(status<>'closed' or(closed_at is not null and nullif(btrim(closure_reason),'') is not null))
);

create table public.support_ticket_tags(
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  tag_id uuid not null references public.support_tags(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(ticket_id,tag_id)
);

create table public.support_ticket_events(
  id bigint generated always as identity primary key,
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  conversation_id uuid references public.support_conversations(id) on delete set null,
  event_type text not null check(event_type in('created','assigned','transferred','queue_changed','priority_changed','status_changed','response','internal_note','escalated','sla_breached','resolved','reopened','closed')),
  actor_user_id uuid references public.profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table public.support_assignments(
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  conversation_id uuid references public.support_conversations(id) on delete cascade,
  ticket_id uuid references public.support_tickets(id) on delete cascade,
  queue_id uuid references public.support_queues(id) on delete restrict,
  agent_user_id uuid references public.profiles(id) on delete set null,
  assigned_by uuid references public.profiles(id) on delete set null,
  reason text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  check((conversation_id is not null)::int+(ticket_id is not null)::int=1),
  check(ended_at is null or ended_at>=started_at)
);

create table public.support_escalation_rules(
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete cascade,
  sla_policy_id uuid references public.support_sla_policies(id) on delete cascade,
  queue_id uuid references public.support_queues(id) on delete cascade,
  name text not null,
  event_type text not null check(event_type in('first_response_at_risk','first_response_breached','resolution_at_risk','resolution_breached','customer_waiting','ticket_unassigned','critical_incident')),
  elapsed_minutes integer not null default 0 check(elapsed_minutes>=0),
  escalation_level integer not null default 1 check(escalation_level>0),
  recipient_role text,
  recipient_queue_id uuid references public.support_queues(id) on delete restrict,
  recipient_user_id uuid references public.profiles(id) on delete restrict,
  delivery_channels text[] not null default array['in_app']::text[],
  message text not null,
  priority text not null default 'normal' check(priority in('low','normal','high','urgent','critical')),
  status text not null default 'active' check(status in('active','inactive','archived')),
  display_order integer not null default 1 check(display_order>0),
  repeat_policy text not null default 'once' check(repeat_policy in('once','repeat_until_resolved')),
  repeat_interval_minutes integer check(repeat_interval_minutes is null or repeat_interval_minutes>0),
  notification_limit integer not null default 1 check(notification_limit>0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  version bigint not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(recipient_role is not null or recipient_queue_id is not null or recipient_user_id is not null),
  check(cardinality(delivery_channels)>0),
  check(repeat_policy<>'repeat_until_resolved' or repeat_interval_minutes is not null),
  unique(product_id,name)
);

create table public.support_notifications(
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  ticket_id uuid references public.support_tickets(id) on delete cascade,
  conversation_id uuid references public.support_conversations(id) on delete cascade,
  escalation_rule_id uuid references public.support_escalation_rules(id) on delete set null,
  recipient_user_id uuid references public.profiles(id) on delete set null,
  delivery_channel text not null check(delivery_channel in('in_app','email','whatsapp','sms','webhook')),
  status text not null default 'pending' check(status in('pending','processing','sent','failed','cancelled')),
  subject text,
  message text not null,
  idempotency_key text not null unique,
  attempt_count integer not null default 0 check(attempt_count>=0),
  next_attempt_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.support_webhook_events(
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid references public.legal_entities(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  channel_id uuid references public.support_channels(id) on delete restrict,
  provider text not null,
  event_type text not null,
  idempotency_key text not null unique,
  signature_valid boolean not null default false,
  status text not null default 'received' check(status in('received','processed','duplicate','rejected','failed')),
  payload jsonb not null,
  normalized_payload jsonb,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.support_outbox(
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  channel_id uuid not null references public.support_channels(id) on delete restrict,
  conversation_id uuid references public.support_conversations(id) on delete cascade,
  message_id uuid references public.support_messages(id) on delete cascade,
  destination text not null,
  payload jsonb not null,
  idempotency_key text not null unique,
  status text not null default 'pending' check(status in('pending','processing','sent','failed','dead_letter','cancelled')),
  attempt_count integer not null default 0 check(attempt_count>=0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.support_validate_queue_for_product(p_legal_entity_id uuid,p_product_id uuid,p_queue_id uuid)
returns void language plpgsql stable security definer set search_path=''
as $$ declare v_queue record;begin
  if p_queue_id is null then return;end if;
  select legal_entity_id,product_id,status into v_queue from public.support_queues where id=p_queue_id;
  if not found or v_queue.status<>'active' or v_queue.legal_entity_id<>p_legal_entity_id or(v_queue.product_id is not null and v_queue.product_id<>p_product_id) then raise exception 'Fila inválida para o produto.';end if;
end $$;

create or replace function private.support_validate_conversation()
returns trigger language plpgsql security definer set search_path=''
as $$ declare v_channel record;v_automation record;begin
  perform private.support_assert_product_scope(new.legal_entity_id,new.product_id);
  select legal_entity_id,product_id,status into v_channel from public.support_channels where id=new.channel_id;
  if not found or v_channel.status not in('active','configured') or v_channel.legal_entity_id<>new.legal_entity_id or v_channel.product_id<>new.product_id then raise exception 'Canal inválido para a conversa.';end if;
  if not exists(select 1 from public.parties where id=new.contact_party_id and party_type='person') then raise exception 'Contato inexistente ou incompatível.';end if;
  if new.organization_party_id is not null and not exists(select 1 from public.parties where id=new.organization_party_id and party_type='organization') then raise exception 'Organização inexistente ou incompatível.';end if;
  perform private.support_validate_queue_for_product(new.legal_entity_id,new.product_id,new.current_queue_id);
  if new.current_agent_user_id is not null and not private.support_user_is_eligible(new.product_id,new.current_agent_user_id,new.current_queue_id) then raise exception 'Agente inválido para a conversa.';end if;
  if new.automation_version_id is not null then
    select f.product_id,v.status into v_automation from public.support_automation_versions v join public.support_automation_flows f on f.id=v.flow_id where v.id=new.automation_version_id;
    if not found or v_automation.product_id<>new.product_id or v_automation.status<>'published' then raise exception 'Versão de automação inválida para a conversa.';end if;
  end if;
  return new;
end $$;

create or replace function private.support_validate_message()
returns trigger language plpgsql security definer set search_path=''
as $$ declare v_conversation record;begin
  perform private.support_assert_product_scope(new.legal_entity_id,new.product_id);
  select legal_entity_id,product_id into v_conversation from public.support_conversations where id=new.conversation_id;
  if not found or v_conversation.legal_entity_id<>new.legal_entity_id or v_conversation.product_id<>new.product_id then raise exception 'Conversa pertence a outro produto ou pessoa jurídica.';end if;
  if new.sender_type='agent' and(new.sender_user_id is null or not private.support_user_is_eligible(new.product_id,new.sender_user_id,null)) then raise exception 'Agente remetente inválido.';end if;
  if new.content_type<>'event' and coalesce(length(btrim(new.body)),0)=0 and jsonb_array_length(new.attachments)=0 then raise exception 'A mensagem deve conter texto ou anexo.';end if;
  return new;
end $$;

create or replace function private.support_generate_ticket_number()
returns trigger language plpgsql set search_path=''
as $$ begin if new.ticket_number is null or btrim(new.ticket_number)='' then new.ticket_number:='SUP-'||lpad(nextval('public.support_ticket_number_seq')::text,8,'0');end if;return new;end $$;

create or replace function private.support_validate_ticket()
returns trigger language plpgsql security definer set search_path=''
as $$ declare v_conversation record;v_sla record;v_category record;begin
  perform private.support_assert_product_scope(new.legal_entity_id,new.product_id);
  perform private.support_validate_queue_for_product(new.legal_entity_id,new.product_id,new.queue_id);
  if new.agent_user_id is not null and not private.support_user_is_eligible(new.product_id,new.agent_user_id,new.queue_id) then raise exception 'Agente inválido para o ticket.';end if;
  if new.conversation_id is not null then
    select legal_entity_id,product_id,contact_party_id,organization_party_id into v_conversation from public.support_conversations where id=new.conversation_id;
    if not found or v_conversation.legal_entity_id<>new.legal_entity_id or v_conversation.product_id<>new.product_id then raise exception 'Conversa inválida para o ticket.';end if;
    if v_conversation.contact_party_id<>new.contact_party_id or v_conversation.organization_party_id is distinct from new.organization_party_id then raise exception 'Contato ou organização diverge da conversa.';end if;
  end if;
  if new.sla_policy_id is not null then select legal_entity_id,product_id,status into v_sla from public.support_sla_policies where id=new.sla_policy_id;if not found or v_sla.status<>'active' or v_sla.legal_entity_id<>new.legal_entity_id or v_sla.product_id<>new.product_id then raise exception 'SLA inválido para o ticket.';end if;end if;
  if new.category_id is not null then select product_id,status into v_category from public.support_categories where id=new.category_id;if not found or v_category.status<>'active' or v_category.product_id<>new.product_id then raise exception 'Categoria inválida.';end if;end if;
  if new.subcategory_id is not null then select product_id,status into v_category from public.support_categories where id=new.subcategory_id;if not found or v_category.status<>'active' or v_category.product_id<>new.product_id then raise exception 'Subcategoria inválida.';end if;end if;
  return new;
end $$;

create or replace function private.support_validate_ticket_event()
returns trigger language plpgsql security definer set search_path=''
as $$ declare v_ticket record;begin
  select legal_entity_id,product_id,conversation_id into v_ticket from public.support_tickets where id=new.ticket_id;
  if not found or v_ticket.legal_entity_id<>new.legal_entity_id or v_ticket.product_id<>new.product_id then raise exception 'Evento pertence a ticket de outro produto ou pessoa jurídica.';end if;
  if new.conversation_id is not null and new.conversation_id is distinct from v_ticket.conversation_id then raise exception 'Conversa do evento diverge do ticket.';end if;
  return new;
end $$;

create or replace function private.support_validate_assignment()
returns trigger language plpgsql security definer set search_path=''
as $$ declare v_target record;begin
  perform private.support_assert_product_scope(new.legal_entity_id,new.product_id);
  if new.conversation_id is not null then select legal_entity_id,product_id into v_target from public.support_conversations where id=new.conversation_id;else select legal_entity_id,product_id into v_target from public.support_tickets where id=new.ticket_id;end if;
  if not found or v_target.legal_entity_id<>new.legal_entity_id or v_target.product_id<>new.product_id then raise exception 'Atribuição aponta para entidade de outro produto.';end if;
  perform private.support_validate_queue_for_product(new.legal_entity_id,new.product_id,new.queue_id);
  if new.agent_user_id is not null and not private.support_user_is_eligible(new.product_id,new.agent_user_id,new.queue_id) then raise exception 'Agente inválido para a atribuição.';end if;
  return new;
end $$;

create or replace function private.support_validate_escalation()
returns trigger language plpgsql security definer set search_path=''
as $$ declare v_reference record;begin
  perform private.support_assert_product_scope(new.legal_entity_id,new.product_id);
  if new.sla_policy_id is not null then select legal_entity_id,product_id,status into v_reference from public.support_sla_policies where id=new.sla_policy_id;if not found or v_reference.status<>'active' or v_reference.legal_entity_id<>new.legal_entity_id or v_reference.product_id<>new.product_id then raise exception 'SLA inválido para o escalonamento.';end if;end if;
  perform private.support_validate_queue_for_product(new.legal_entity_id,new.product_id,new.queue_id);
  perform private.support_validate_queue_for_product(new.legal_entity_id,new.product_id,new.recipient_queue_id);
  if new.recipient_user_id is not null and not private.support_user_is_eligible(new.product_id,new.recipient_user_id,new.recipient_queue_id) then raise exception 'Usuário destinatário inválido.';end if;
  if exists(select 1 from unnest(new.delivery_channels) channel where channel not in('in_app','email','whatsapp','sms','webhook')) then raise exception 'Canal de notificação inválido.';end if;
  return new;
end $$;

create or replace function private.support_validate_ticket_tag()
returns trigger language plpgsql security definer set search_path=''
as $$ declare v_ticket_product uuid;v_tag_product uuid;begin
  select product_id into v_ticket_product from public.support_tickets where id=new.ticket_id;
  select product_id into v_tag_product from public.support_tags where id=new.tag_id and status='active';
  if v_ticket_product is null or v_tag_product is null or v_ticket_product<>v_tag_product then raise exception 'Tag pertence a outro produto ou está inativa.';end if;return new;
end $$;

create or replace function private.support_validate_outbox()
returns trigger language plpgsql security definer set search_path=''
as $$ declare v_channel record;v_conversation record;v_message record;begin
  perform private.support_assert_product_scope(new.legal_entity_id,new.product_id);
  select legal_entity_id,product_id,status into v_channel from public.support_channels where id=new.channel_id;
  if not found or v_channel.status<>'active' or v_channel.legal_entity_id<>new.legal_entity_id or v_channel.product_id<>new.product_id then raise exception 'Canal inválido para a saída.';end if;
  if new.conversation_id is not null then select legal_entity_id,product_id into v_conversation from public.support_conversations where id=new.conversation_id;if not found or v_conversation.legal_entity_id<>new.legal_entity_id or v_conversation.product_id<>new.product_id then raise exception 'Conversa inválida para a saída.';end if;end if;
  if new.message_id is not null then select legal_entity_id,product_id,conversation_id into v_message from public.support_messages where id=new.message_id;if not found or v_message.legal_entity_id<>new.legal_entity_id or v_message.product_id<>new.product_id or(new.conversation_id is not null and v_message.conversation_id<>new.conversation_id) then raise exception 'Mensagem inválida para a saída.';end if;end if;
  return new;
end $$;

create trigger support_conversations_validate before insert or update on public.support_conversations for each row execute function private.support_validate_conversation();
create trigger support_messages_validate before insert or update on public.support_messages for each row execute function private.support_validate_message();
create trigger support_tickets_number before insert on public.support_tickets for each row execute function private.support_generate_ticket_number();
create trigger support_tickets_validate before insert or update on public.support_tickets for each row execute function private.support_validate_ticket();
create trigger support_ticket_events_validate before insert on public.support_ticket_events for each row execute function private.support_validate_ticket_event();
create trigger support_assignments_validate before insert or update on public.support_assignments for each row execute function private.support_validate_assignment();
create trigger support_escalation_rules_validate before insert or update on public.support_escalation_rules for each row execute function private.support_validate_escalation();
create trigger support_ticket_tags_validate before insert or update on public.support_ticket_tags for each row execute function private.support_validate_ticket_tag();
create trigger support_outbox_validate before insert or update on public.support_outbox for each row execute function private.support_validate_outbox();
create trigger support_notifications_scope before insert or update on public.support_notifications for each row execute function private.support_validate_product_scope_trigger();

do $$ declare v_table text;begin
  foreach v_table in array array['support_conversations','support_tickets','support_escalation_rules','support_notifications','support_outbox'] loop execute format('create trigger %I_touch before update on public.%I for each row execute function private.touch_updated_at()',v_table,v_table);end loop;
  foreach v_table in array array['support_conversations','support_messages','support_tickets','support_ticket_tags','support_assignments','support_escalation_rules','support_notifications','support_webhook_events','support_outbox'] loop execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function private.audit_row_change()',v_table,v_table);end loop;
end $$;

create index support_conversations_product_activity_idx on public.support_conversations(product_id,last_activity_at desc);
create index support_conversations_queue_status_idx on public.support_conversations(current_queue_id,status,last_activity_at desc);
create index support_conversations_agent_status_idx on public.support_conversations(current_agent_user_id,status,last_activity_at desc);
create index support_conversations_contact_idx on public.support_conversations(contact_party_id,product_id);
create index support_messages_conversation_created_idx on public.support_messages(conversation_id,created_at);
create index support_tickets_product_status_idx on public.support_tickets(product_id,status,updated_at desc);
create index support_tickets_queue_status_idx on public.support_tickets(queue_id,status,priority,updated_at desc);
create index support_tickets_agent_status_idx on public.support_tickets(agent_user_id,status,updated_at desc);
create index support_tickets_contact_idx on public.support_tickets(contact_party_id,product_id);
create index support_tickets_first_response_due_idx on public.support_tickets(first_response_due_at) where first_responded_at is null and status not in('resolved','closed');
create index support_tickets_resolution_due_idx on public.support_tickets(resolution_due_at) where resolved_at is null and status not in('resolved','closed');
create index support_ticket_events_ticket_occurred_idx on public.support_ticket_events(ticket_id,occurred_at desc);
create index support_assignments_active_queue_idx on public.support_assignments(queue_id,agent_user_id) where ended_at is null;
create index support_notifications_pending_idx on public.support_notifications(status,next_attempt_at) where status in('pending','failed');
create index support_outbox_pending_idx on public.support_outbox(status,next_attempt_at) where status in('pending','failed');
create index support_webhook_events_product_received_idx on public.support_webhook_events(product_id,received_at desc);
