create table public.participation_calculations (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  business_unit_id uuid not null references public.business_units(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  service_line_id uuid references public.service_lines(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete restrict,
  contract_version_id uuid not null references public.contract_versions(id) on delete restrict,
  financial_period_id uuid not null references public.financial_periods(id) on delete restrict,
  code text not null,
  competence_start date not null,
  competence_end date not null,
  currency_code text not null references public.currencies(code) on delete restrict,
  gross_revenue numeric(18,2) not null default 0,
  deductions numeric(18,2) not null default 0,
  direct_costs numeric(18,2) not null default 0,
  allocated_costs numeric(18,2) not null default 0,
  taxes numeric(18,2) not null default 0,
  payment_fees numeric(18,2) not null default 0,
  investments numeric(18,2) not null default 0,
  reserves numeric(18,2) not null default 0,
  prior_loss_offset numeric(18,2) not null default 0,
  distributable_base numeric(18,2) generated always as (round(gross_revenue-deductions-direct_costs-allocated_costs-taxes-payment_fees-investments-reserves-prior_loss_offset,2)) stored,
  calculation_method text not null default 'contract_formula' check (calculation_method in ('contract_formula','manual_adjustment')),
  status text not null default 'draft' check (status in ('draft','calculated','pending_approval','approved','posted','cancelled','reversed')),
  description text,
  requested_by uuid references public.profiles(id) on delete restrict,
  requested_at timestamptz,
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  posted_by uuid references public.profiles(id) on delete restrict,
  posted_at timestamptz,
  journal_entry_id uuid references public.journal_entries(id) on delete restrict,
  reversal_journal_entry_id uuid references public.journal_entries(id) on delete restrict,
  version integer not null default 1 check (version>0),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (competence_end>=competence_start),
  check ((product_id is null)<>(service_line_id is null)),
  unique(contract_id,financial_period_id,contract_version_id)
);
create table public.participation_calculation_lines (
  id uuid primary key default gen_random_uuid(),
  participation_calculation_id uuid not null references public.participation_calculations(id) on delete cascade,
  contract_participant_id uuid not null references public.contract_version_participants(id) on delete restrict,
  party_id uuid not null references public.parties(id) on delete restrict,
  sequence_no integer not null check(sequence_no>0),
  percentage numeric(9,6) not null check(percentage>=0 and percentage<=100),
  calculation_base numeric(18,2) not null,
  gross_share numeric(18,2) not null,
  retention_percentage numeric(9,6) not null default 0 check(retention_percentage>=0 and retention_percentage<=100),
  retention_amount numeric(18,2) not null default 0,
  minimum_adjustment numeric(18,2) not null default 0,
  maximum_adjustment numeric(18,2) not null default 0,
  loss_offset numeric(18,2) not null default 0,
  net_payable numeric(18,2) not null,
  calculation_memory jsonb not null default '{}'::jsonb,
  status text not null default 'calculated' check(status in ('calculated','held','payable','cancelled','paid')),
  hold_reason text,
  version integer not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(participation_calculation_id,contract_participant_id),
  unique(participation_calculation_id,sequence_no),
  check(retention_amount>=0 and net_payable>=0)
);
create table public.payout_obligations (
  id uuid primary key default gen_random_uuid(),
  participation_calculation_line_id uuid not null unique references public.participation_calculation_lines(id) on delete restrict,
  participation_calculation_id uuid not null references public.participation_calculations(id) on delete restrict,
  party_id uuid not null references public.parties(id) on delete restrict,
  business_unit_id uuid not null references public.business_units(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete restrict,
  currency_code text not null references public.currencies(code) on delete restrict,
  amount numeric(18,2) not null check(amount>=0),
  due_date date not null,
  status text not null default 'open' check(status in ('open','partially_paid','paid','held','cancelled','reversed')),
  paid_amount numeric(18,2) not null default 0 check(paid_amount>=0),
  hold_reason text,
  version integer not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(paid_amount<=amount)
);
create table public.payout_payments (
  id uuid primary key default gen_random_uuid(),
  payout_obligation_id uuid not null references public.payout_obligations(id) on delete restrict,
  financial_settlement_id uuid references public.financial_settlements(id) on delete restrict,
  paid_on date not null,
  amount numeric(18,2) not null check(amount>0),
  currency_code text not null references public.currencies(code) on delete restrict,
  external_reference text,
  notes text,
  status text not null default 'draft' check(status in ('draft','posted','reversed')),
  posted_by uuid references public.profiles(id) on delete restrict,
  posted_at timestamptz,
  version integer not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.participation_approvals (
  id uuid primary key default gen_random_uuid(),
  participation_calculation_id uuid not null references public.participation_calculations(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete restrict,
  approver_id uuid references public.profiles(id) on delete restrict,
  decision text not null default 'pending' check(decision in ('pending','approved','rejected')),
  reason text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz
);
create index participation_calculations_unit_idx on public.participation_calculations(business_unit_id);
create index participation_calculations_contract_idx on public.participation_calculations(contract_id);
create index participation_calculations_period_idx on public.participation_calculations(financial_period_id);
create index participation_calculations_status_idx on public.participation_calculations(status,competence_end);
create index participation_lines_party_idx on public.participation_calculation_lines(party_id);
create index payout_obligations_party_status_idx on public.payout_obligations(party_id,status,due_date);
create index payout_obligations_unit_idx on public.payout_obligations(business_unit_id);
create index payout_payments_obligation_idx on public.payout_payments(payout_obligation_id);
create index participation_approvals_calculation_idx on public.participation_approvals(participation_calculation_id);
create or replace function private.participation_calculation_unit_code(p_id uuid) returns text language sql stable security definer set search_path='' as $$select bu.code from public.participation_calculations pc join public.business_units bu on bu.id=pc.business_unit_id where pc.id=p_id$$;
create or replace function private.validate_participation_scope() returns trigger language plpgsql set search_path='' as $$declare v_contract public.contracts%rowtype;v_version public.contract_versions%rowtype;v_period public.financial_periods%rowtype;begin select * into v_contract from public.contracts where id=new.contract_id;if not found then raise exception 'Contrato não encontrado';end if;select * into v_version from public.contract_versions where id=new.contract_version_id;if not found or v_version.contract_id<>new.contract_id then raise exception 'Versão contratual inválida';end if;if v_version.status<>'approved' then raise exception 'A apuração exige versão contratual aprovada';end if;if v_contract.business_unit_id<>new.business_unit_id or v_contract.legal_entity_id<>new.legal_entity_id then raise exception 'Escopo da apuração diverge do contrato';end if;if coalesce(v_contract.product_id,'00000000-0000-0000-0000-000000000000'::uuid)<>coalesce(new.product_id,'00000000-0000-0000-0000-000000000000'::uuid) or coalesce(v_contract.service_line_id,'00000000-0000-0000-0000-000000000000'::uuid)<>coalesce(new.service_line_id,'00000000-0000-0000-0000-000000000000'::uuid) then raise exception 'Produto ou serviço diverge do contrato';end if;select * into v_period from public.financial_periods where id=new.financial_period_id;if not found or v_period.legal_entity_id<>new.legal_entity_id then raise exception 'Período financeiro inválido';end if;if new.competence_start<v_period.period_start or new.competence_end>v_period.period_end then raise exception 'Competência fora do período financeiro';end if;return new;end$$;
create or replace function private.validate_participation_line() returns trigger language plpgsql set search_path='' as $$declare v_calc public.participation_calculations%rowtype;v_part public.contract_version_participants%rowtype;begin select * into v_calc from public.participation_calculations where id=new.participation_calculation_id;if v_calc.status not in ('draft','calculated') then raise exception 'Linhas ficam congeladas após submissão';end if;select * into v_part from public.contract_version_participants where id=new.contract_participant_id;if not found or v_part.contract_version_id<>v_calc.contract_version_id or v_part.party_id<>new.party_id then raise exception 'Participante incompatível com a versão contratual';end if;if abs(new.percentage-v_part.percentage)>0.000001 then raise exception 'Percentual diverge da versão contratual';end if;return new;end$$;
create or replace function private.refresh_payout_obligation_totals() returns trigger language plpgsql set search_path='' as $$declare v_obligation uuid;v_total numeric;begin v_obligation:=coalesce(new.payout_obligation_id,old.payout_obligation_id);select coalesce(sum(amount),0) into v_total from public.payout_payments where payout_obligation_id=v_obligation and status='posted';update public.payout_obligations set paid_amount=v_total,status=case when status in ('held','cancelled','reversed') then status when v_total=0 then 'open' when v_total<amount then 'partially_paid' else 'paid' end where id=v_obligation;return coalesce(new,old);end$$;
create trigger participation_calculations_scope before insert or update on public.participation_calculations for each row execute function private.validate_participation_scope();
create trigger participation_calculations_touch before update on public.participation_calculations for each row execute function private.touch_updated_at();
create trigger participation_lines_validate before insert or update on public.participation_calculation_lines for each row execute function private.validate_participation_line();
create trigger participation_lines_touch before update on public.participation_calculation_lines for each row execute function private.touch_updated_at();
create trigger payout_obligations_touch before update on public.payout_obligations for each row execute function private.touch_updated_at();
create trigger payout_payments_touch before update on public.payout_payments for each row execute function private.touch_updated_at();
create trigger payout_payments_totals after insert or update or delete on public.payout_payments for each row execute function private.refresh_payout_obligation_totals();
create trigger participation_calculations_audit after insert or update or delete on public.participation_calculations for each row execute function private.audit_row_change();
create trigger participation_lines_audit after insert or update or delete on public.participation_calculation_lines for each row execute function private.audit_row_change();
create trigger payout_obligations_audit after insert or update or delete on public.payout_obligations for each row execute function private.audit_row_change();
create trigger payout_payments_audit after insert or update or delete on public.payout_payments for each row execute function private.audit_row_change();
create trigger participation_approvals_audit after insert or update or delete on public.participation_approvals for each row execute function private.audit_row_change();
insert into public.permissions(code,module,action,description) values('participation.read','participation','read','Consultar apurações e repasses'),('participation.manage','participation','manage','Criar e editar apurações em rascunho'),('participation.approve','participation','approve','Aprovar apurações de participantes'),('participation.post','participation','post','Consolidar apurações e obrigações'),('payout.read','payout','read','Consultar obrigações e pagamentos de repasse'),('payout.manage','payout','manage','Registrar retenções e pagamentos de repasse') on conflict(code) do nothing;
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.app_roles r cross join public.permissions p where r.code in ('owner','corporate_admin','finance_manager','participation_manager') and p.code in ('participation.read','participation.manage','participation.approve','participation.post','payout.read','payout.manage') on conflict do nothing;
alter table public.participation_calculations enable row level security;alter table public.participation_calculation_lines enable row level security;alter table public.payout_obligations enable row level security;alter table public.payout_payments enable row level security;alter table public.participation_approvals enable row level security;
create policy participation_calculations_select on public.participation_calculations for select to authenticated using(private.current_user_has_permission('participation.read',private.unit_code_for_id(business_unit_id)));
create policy participation_calculations_insert on public.participation_calculations for insert to authenticated with check(status='draft' and private.current_user_has_permission('participation.manage',private.unit_code_for_id(business_unit_id)));
create policy participation_calculations_update on public.participation_calculations for update to authenticated using(status in('draft','calculated') and private.current_user_has_permission('participation.manage',private.unit_code_for_id(business_unit_id))) with check(status in('draft','calculated') and private.current_user_has_permission('participation.manage',private.unit_code_for_id(business_unit_id)));
create policy participation_calculations_delete on public.participation_calculations for delete to authenticated using(status='draft' and private.current_user_has_permission('participation.manage',private.unit_code_for_id(business_unit_id)));
create policy participation_lines_select on public.participation_calculation_lines for select to authenticated using(private.current_user_has_permission('participation.read',private.participation_calculation_unit_code(participation_calculation_id)));
create policy participation_lines_insert on public.participation_calculation_lines for insert to authenticated with check(private.current_user_has_permission('participation.manage',private.participation_calculation_unit_code(participation_calculation_id)));
create policy participation_lines_update on public.participation_calculation_lines for update to authenticated using(private.current_user_has_permission('participation.manage',private.participation_calculation_unit_code(participation_calculation_id))) with check(private.current_user_has_permission('participation.manage',private.participation_calculation_unit_code(participation_calculation_id)));
create policy participation_lines_delete on public.participation_calculation_lines for delete to authenticated using(private.current_user_has_permission('participation.manage',private.participation_calculation_unit_code(participation_calculation_id)));
create policy payout_obligations_select on public.payout_obligations for select to authenticated using(private.current_user_has_permission('payout.read',private.unit_code_for_id(business_unit_id)));
create policy payout_obligations_update on public.payout_obligations for update to authenticated using(private.current_user_has_permission('payout.manage',private.unit_code_for_id(business_unit_id))) with check(private.current_user_has_permission('payout.manage',private.unit_code_for_id(business_unit_id)));
create policy payout_payments_select on public.payout_payments for select to authenticated using(exists(select 1 from public.payout_obligations po where po.id=payout_obligation_id and private.current_user_has_permission('payout.read',private.unit_code_for_id(po.business_unit_id))));
create policy payout_payments_insert on public.payout_payments for insert to authenticated with check(status='draft' and exists(select 1 from public.payout_obligations po where po.id=payout_obligation_id and private.current_user_has_permission('payout.manage',private.unit_code_for_id(po.business_unit_id))));
create policy payout_payments_update on public.payout_payments for update to authenticated using(status='draft' and exists(select 1 from public.payout_obligations po where po.id=payout_obligation_id and private.current_user_has_permission('payout.manage',private.unit_code_for_id(po.business_unit_id)))) with check(status='draft');
create policy payout_payments_delete on public.payout_payments for delete to authenticated using(status='draft' and exists(select 1 from public.payout_obligations po where po.id=payout_obligation_id and private.current_user_has_permission('payout.manage',private.unit_code_for_id(po.business_unit_id))));
create policy participation_approvals_select on public.participation_approvals for select to authenticated using(private.current_user_has_permission('participation.read',private.participation_calculation_unit_code(participation_calculation_id)));
revoke all on public.participation_calculations,public.participation_calculation_lines,public.payout_obligations,public.payout_payments,public.participation_approvals from anon;
grant select,insert,update,delete on public.participation_calculations,public.participation_calculation_lines,public.payout_payments to authenticated;grant select,update on public.payout_obligations to authenticated;grant select on public.participation_approvals to authenticated;