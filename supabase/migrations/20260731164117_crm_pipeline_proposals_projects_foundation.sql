create table public.crm_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id) on delete restrict,
  code text not null check (code ~ '^[A-Z][A-Z0-9_]{1,39}$'),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  position integer not null check (position > 0),
  probability numeric(5,2) not null default 0 check (probability between 0 and 100),
  stage_type text not null default 'open' check (stage_type in ('open','won','lost')),
  status text not null default 'active' check (status in ('active','inactive')),
  is_system boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_unit_id, code),
  unique (business_unit_id, position)
);

create table public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  service_line_id uuid references public.service_lines(id) on delete restrict,
  converted_party_id uuid references public.parties(id) on delete restrict,
  lead_type text not null default 'organization' check (lead_type in ('organization','person')),
  company_name text,
  contact_name text not null check (char_length(btrim(contact_name)) between 2 and 160),
  email text,
  phone text,
  country_code text not null default 'BR' check (country_code ~ '^[A-Z]{2}$'),
  preferred_currency_code text not null default 'BRL' references public.currencies(code) on delete restrict,
  source text not null default 'other' check (source in ('inbound','outbound','referral','event','social','partner','website','other')),
  segment text,
  status text not null default 'new' check (status in ('new','contacted','qualified','unqualified','converted','archived')),
  score integer not null default 0 check (score between 0 and 100),
  estimated_value numeric(18,2) not null default 0 check (estimated_value >= 0),
  expected_close_date date,
  owner_user_id uuid references public.profiles(id) on delete set null,
  next_action text,
  next_action_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 4000),
  version integer not null default 1 check (version > 0),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not (product_id is not null and service_line_id is not null)),
  check (company_name is null or char_length(btrim(company_name)) between 2 and 200),
  check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create table public.crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id) on delete restrict,
  lead_id uuid references public.crm_leads(id) on delete restrict,
  party_id uuid not null references public.parties(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  service_line_id uuid references public.service_lines(id) on delete restrict,
  stage_id uuid not null references public.crm_pipeline_stages(id) on delete restrict,
  owner_user_id uuid references public.profiles(id) on delete set null,
  code text not null unique check (code ~ '^OPP_[A-Z0-9]{8,32}$'),
  title text not null check (char_length(btrim(title)) between 3 and 200),
  description text check (description is null or char_length(description) <= 4000),
  currency_code text not null references public.currencies(code) on delete restrict,
  estimated_amount numeric(18,2) not null default 0 check (estimated_amount >= 0),
  probability numeric(5,2) not null default 0 check (probability between 0 and 100),
  weighted_amount numeric(18,2) generated always as (round(estimated_amount * probability / 100, 2)) stored,
  expected_close_date date,
  status text not null default 'open' check (status in ('open','won','lost','cancelled')),
  loss_reason text,
  next_step text,
  next_step_at timestamptz,
  won_at timestamptz,
  lost_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((product_id is null) <> (service_line_id is null)),
  check (loss_reason is null or char_length(loss_reason) <= 2000)
);

create table public.crm_opportunity_stage_history (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.crm_opportunities(id) on delete cascade,
  from_stage_id uuid references public.crm_pipeline_stages(id) on delete restrict,
  to_stage_id uuid not null references public.crm_pipeline_stages(id) on delete restrict,
  changed_by uuid references public.profiles(id) on delete set null,
  reason text,
  changed_at timestamptz not null default now()
);

create table public.crm_proposals (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.crm_opportunities(id) on delete restrict,
  party_id uuid not null references public.parties(id) on delete restrict,
  business_unit_id uuid not null references public.business_units(id) on delete restrict,
  code text not null unique check (code ~ '^PROP_[A-Z0-9]{8,32}$'),
  title text not null check (char_length(btrim(title)) between 3 and 200),
  status text not null default 'draft' check (status in ('draft','in_review','approved','sent','accepted','rejected','expired','cancelled')),
  current_version_id uuid,
  owner_user_id uuid references public.profiles(id) on delete set null,
  version integer not null default 1 check (version > 0),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crm_proposal_versions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.crm_proposals(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  currency_code text not null references public.currencies(code) on delete restrict,
  subtotal numeric(18,2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(18,2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(18,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(18,2) generated always as (round(subtotal - discount_amount + tax_amount, 2)) stored,
  estimated_cost numeric(18,2) not null default 0 check (estimated_cost >= 0),
  estimated_profit numeric(18,2) generated always as (round(subtotal - discount_amount - estimated_cost, 2)) stored,
  estimated_margin numeric(9,4) generated always as (case when subtotal - discount_amount > 0 then round(((subtotal - discount_amount - estimated_cost) / (subtotal - discount_amount)) * 100, 4) else 0 end) stored,
  valid_until date not null,
  payment_terms text,
  scope_summary text,
  assumptions text,
  exclusions text,
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','sent','accepted','rejected','superseded','cancelled')),
  requested_by uuid references public.profiles(id) on delete restrict,
  requested_at timestamptz,
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  decision_reason text,
  sent_at timestamptz,
  accepted_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proposal_id, version_number),
  check (discount_amount <= subtotal),
  check (payment_terms is null or char_length(payment_terms) <= 4000),
  check (scope_summary is null or char_length(scope_summary) <= 10000),
  check (assumptions is null or char_length(assumptions) <= 10000),
  check (exclusions is null or char_length(exclusions) <= 10000)
);

alter table public.crm_proposals
  add constraint crm_proposals_current_version_id_fkey
  foreign key (current_version_id) references public.crm_proposal_versions(id) on delete restrict;

create table public.crm_proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_version_id uuid not null references public.crm_proposal_versions(id) on delete cascade,
  sequence_no integer not null check (sequence_no > 0),
  item_type text not null check (item_type in ('product','service','custom','deliverable','milestone')),
  product_id uuid references public.products(id) on delete restrict,
  service_line_id uuid references public.service_lines(id) on delete restrict,
  description text not null check (char_length(btrim(description)) between 2 and 2000),
  quantity numeric(18,4) not null default 1 check (quantity > 0),
  unit text,
  unit_price numeric(18,4) not null default 0 check (unit_price >= 0),
  estimated_unit_cost numeric(18,4) not null default 0 check (estimated_unit_cost >= 0),
  line_total numeric(18,2) generated always as (round(quantity * unit_price, 2)) stored,
  line_cost numeric(18,2) generated always as (round(quantity * estimated_unit_cost, 2)) stored,
  planned_hours numeric(12,2) not null default 0 check (planned_hours >= 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proposal_version_id, sequence_no),
  check (not (product_id is not null and service_line_id is not null)),
  check ((item_type <> 'product') or product_id is not null),
  check ((item_type <> 'service') or service_line_id is not null)
);

create table public.crm_project_profiles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete restrict,
  opportunity_id uuid not null unique references public.crm_opportunities(id) on delete restrict,
  proposal_id uuid not null references public.crm_proposals(id) on delete restrict,
  proposal_version_id uuid not null references public.crm_proposal_versions(id) on delete restrict,
  party_id uuid not null references public.parties(id) on delete restrict,
  contract_id uuid references public.contracts(id) on delete restrict,
  cost_center_id uuid references public.cost_centers(id) on delete restrict,
  revenue_center_id uuid references public.revenue_centers(id) on delete restrict,
  currency_code text not null references public.currencies(code) on delete restrict,
  contracted_revenue numeric(18,2) not null default 0 check (contracted_revenue >= 0),
  planned_cost numeric(18,2) not null default 0 check (planned_cost >= 0),
  planned_profit numeric(18,2) generated always as (round(contracted_revenue - planned_cost, 2)) stored,
  planned_margin numeric(9,4) generated always as (case when contracted_revenue > 0 then round(((contracted_revenue - planned_cost) / contracted_revenue) * 100, 4) else 0 end) stored,
  status text not null default 'planned' check (status in ('planned','active','on_hold','completed','cancelled')),
  version integer not null default 1 check (version > 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crm_project_scope_items (
  id uuid primary key default gen_random_uuid(),
  project_profile_id uuid not null references public.crm_project_profiles(id) on delete cascade,
  proposal_item_id uuid references public.crm_proposal_items(id) on delete restrict,
  sequence_no integer not null check (sequence_no > 0),
  scope_type text not null check (scope_type in ('deliverable','milestone','assumption','exclusion','task')),
  title text not null check (char_length(btrim(title)) between 2 and 200),
  description text,
  planned_hours numeric(12,2) not null default 0 check (planned_hours >= 0),
  planned_revenue numeric(18,2) not null default 0 check (planned_revenue >= 0),
  planned_cost numeric(18,2) not null default 0 check (planned_cost >= 0),
  due_date date,
  status text not null default 'planned' check (status in ('planned','in_progress','completed','cancelled')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_profile_id, sequence_no)
);

create table public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id) on delete restrict,
  lead_id uuid references public.crm_leads(id) on delete cascade,
  opportunity_id uuid references public.crm_opportunities(id) on delete cascade,
  proposal_id uuid references public.crm_proposals(id) on delete cascade,
  project_profile_id uuid references public.crm_project_profiles(id) on delete cascade,
  activity_type text not null check (activity_type in ('call','email','meeting','task','note','follow_up')),
  subject text not null check (char_length(btrim(subject)) between 2 and 200),
  description text,
  status text not null default 'open' check (status in ('open','completed','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_user_id uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  completed_at timestamptz,
  outcome text,
  version integer not null default 1 check (version > 0),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(lead_id, opportunity_id, proposal_id, project_profile_id) = 1)
);

create index crm_pipeline_stages_unit_idx on public.crm_pipeline_stages(business_unit_id,status,position);
create index crm_leads_unit_status_idx on public.crm_leads(business_unit_id,status,updated_at desc);
create index crm_leads_owner_idx on public.crm_leads(owner_user_id);
create index crm_leads_product_idx on public.crm_leads(product_id);
create index crm_leads_service_idx on public.crm_leads(service_line_id);
create index crm_leads_party_idx on public.crm_leads(converted_party_id);
create index crm_opportunities_unit_stage_idx on public.crm_opportunities(business_unit_id,stage_id,status);
create index crm_opportunities_party_idx on public.crm_opportunities(party_id);
create index crm_opportunities_lead_idx on public.crm_opportunities(lead_id);
create index crm_opportunities_owner_idx on public.crm_opportunities(owner_user_id);
create index crm_opportunities_product_idx on public.crm_opportunities(product_id);
create index crm_opportunities_service_idx on public.crm_opportunities(service_line_id);
create index crm_stage_history_opportunity_idx on public.crm_opportunity_stage_history(opportunity_id,changed_at desc);
create index crm_stage_history_from_idx on public.crm_opportunity_stage_history(from_stage_id);
create index crm_stage_history_to_idx on public.crm_opportunity_stage_history(to_stage_id);
create index crm_stage_history_actor_idx on public.crm_opportunity_stage_history(changed_by);
create index crm_proposals_opportunity_idx on public.crm_proposals(opportunity_id);
create index crm_proposals_party_idx on public.crm_proposals(party_id);
create index crm_proposals_unit_status_idx on public.crm_proposals(business_unit_id,status);
create index crm_proposals_owner_idx on public.crm_proposals(owner_user_id);
create index crm_proposals_current_version_idx on public.crm_proposals(current_version_id);
create index crm_proposal_versions_proposal_idx on public.crm_proposal_versions(proposal_id,status,version_number desc);
create index crm_proposal_versions_currency_idx on public.crm_proposal_versions(currency_code);
create index crm_proposal_versions_requested_idx on public.crm_proposal_versions(requested_by);
create index crm_proposal_versions_approved_idx on public.crm_proposal_versions(approved_by);
create index crm_proposal_versions_created_idx on public.crm_proposal_versions(created_by);
create index crm_proposal_items_version_idx on public.crm_proposal_items(proposal_version_id,sequence_no);
create index crm_proposal_items_product_idx on public.crm_proposal_items(product_id);
create index crm_proposal_items_service_idx on public.crm_proposal_items(service_line_id);
create index crm_project_profiles_proposal_idx on public.crm_project_profiles(proposal_id);
create index crm_project_profiles_version_idx on public.crm_project_profiles(proposal_version_id);
create index crm_project_profiles_party_idx on public.crm_project_profiles(party_id);
create index crm_project_profiles_contract_idx on public.crm_project_profiles(contract_id);
create index crm_project_profiles_cost_center_idx on public.crm_project_profiles(cost_center_id);
create index crm_project_profiles_revenue_center_idx on public.crm_project_profiles(revenue_center_id);
create index crm_project_profiles_currency_idx on public.crm_project_profiles(currency_code);
create index crm_project_profiles_created_idx on public.crm_project_profiles(created_by);
create index crm_project_scope_profile_idx on public.crm_project_scope_items(project_profile_id,sequence_no);
create index crm_project_scope_proposal_item_idx on public.crm_project_scope_items(proposal_item_id);
create index crm_activities_unit_status_idx on public.crm_activities(business_unit_id,status,due_at);
create index crm_activities_lead_idx on public.crm_activities(lead_id);
create index crm_activities_opportunity_idx on public.crm_activities(opportunity_id);
create index crm_activities_proposal_idx on public.crm_activities(proposal_id);
create index crm_activities_project_idx on public.crm_activities(project_profile_id);
create index crm_activities_assigned_idx on public.crm_activities(assigned_user_id);
create index crm_activities_created_idx on public.crm_activities(created_by);

create or replace function private.crm_actor_id() returns uuid
language plpgsql stable set search_path='' as $$
declare v_actor text;
begin
  v_actor:=nullif(current_setting('app.actor_user_id',true),'');
  if v_actor is not null then return v_actor::uuid; end if;
  return auth.uid();
exception when others then return auth.uid();
end$$;

create or replace function private.crm_opportunity_unit_code(p_id uuid) returns text
language sql stable security definer set search_path='' as $$
  select bu.code from public.crm_opportunities o join public.business_units bu on bu.id=o.business_unit_id where o.id=p_id
$$;

create or replace function private.crm_proposal_unit_code(p_id uuid) returns text
language sql stable security definer set search_path='' as $$
  select bu.code from public.crm_proposals p join public.business_units bu on bu.id=p.business_unit_id where p.id=p_id
$$;

create or replace function private.crm_project_unit_code(p_id uuid) returns text
language sql stable security definer set search_path='' as $$
  select bu.code from public.crm_project_profiles cpp join public.projects pr on pr.id=cpp.project_id join public.business_units bu on bu.id=pr.business_unit_id where cpp.id=p_id
$$;

create or replace function private.validate_crm_unit_scope() returns trigger
language plpgsql set search_path='' as $$
declare v_unit uuid;v_proposal public.crm_proposals;v_opportunity public.crm_opportunities;
begin
  if tg_table_name='crm_leads' then
    if new.product_id is not null and not exists(select 1 from public.products p where p.id=new.product_id and p.business_unit_id=new.business_unit_id) then raise exception 'Produto não pertence à unidade do lead.'; end if;
    if new.service_line_id is not null and not exists(select 1 from public.service_lines s where s.id=new.service_line_id and s.business_unit_id=new.business_unit_id) then raise exception 'Serviço não pertence à unidade do lead.'; end if;
  elsif tg_table_name='crm_opportunities' then
    if not exists(select 1 from public.crm_pipeline_stages s where s.id=new.stage_id and s.business_unit_id=new.business_unit_id and s.status='active') then raise exception 'Etapa não pertence à unidade da oportunidade.'; end if;
    if new.product_id is not null and not exists(select 1 from public.products p where p.id=new.product_id and p.business_unit_id=new.business_unit_id) then raise exception 'Produto não pertence à unidade da oportunidade.'; end if;
    if new.service_line_id is not null and not exists(select 1 from public.service_lines s where s.id=new.service_line_id and s.business_unit_id=new.business_unit_id) then raise exception 'Serviço não pertence à unidade da oportunidade.'; end if;
    if new.lead_id is not null and not exists(select 1 from public.crm_leads l where l.id=new.lead_id and l.business_unit_id=new.business_unit_id) then raise exception 'Lead não pertence à unidade da oportunidade.'; end if;
  elsif tg_table_name='crm_proposals' then
    select * into v_opportunity from public.crm_opportunities where id=new.opportunity_id;
    if not found or v_opportunity.business_unit_id<>new.business_unit_id or v_opportunity.party_id<>new.party_id then raise exception 'Proposta incompatível com a oportunidade.'; end if;
  elsif tg_table_name='crm_project_profiles' then
    select * into v_proposal from public.crm_proposals where id=new.proposal_id;
    select * into v_opportunity from public.crm_opportunities where id=new.opportunity_id;
    select business_unit_id into v_unit from public.projects where id=new.project_id;
    if not found or v_proposal.opportunity_id<>new.opportunity_id or v_proposal.party_id<>new.party_id then raise exception 'Projeto comercial incompatível com proposta e oportunidade.'; end if;
    if v_unit<>v_opportunity.business_unit_id then raise exception 'Projeto não pertence à unidade da oportunidade.'; end if;
    if not exists(select 1 from public.crm_proposal_versions pv where pv.id=new.proposal_version_id and pv.proposal_id=new.proposal_id and pv.status='accepted') then raise exception 'Projeto exige versão de proposta aceita.'; end if;
  elsif tg_table_name='crm_activities' then
    if new.lead_id is not null and not exists(select 1 from public.crm_leads l where l.id=new.lead_id and l.business_unit_id=new.business_unit_id) then raise exception 'Atividade e lead pertencem a unidades diferentes.'; end if;
    if new.opportunity_id is not null and not exists(select 1 from public.crm_opportunities o where o.id=new.opportunity_id and o.business_unit_id=new.business_unit_id) then raise exception 'Atividade e oportunidade pertencem a unidades diferentes.'; end if;
    if new.proposal_id is not null and not exists(select 1 from public.crm_proposals p where p.id=new.proposal_id and p.business_unit_id=new.business_unit_id) then raise exception 'Atividade e proposta pertencem a unidades diferentes.'; end if;
    if new.project_profile_id is not null and private.crm_project_unit_code(new.project_profile_id)<>private.unit_code_for_id(new.business_unit_id) then raise exception 'Atividade e projeto pertencem a unidades diferentes.'; end if;
  end if;
  return new;
end$$;

create or replace function private.track_crm_opportunity_stage() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' or new.stage_id is distinct from old.stage_id then
    insert into public.crm_opportunity_stage_history(opportunity_id,from_stage_id,to_stage_id,changed_by,reason)
    values(new.id,case when tg_op='INSERT' then null else old.stage_id end,new.stage_id,private.crm_actor_id(),case when tg_op='INSERT' then 'Criação da oportunidade' else null end);
  end if;
  return new;
end$$;

create or replace function private.refresh_crm_proposal_totals() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_version uuid;
begin
  v_version:=coalesce(new.proposal_version_id,old.proposal_version_id);
  update public.crm_proposal_versions pv set
    subtotal=(select coalesce(sum(i.line_total),0) from public.crm_proposal_items i where i.proposal_version_id=v_version),
    estimated_cost=(select coalesce(sum(i.line_cost),0) from public.crm_proposal_items i where i.proposal_version_id=v_version)
  where pv.id=v_version and pv.status='draft';
  return coalesce(new,old);
end$$;

create or replace function private.protect_crm_proposal_version() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then
    if old.status<>'draft' then raise exception 'Somente versão de proposta em rascunho pode ser excluída.'; end if;
    return old;
  end if;
  if old.status<>'draft' then
    if row(new.proposal_id,new.version_number,new.currency_code,new.subtotal,new.discount_amount,new.tax_amount,new.estimated_cost,new.valid_until,new.payment_terms,new.scope_summary,new.assumptions,new.exclusions,new.created_by)
       is distinct from
       row(old.proposal_id,old.version_number,old.currency_code,old.subtotal,old.discount_amount,old.tax_amount,old.estimated_cost,old.valid_until,old.payment_terms,old.scope_summary,old.assumptions,old.exclusions,old.created_by)
    then raise exception 'Versão de proposta submetida é economicamente imutável.'; end if;
  end if;
  return new;
end$$;

create or replace function private.protect_crm_proposal_item() returns trigger
language plpgsql set search_path='' as $$
declare v_status text;
begin
  select status into v_status from public.crm_proposal_versions where id=coalesce(new.proposal_version_id,old.proposal_version_id);
  if v_status<>'draft' then raise exception 'Itens da proposta são imutáveis após submissão.'; end if;
  return coalesce(new,old);
end$$;

create trigger crm_pipeline_stages_touch before update on public.crm_pipeline_stages for each row execute function private.touch_updated_at();
create trigger crm_leads_scope before insert or update on public.crm_leads for each row execute function private.validate_crm_unit_scope();
create trigger crm_leads_touch before update on public.crm_leads for each row execute function private.touch_updated_at();
create trigger crm_opportunities_scope before insert or update on public.crm_opportunities for each row execute function private.validate_crm_unit_scope();
create trigger crm_opportunities_touch before update on public.crm_opportunities for each row execute function private.touch_updated_at();
create trigger crm_opportunities_stage after insert or update of stage_id on public.crm_opportunities for each row execute function private.track_crm_opportunity_stage();
create trigger crm_proposals_scope before insert or update on public.crm_proposals for each row execute function private.validate_crm_unit_scope();
create trigger crm_proposals_touch before update on public.crm_proposals for each row execute function private.touch_updated_at();
create trigger crm_proposal_versions_protect before update or delete on public.crm_proposal_versions for each row execute function private.protect_crm_proposal_version();
create trigger crm_proposal_versions_touch before update on public.crm_proposal_versions for each row execute function private.touch_updated_at();
create trigger crm_proposal_items_protect before insert or update or delete on public.crm_proposal_items for each row execute function private.protect_crm_proposal_item();
create trigger crm_proposal_items_touch before update on public.crm_proposal_items for each row execute function private.touch_updated_at();
create trigger crm_proposal_items_totals after insert or update or delete on public.crm_proposal_items for each row execute function private.refresh_crm_proposal_totals();
create trigger crm_project_profiles_scope before insert or update on public.crm_project_profiles for each row execute function private.validate_crm_unit_scope();
create trigger crm_project_profiles_touch before update on public.crm_project_profiles for each row execute function private.touch_updated_at();
create trigger crm_project_scope_touch before update on public.crm_project_scope_items for each row execute function private.touch_updated_at();
create trigger crm_activities_scope before insert or update on public.crm_activities for each row execute function private.validate_crm_unit_scope();
create trigger crm_activities_touch before update on public.crm_activities for each row execute function private.touch_updated_at();

create trigger crm_pipeline_stages_audit after insert or update or delete on public.crm_pipeline_stages for each row execute function private.audit_row_change();
create trigger crm_leads_audit after insert or update or delete on public.crm_leads for each row execute function private.audit_row_change();
create trigger crm_opportunities_audit after insert or update or delete on public.crm_opportunities for each row execute function private.audit_row_change();
create trigger crm_stage_history_audit after insert or update or delete on public.crm_opportunity_stage_history for each row execute function private.audit_row_change();
create trigger crm_proposals_audit after insert or update or delete on public.crm_proposals for each row execute function private.audit_row_change();
create trigger crm_proposal_versions_audit after insert or update or delete on public.crm_proposal_versions for each row execute function private.audit_row_change();
create trigger crm_proposal_items_audit after insert or update or delete on public.crm_proposal_items for each row execute function private.audit_row_change();
create trigger crm_project_profiles_audit after insert or update or delete on public.crm_project_profiles for each row execute function private.audit_row_change();
create trigger crm_project_scope_audit after insert or update or delete on public.crm_project_scope_items for each row execute function private.audit_row_change();
create trigger crm_activities_audit after insert or update or delete on public.crm_activities for each row execute function private.audit_row_change();

insert into public.crm_pipeline_stages(business_unit_id,code,name,position,probability,stage_type,is_system)
select bu.id,s.code,s.name,s.position,s.probability,s.stage_type,true
from public.business_units bu
cross join (values
 ('PROSPECTING','Prospecção',1,10::numeric,'open'),
 ('QUALIFICATION','Qualificação',2,25::numeric,'open'),
 ('PROPOSAL','Proposta',3,50::numeric,'open'),
 ('NEGOTIATION','Negociação',4,75::numeric,'open'),
 ('WON','Ganha',5,100::numeric,'won'),
 ('LOST','Perdida',6,0::numeric,'lost')
) as s(code,name,position,probability,stage_type)
where bu.status='active'
on conflict do nothing;

insert into public.permissions(code,module,action,description) values
 ('crm.read','crm','read','Consultar CRM, propostas e projetos comerciais'),
 ('crm.leads.manage','crm','leads_manage','Criar, editar e arquivar leads'),
 ('crm.opportunities.manage','crm','opportunities_manage','Gerenciar oportunidades e atividades'),
 ('crm.proposals.manage','crm','proposals_manage','Criar e editar propostas em rascunho'),
 ('crm.proposals.approve','crm','proposals_approve','Aprovar ou rejeitar propostas'),
 ('crm.projects.manage','crm','projects_manage','Gerenciar escopo e perfil econômico de projetos'),
 ('crm.convert','crm','convert','Converter leads e oportunidades')
on conflict(code) do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.app_roles r cross join public.permissions p
where r.code in ('owner','corporate_admin') and p.module='crm'
on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.app_roles r cross join public.permissions p
where r.code='commercial' and p.code in ('crm.read','crm.leads.manage','crm.opportunities.manage','crm.proposals.manage','crm.convert')
on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.app_roles r cross join public.permissions p
where r.code='unit_manager' and p.code in ('crm.read','crm.leads.manage','crm.opportunities.manage','crm.proposals.manage','crm.projects.manage')
on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.app_roles r cross join public.permissions p
where r.code in ('finance_manager','executive_readonly','readonly','auditor') and p.code='crm.read'
on conflict do nothing;

alter table public.crm_pipeline_stages enable row level security;
alter table public.crm_leads enable row level security;
alter table public.crm_opportunities enable row level security;
alter table public.crm_opportunity_stage_history enable row level security;
alter table public.crm_proposals enable row level security;
alter table public.crm_proposal_versions enable row level security;
alter table public.crm_proposal_items enable row level security;
alter table public.crm_project_profiles enable row level security;
alter table public.crm_project_scope_items enable row level security;
alter table public.crm_activities enable row level security;

create policy crm_stages_select on public.crm_pipeline_stages for select to authenticated using(private.current_user_has_permission('crm.read',private.unit_code_for_id(business_unit_id)));
create policy crm_leads_select on public.crm_leads for select to authenticated using(private.current_user_has_permission('crm.read',private.unit_code_for_id(business_unit_id)));
create policy crm_leads_insert on public.crm_leads for insert to authenticated with check(private.current_user_has_permission('crm.leads.manage',private.unit_code_for_id(business_unit_id)) and status in ('new','contacted'));
create policy crm_leads_update on public.crm_leads for update to authenticated using(private.current_user_has_permission('crm.leads.manage',private.unit_code_for_id(business_unit_id)) and status not in ('converted','archived')) with check(private.current_user_has_permission('crm.leads.manage',private.unit_code_for_id(business_unit_id)) and status not in ('converted'));
create policy crm_leads_delete on public.crm_leads for delete to authenticated using(private.current_user_has_permission('crm.leads.manage',private.unit_code_for_id(business_unit_id)) and status in ('new','contacted','unqualified'));

create policy crm_opportunities_select on public.crm_opportunities for select to authenticated using(private.current_user_has_permission('crm.read',private.unit_code_for_id(business_unit_id)));
create policy crm_opportunities_insert on public.crm_opportunities for insert to authenticated with check(private.current_user_has_permission('crm.opportunities.manage',private.unit_code_for_id(business_unit_id)) and status='open');
create policy crm_opportunities_update on public.crm_opportunities for update to authenticated using(private.current_user_has_permission('crm.opportunities.manage',private.unit_code_for_id(business_unit_id)) and status='open') with check(private.current_user_has_permission('crm.opportunities.manage',private.unit_code_for_id(business_unit_id)) and status='open');
create policy crm_opportunities_delete on public.crm_opportunities for delete to authenticated using(private.current_user_has_permission('crm.opportunities.manage',private.unit_code_for_id(business_unit_id)) and status='open' and not exists(select 1 from public.crm_proposals p where p.opportunity_id=id));
create policy crm_stage_history_select on public.crm_opportunity_stage_history for select to authenticated using(private.current_user_has_permission('crm.read',private.crm_opportunity_unit_code(opportunity_id)));

create policy crm_proposals_select on public.crm_proposals for select to authenticated using(private.current_user_has_permission('crm.read',private.unit_code_for_id(business_unit_id)));
create policy crm_proposals_insert on public.crm_proposals for insert to authenticated with check(private.current_user_has_permission('crm.proposals.manage',private.unit_code_for_id(business_unit_id)) and status='draft');
create policy crm_proposals_update on public.crm_proposals for update to authenticated using(private.current_user_has_permission('crm.proposals.manage',private.unit_code_for_id(business_unit_id)) and status='draft') with check(private.current_user_has_permission('crm.proposals.manage',private.unit_code_for_id(business_unit_id)) and status='draft');
create policy crm_proposals_delete on public.crm_proposals for delete to authenticated using(private.current_user_has_permission('crm.proposals.manage',private.unit_code_for_id(business_unit_id)) and status='draft');
create policy crm_versions_select on public.crm_proposal_versions for select to authenticated using(private.current_user_has_permission('crm.read',private.crm_proposal_unit_code(proposal_id)));
create policy crm_versions_insert on public.crm_proposal_versions for insert to authenticated with check(status='draft' and private.current_user_has_permission('crm.proposals.manage',private.crm_proposal_unit_code(proposal_id)));
create policy crm_versions_update on public.crm_proposal_versions for update to authenticated using(status='draft' and private.current_user_has_permission('crm.proposals.manage',private.crm_proposal_unit_code(proposal_id))) with check(status='draft' and private.current_user_has_permission('crm.proposals.manage',private.crm_proposal_unit_code(proposal_id)));
create policy crm_versions_delete on public.crm_proposal_versions for delete to authenticated using(status='draft' and private.current_user_has_permission('crm.proposals.manage',private.crm_proposal_unit_code(proposal_id)));
create policy crm_items_select on public.crm_proposal_items for select to authenticated using(exists(select 1 from public.crm_proposal_versions pv where pv.id=proposal_version_id and private.current_user_has_permission('crm.read',private.crm_proposal_unit_code(pv.proposal_id))));
create policy crm_items_insert on public.crm_proposal_items for insert to authenticated with check(exists(select 1 from public.crm_proposal_versions pv where pv.id=proposal_version_id and pv.status='draft' and private.current_user_has_permission('crm.proposals.manage',private.crm_proposal_unit_code(pv.proposal_id))));
create policy crm_items_update on public.crm_proposal_items for update to authenticated using(exists(select 1 from public.crm_proposal_versions pv where pv.id=proposal_version_id and pv.status='draft' and private.current_user_has_permission('crm.proposals.manage',private.crm_proposal_unit_code(pv.proposal_id)))) with check(exists(select 1 from public.crm_proposal_versions pv where pv.id=proposal_version_id and pv.status='draft' and private.current_user_has_permission('crm.proposals.manage',private.crm_proposal_unit_code(pv.proposal_id))));
create policy crm_items_delete on public.crm_proposal_items for delete to authenticated using(exists(select 1 from public.crm_proposal_versions pv where pv.id=proposal_version_id and pv.status='draft' and private.current_user_has_permission('crm.proposals.manage',private.crm_proposal_unit_code(pv.proposal_id))));

create policy crm_project_profiles_select on public.crm_project_profiles for select to authenticated using(private.current_user_has_permission('crm.read',private.crm_project_unit_code(id)));
create policy crm_project_profiles_update on public.crm_project_profiles for update to authenticated using(private.current_user_has_permission('crm.projects.manage',private.crm_project_unit_code(id)) and status in ('planned','active','on_hold')) with check(private.current_user_has_permission('crm.projects.manage',private.crm_project_unit_code(id)));
create policy crm_scope_select on public.crm_project_scope_items for select to authenticated using(private.current_user_has_permission('crm.read',private.crm_project_unit_code(project_profile_id)));
create policy crm_scope_insert on public.crm_project_scope_items for insert to authenticated with check(private.current_user_has_permission('crm.projects.manage',private.crm_project_unit_code(project_profile_id)));
create policy crm_scope_update on public.crm_project_scope_items for update to authenticated using(private.current_user_has_permission('crm.projects.manage',private.crm_project_unit_code(project_profile_id))) with check(private.current_user_has_permission('crm.projects.manage',private.crm_project_unit_code(project_profile_id)));
create policy crm_scope_delete on public.crm_project_scope_items for delete to authenticated using(private.current_user_has_permission('crm.projects.manage',private.crm_project_unit_code(project_profile_id)) and status in ('planned','cancelled'));

create policy crm_activities_select on public.crm_activities for select to authenticated using(private.current_user_has_permission('crm.read',private.unit_code_for_id(business_unit_id)));
create policy crm_activities_insert on public.crm_activities for insert to authenticated with check(private.current_user_has_permission('crm.opportunities.manage',private.unit_code_for_id(business_unit_id)));
create policy crm_activities_update on public.crm_activities for update to authenticated using(private.current_user_has_permission('crm.opportunities.manage',private.unit_code_for_id(business_unit_id)) and status='open') with check(private.current_user_has_permission('crm.opportunities.manage',private.unit_code_for_id(business_unit_id)));
create policy crm_activities_delete on public.crm_activities for delete to authenticated using(private.current_user_has_permission('crm.opportunities.manage',private.unit_code_for_id(business_unit_id)) and status in ('open','cancelled'));

revoke all on public.crm_pipeline_stages,public.crm_leads,public.crm_opportunities,public.crm_opportunity_stage_history,public.crm_proposals,public.crm_proposal_versions,public.crm_proposal_items,public.crm_project_profiles,public.crm_project_scope_items,public.crm_activities from anon;
grant select on public.crm_pipeline_stages,public.crm_opportunity_stage_history to authenticated;
grant select,insert,update,delete on public.crm_leads,public.crm_opportunities,public.crm_proposals,public.crm_proposal_versions,public.crm_proposal_items,public.crm_project_scope_items,public.crm_activities to authenticated;
grant select,update on public.crm_project_profiles to authenticated;

create or replace view public.crm_project_profitability with (security_invoker=true) as
select
  cpp.id as project_profile_id,
  cpp.project_id,
  pr.code as project_code,
  pr.name as project_name,
  pr.business_unit_id,
  cpp.party_id,
  cpp.currency_code,
  cpp.contracted_revenue,
  cpp.planned_cost,
  cpp.planned_profit,
  cpp.planned_margin,
  coalesce(sum(case when ma.account_type='revenue' and je.status='posted' then jl.credit_amount-jl.debit_amount else 0 end),0)::numeric(18,2) as actual_revenue,
  coalesce(sum(case when ma.account_type in ('expense','investment','deduction') and je.status='posted' then jl.debit_amount-jl.credit_amount else 0 end),0)::numeric(18,2) as actual_cost,
  (coalesce(sum(case when ma.account_type='revenue' and je.status='posted' then jl.credit_amount-jl.debit_amount else 0 end),0)-coalesce(sum(case when ma.account_type in ('expense','investment','deduction') and je.status='posted' then jl.debit_amount-jl.credit_amount else 0 end),0))::numeric(18,2) as actual_profit,
  case when coalesce(sum(case when ma.account_type='revenue' and je.status='posted' then jl.credit_amount-jl.debit_amount else 0 end),0)>0 then round(((coalesce(sum(case when ma.account_type='revenue' and je.status='posted' then jl.credit_amount-jl.debit_amount else 0 end),0)-coalesce(sum(case when ma.account_type in ('expense','investment','deduction') and je.status='posted' then jl.debit_amount-jl.credit_amount else 0 end),0))/coalesce(sum(case when ma.account_type='revenue' and je.status='posted' then jl.credit_amount-jl.debit_amount else 0 end),0))*100,4) else 0 end as actual_margin
from public.crm_project_profiles cpp
join public.projects pr on pr.id=cpp.project_id
left join public.journal_lines jl on jl.project_id=cpp.project_id
left join public.journal_entries je on je.id=jl.journal_entry_id
left join public.managerial_accounts ma on ma.id=jl.managerial_account_id
group by cpp.id,cpp.project_id,pr.code,pr.name,pr.business_unit_id,cpp.party_id,cpp.currency_code,cpp.contracted_revenue,cpp.planned_cost,cpp.planned_profit,cpp.planned_margin;
revoke all on public.crm_project_profitability from anon;
grant select on public.crm_project_profitability to authenticated;