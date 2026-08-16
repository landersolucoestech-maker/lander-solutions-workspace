create or replace view public.allocation_source_candidates
with (security_invoker = true)
as
select
  jl.id as journal_line_id,
  je.id as journal_entry_id,
  je.entry_number,
  je.competence_date,
  je.description as entry_description,
  jl.description as line_description,
  jl.managerial_account_id,
  ma.code as account_code,
  ma.name as account_name,
  jl.business_unit_id,
  bu.code as business_unit_code,
  jl.product_id,
  jl.service_line_id,
  jl.project_id,
  jl.contract_id,
  jl.party_id,
  jl.cost_center_id,
  jl.category_id,
  round(jl.debit_amount - jl.credit_amount,2) as source_amount,
  coalesce(allocated.allocated_amount,0)::numeric(18,2) as allocated_amount,
  round((jl.debit_amount - jl.credit_amount) - coalesce(allocated.allocated_amount,0),2) as available_amount
from public.journal_lines jl
join public.journal_entries je on je.id=jl.journal_entry_id
join public.managerial_accounts ma on ma.id=jl.managerial_account_id
join public.business_units bu on bu.id=jl.business_unit_id
left join lateral (
  select sum(ars.selected_amount) as allocated_amount
  from public.allocation_run_sources ars
  join public.allocation_runs ar on ar.id=ars.allocation_run_id
  where ars.journal_line_id=jl.id
    and ar.status='posted'
) allocated on true
where je.status='posted'
  and je.source_type not in ('allocation','reversal')
  and ma.account_type in ('expense','investment')
  and jl.debit_amount > jl.credit_amount;

grant select on public.allocation_source_candidates to authenticated;

create or replace function private.validate_allocation_version_ready(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.allocation_rule_versions;
  v_target_count integer;
  v_percent numeric;
begin
  select * into v_version from public.allocation_rule_versions where id=p_version_id;
  if not found then raise exception 'Versão de rateio não encontrada.'; end if;

  select count(*),coalesce(sum(fixed_percentage),0)
  into v_target_count,v_percent
  from public.allocation_rule_targets
  where allocation_rule_version_id=p_version_id and is_active;

  if v_target_count < 1 then
    raise exception 'A versão precisa de pelo menos um destino ativo.';
  end if;

  if v_version.method='fixed_percentage' then
    if exists (
      select 1 from public.allocation_rule_targets
      where allocation_rule_version_id=p_version_id and is_active and fixed_percentage is null
    ) or abs(v_percent-100)>0.000001 then
      raise exception 'Percentuais fixos devem estar preenchidos e totalizar 100%%.';
    end if;
  end if;

  if v_version.residual_strategy='designated_target' then
    if v_version.residual_business_unit_id is null or not exists (
      select 1 from public.allocation_rule_targets
      where allocation_rule_version_id=p_version_id
        and is_active
        and business_unit_id=v_version.residual_business_unit_id
    ) then
      raise exception 'O destino residual designado não está configurado entre os destinos ativos.';
    end if;
  end if;
end;
$$;

create or replace function public.admin_submit_allocation_rule_version(
  p_version_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.allocation_rule_versions;
  v_unit_code text;
begin
  select * into v_version
  from public.allocation_rule_versions
  where id=p_version_id
  for update;

  if not found or v_version.version<>p_expected_version then return null; end if;
  v_unit_code:=private.allocation_rule_unit_code(v_version.allocation_rule_id);

  if not private.user_has_permission(p_actor_user_id,'allocation.manage',v_unit_code) then
    raise exception 'Permissão insuficiente para submeter a regra.';
  end if;
  if v_version.status<>'draft' then raise exception 'Somente versão em rascunho pode ser submetida.'; end if;

  perform private.validate_allocation_version_ready(p_version_id);

  if exists (
    select 1
    from public.allocation_rule_versions other
    where other.allocation_rule_id=v_version.allocation_rule_id
      and other.id<>v_version.id
      and other.status='approved'
      and daterange(other.effective_start,coalesce(other.effective_end,'infinity'::date),'[]')
          && daterange(v_version.effective_start,coalesce(v_version.effective_end,'infinity'::date),'[]')
  ) then
    raise exception 'Já existe versão aprovada com vigência sobreposta.';
  end if;

  update public.allocation_rule_versions
  set status='pending_approval',
      requested_by=p_actor_user_id,
      requested_at=now(),
      approved_by=null,
      approved_at=null,
      decision_reason=null
  where id=p_version_id;

  return (select to_jsonb(v) from public.allocation_rule_versions v where v.id=p_version_id);
end;
$$;

create or replace function public.admin_decide_allocation_rule_version(
  p_version_id uuid,
  p_expected_version integer,
  p_approve boolean,
  p_reason text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.allocation_rule_versions;
  v_unit_code text;
  v_previous uuid;
begin
  select * into v_version
  from public.allocation_rule_versions
  where id=p_version_id
  for update;

  if not found or v_version.version<>p_expected_version then return null; end if;
  v_unit_code:=private.allocation_rule_unit_code(v_version.allocation_rule_id);

  if not private.user_has_permission(p_actor_user_id,'allocation.approve',v_unit_code) then
    raise exception 'Permissão insuficiente para decidir a regra.';
  end if;
  if v_version.status<>'pending_approval' then raise exception 'A versão não está pendente de aprovação.'; end if;
  if v_version.requested_by=p_actor_user_id then raise exception 'O solicitante não pode decidir a própria versão.'; end if;
  if not p_approve and (p_reason is null or char_length(btrim(p_reason))<5) then
    raise exception 'Motivo da rejeição obrigatório.';
  end if;

  if p_approve then
    perform private.validate_allocation_version_ready(p_version_id);

    select current_version_id into v_previous
    from public.allocation_rules
    where id=v_version.allocation_rule_id
    for update;

    if v_previous is not null and v_previous<>p_version_id then
      update public.allocation_rule_versions
      set status='superseded'
      where id=v_previous and status='approved';
    end if;

    update public.allocation_rule_versions
    set status='approved',
        approved_by=p_actor_user_id,
        approved_at=now(),
        decision_reason=null
    where id=p_version_id;

    update public.allocation_rules
    set current_version_id=p_version_id,status='active'
    where id=v_version.allocation_rule_id;
  else
    update public.allocation_rule_versions
    set status='rejected',
        approved_by=p_actor_user_id,
        approved_at=now(),
        decision_reason=btrim(p_reason)
    where id=p_version_id;
  end if;

  return (select to_jsonb(v) from public.allocation_rule_versions v where v.id=p_version_id);
end;
$$;

create or replace function private.allocation_target_basis(
  p_target_id uuid,
  p_method text,
  p_period_id uuid
)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_target public.allocation_rule_targets;
  v_period public.financial_periods;
  v_value numeric;
begin
  select * into v_target from public.allocation_rule_targets where id=p_target_id;
  select * into v_period from public.financial_periods where id=p_period_id;

  if p_method='fixed_percentage' then return coalesce(v_target.fixed_percentage,0); end if;
  if p_method='equal' then return 1; end if;

  if p_method in ('headcount','usage','manual_driver') then
    select driver_value into v_value
    from public.allocation_driver_values
    where allocation_target_id=p_target_id
      and financial_period_id=p_period_id
      and status='confirmed';
    return coalesce(v_value,0);
  end if;

  if p_method='transaction_count' then
    select count(distinct je.id)::numeric
    into v_value
    from public.journal_entries je
    join public.journal_lines jl on jl.journal_entry_id=je.id
    where je.status='posted'
      and je.source_type not in ('allocation','reversal')
      and je.competence_date between v_period.period_start and v_period.period_end
      and jl.business_unit_id=v_target.business_unit_id
      and (v_target.product_id is null or jl.product_id=v_target.product_id)
      and (v_target.service_line_id is null or jl.service_line_id=v_target.service_line_id)
      and (v_target.project_id is null or jl.project_id=v_target.project_id)
      and (v_target.cost_center_id is null or jl.cost_center_id=v_target.cost_center_id);
    return coalesce(v_value,0);
  end if;

  select coalesce(sum(
    case
      when p_method='revenue' then greatest(jl.credit_amount-jl.debit_amount,0)
      else greatest(jl.debit_amount-jl.credit_amount,0)
    end
  ),0)
  into v_value
  from public.journal_entries je
  join public.journal_lines jl on jl.journal_entry_id=je.id
  join public.managerial_accounts ma on ma.id=jl.managerial_account_id
  where je.status='posted'
    and je.source_type not in ('allocation','reversal')
    and je.competence_date between v_period.period_start and v_period.period_end
    and jl.business_unit_id=v_target.business_unit_id
    and (v_target.product_id is null or jl.product_id=v_target.product_id)
    and (v_target.service_line_id is null or jl.service_line_id=v_target.service_line_id)
    and (v_target.project_id is null or jl.project_id=v_target.project_id)
    and (v_target.cost_center_id is null or jl.cost_center_id=v_target.cost_center_id)
    and (
      (p_method='revenue' and ma.account_type='revenue')
      or (p_method='direct_cost' and ma.account_type in ('expense','investment'))
    );

  return coalesce(v_value,0);
end;
$$;

create or replace function public.admin_simulate_allocation_run(
  p_run_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.allocation_runs;
  v_version public.allocation_rule_versions;
  v_rule public.allocation_rules;
  v_period public.financial_periods;
  v_unit_code text;
  v_total_basis numeric;
  v_source_total numeric;
begin
  select * into v_run from public.allocation_runs where id=p_run_id for update;
  if not found or v_run.version<>p_expected_version then return null; end if;
  select * into v_version from public.allocation_rule_versions where id=v_run.allocation_rule_version_id;
  select * into v_rule from public.allocation_rules where id=v_version.allocation_rule_id;
  select * into v_period from public.financial_periods where id=v_run.financial_period_id;
  v_unit_code:=private.allocation_rule_unit_code(v_rule.id);

  if not private.user_has_permission(p_actor_user_id,'allocation.manage',v_unit_code) then
    raise exception 'Permissão insuficiente para simular o rateio.';
  end if;
  if v_run.status not in ('draft','simulated') then raise exception 'Execução não permite nova simulação.'; end if;
  if v_version.status<>'approved' then raise exception 'A execução exige versão aprovada.'; end if;
  if v_period.status not in ('open','reopened') then raise exception 'O período financeiro não está aberto.'; end if;
  if v_run.competence_date not between v_period.period_start and v_period.period_end then
    raise exception 'A competência não pertence ao período selecionado.';
  end if;
  if v_run.competence_date < v_version.effective_start
     or (v_version.effective_end is not null and v_run.competence_date>v_version.effective_end) then
    raise exception 'A versão não está vigente na competência da execução.';
  end if;
  if not exists(select 1 from public.allocation_run_sources where allocation_run_id=p_run_id) then
    raise exception 'Selecione ao menos uma partida de origem.';
  end if;

  perform private.validate_allocation_version_ready(v_version.id);

  create temporary table if not exists pg_temp.allocation_basis (
    target_id uuid primary key,
    basis numeric(24,8) not null
  ) on commit drop;
  truncate pg_temp.allocation_basis;

  insert into pg_temp.allocation_basis(target_id,basis)
  select t.id, private.allocation_target_basis(t.id,v_version.method,v_run.financial_period_id)
  from public.allocation_rule_targets t
  where t.allocation_rule_version_id=v_version.id and t.is_active;

  select coalesce(sum(basis),0) into v_total_basis from pg_temp.allocation_basis;
  if v_total_basis<=0 then
    raise exception 'A base do direcionador é zero; confirme os valores ou os dados do período.';
  end if;

  if v_version.method='fixed_percentage' and abs(v_total_basis-100)>0.000001 then
    raise exception 'Os percentuais fixos não totalizam 100%%.';
  end if;

  delete from public.allocation_run_distributions where allocation_run_id=p_run_id;

  with raw as (
    select
      s.id as source_id,
      t.id as target_id,
      t.business_unit_id,
      t.product_id,
      t.service_line_id,
      t.project_id,
      t.cost_center_id,
      t.sequence_no,
      b.basis,
      (b.basis/v_total_basis)::numeric(24,12) as weight,
      (s.selected_amount*b.basis/v_total_basis)::numeric(24,12) as raw_amount,
      trunc((s.selected_amount*b.basis/v_total_basis)::numeric,2) as floor_amount
    from public.allocation_run_sources s
    cross join public.allocation_rule_targets t
    join pg_temp.allocation_basis b on b.target_id=t.id
    where s.allocation_run_id=p_run_id
      and t.allocation_rule_version_id=v_version.id
      and t.is_active
  ), ranked as (
    select
      raw.*,
      sum(floor_amount) over(partition by source_id) as floor_total,
      row_number() over(
        partition by source_id
        order by
          case
            when v_version.residual_strategy='designated_target'
             and business_unit_id=v_version.residual_business_unit_id then 0
            else 1
          end,
          (raw_amount-floor_amount) desc,
          sequence_no,
          target_id
      ) as residual_rank
    from raw
  )
  insert into public.allocation_run_distributions(
    allocation_run_id,allocation_run_source_id,allocation_target_id,
    business_unit_id,product_id,service_line_id,project_id,cost_center_id,
    driver_value,normalized_weight,allocation_percentage,
    allocated_amount,rounding_adjustment
  )
  select
    p_run_id,
    r.source_id,
    r.target_id,
    r.business_unit_id,
    r.product_id,
    r.service_line_id,
    r.project_id,
    r.cost_center_id,
    r.basis,
    r.weight,
    round(r.weight*100,8),
    round(r.floor_amount + case when r.residual_rank=1 then s.selected_amount-r.floor_total else 0 end,2),
    round(
      (r.floor_amount + case when r.residual_rank=1 then s.selected_amount-r.floor_total else 0 end)
      - round(r.raw_amount,2),
      2
    )
  from ranked r
  join public.allocation_run_sources s on s.id=r.source_id;

  select coalesce(sum(selected_amount),0) into v_source_total
  from public.allocation_run_sources where allocation_run_id=p_run_id;

  update public.allocation_runs
  set status='simulated',
      method_snapshot=v_version.method,
      source_total=round(v_source_total,2),
      allocated_total=(
        select round(coalesce(sum(allocated_amount),0),2)
        from public.allocation_run_distributions
        where allocation_run_id=p_run_id
      ),
      residual_amount=round(v_source_total-(
        select coalesce(sum(allocated_amount),0)
        from public.allocation_run_distributions
        where allocation_run_id=p_run_id
      ),2)
  where id=p_run_id;

  if exists(
    select 1
    from public.allocation_run_sources s
    where s.allocation_run_id=p_run_id
      and round(s.selected_amount-(select coalesce(sum(d.allocated_amount),0)
        from public.allocation_run_distributions d
        where d.allocation_run_source_id=s.id),2)<>0
  ) then
    raise exception 'A memória de cálculo não fecha com as origens selecionadas.';
  end if;

  return (select to_jsonb(r) from public.allocation_runs r where r.id=p_run_id);
end;
$$;

create or replace function public.admin_submit_allocation_run(
  p_run_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.allocation_runs;
  v_unit_code text;
begin
  select * into v_run from public.allocation_runs where id=p_run_id for update;
  if not found or v_run.version<>p_expected_version then return null; end if;
  v_unit_code:=private.allocation_run_unit_code(p_run_id);

  if not private.user_has_permission(p_actor_user_id,'allocation.manage',v_unit_code) then
    raise exception 'Permissão insuficiente para submeter o rateio.';
  end if;
  if v_run.status<>'simulated' then raise exception 'Somente uma simulação concluída pode ser submetida.'; end if;
  if v_run.source_total<=0 or v_run.source_total<>v_run.allocated_total or v_run.residual_amount<>0 then
    raise exception 'A memória de cálculo não está fechada.';
  end if;

  update public.allocation_runs
  set status='pending_approval',requested_by=p_actor_user_id,requested_at=now()
  where id=p_run_id;

  insert into public.allocation_approvals(allocation_run_id,requested_by)
  values(p_run_id,p_actor_user_id);

  return (select to_jsonb(r) from public.allocation_runs r where r.id=p_run_id);
end;
$$;

create or replace function public.admin_decide_allocation_run(
  p_run_id uuid,
  p_expected_version integer,
  p_approve boolean,
  p_reason text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.allocation_runs;
  v_unit_code text;
begin
  select * into v_run from public.allocation_runs where id=p_run_id for update;
  if not found or v_run.version<>p_expected_version then return null; end if;
  v_unit_code:=private.allocation_run_unit_code(p_run_id);

  if not private.user_has_permission(p_actor_user_id,'allocation.approve',v_unit_code) then
    raise exception 'Permissão insuficiente para decidir o rateio.';
  end if;
  if v_run.status<>'pending_approval' then raise exception 'O rateio não está pendente de aprovação.'; end if;
  if v_run.requested_by=p_actor_user_id then raise exception 'O solicitante não pode aprovar o próprio rateio.'; end if;
  if not p_approve and (p_reason is null or char_length(btrim(p_reason))<5) then
    raise exception 'Motivo da rejeição obrigatório.';
  end if;

  update public.allocation_approvals
  set approver_user_id=p_actor_user_id,
      decision=case when p_approve then 'approved' else 'rejected' end,
      reason=case when p_approve then null else btrim(p_reason) end,
      decided_at=now(),
      version=version+1
  where allocation_run_id=p_run_id and decision='pending';

  if p_approve then
    update public.allocation_runs
    set status='approved',approved_by=p_actor_user_id,approved_at=now()
    where id=p_run_id;
  else
    update public.allocation_runs
    set status='simulated',
        requested_by=null,requested_at=null,
        approved_by=null,approved_at=null
    where id=p_run_id;
  end if;

  return (select to_jsonb(r) from public.allocation_runs r where r.id=p_run_id);
end;
$$;

create or replace function public.admin_post_allocation_run(
  p_run_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.allocation_runs;
  v_version public.allocation_rule_versions;
  v_rule public.allocation_rules;
  v_period public.financial_periods;
  v_unit_code text;
  v_entry_id uuid;
  v_source_count integer;
begin
  select * into v_run from public.allocation_runs where id=p_run_id for update;
  if not found or v_run.version<>p_expected_version then return null; end if;
  select * into v_version from public.allocation_rule_versions where id=v_run.allocation_rule_version_id;
  select * into v_rule from public.allocation_rules where id=v_version.allocation_rule_id;
  select * into v_period from public.financial_periods where id=v_run.financial_period_id;
  v_unit_code:=private.allocation_rule_unit_code(v_rule.id);

  if not private.user_has_permission(p_actor_user_id,'allocation.approve',v_unit_code) then
    raise exception 'Permissão insuficiente para postar o rateio.';
  end if;
  if v_run.status<>'approved' then raise exception 'Somente rateio aprovado pode ser postado.'; end if;
  if v_run.requested_by=p_actor_user_id then raise exception 'O solicitante não pode postar o próprio rateio.'; end if;
  if v_period.status not in ('open','reopened') then raise exception 'O período financeiro não está aberto.'; end if;
  if v_run.source_total<=0 or v_run.source_total<>v_run.allocated_total or v_run.residual_amount<>0 then
    raise exception 'A memória de cálculo não está fechada.';
  end if;

  if exists (
    select 1
    from public.allocation_run_sources s
    join public.journal_lines jl on jl.id=s.journal_line_id
    where s.allocation_run_id=p_run_id
      and s.selected_amount > round(
        (jl.debit_amount-jl.credit_amount)
        - coalesce((
          select sum(other.selected_amount)
          from public.allocation_run_sources other
          join public.allocation_runs other_run on other_run.id=other.allocation_run_id
          where other.journal_line_id=s.journal_line_id
            and other_run.status='posted'
            and other_run.id<>p_run_id
        ),0),
        2
      )
  ) then
    raise exception 'Uma origem foi consumida por outro rateio após a simulação.';
  end if;

  insert into public.journal_entries(
    legal_entity_id,financial_period_id,source_type,source_id,
    competence_date,description,status,created_by,validated_by
  ) values(
    v_rule.legal_entity_id,v_run.financial_period_id,'allocation',p_run_id,
    v_run.competence_date,concat('Rateio ',v_rule.code,' — ',v_run.description),
    'draft',v_run.created_by,v_run.approved_by
  ) returning id into v_entry_id;

  insert into public.journal_lines(
    journal_entry_id,line_no,managerial_account_id,business_unit_id,
    product_id,service_line_id,project_id,contract_id,party_id,
    cost_center_id,revenue_center_id,category_id,
    debit_amount,credit_amount,description
  )
  select
    v_entry_id,
    row_number() over(order by s.id)::integer,
    jl.managerial_account_id,
    jl.business_unit_id,
    jl.product_id,
    jl.service_line_id,
    jl.project_id,
    jl.contract_id,
    jl.party_id,
    jl.cost_center_id,
    jl.revenue_center_id,
    jl.category_id,
    0,
    s.selected_amount,
    concat('Crédito de reclassificação — origem #',je.entry_number)
  from public.allocation_run_sources s
  join public.journal_lines jl on jl.id=s.journal_line_id
  join public.journal_entries je on je.id=jl.journal_entry_id
  where s.allocation_run_id=p_run_id
  order by s.id;

  select count(*) into v_source_count
  from public.allocation_run_sources where allocation_run_id=p_run_id;

  insert into public.journal_lines(
    journal_entry_id,line_no,managerial_account_id,business_unit_id,
    product_id,service_line_id,project_id,contract_id,party_id,
    cost_center_id,revenue_center_id,category_id,
    debit_amount,credit_amount,description
  )
  select
    v_entry_id,
    v_source_count + row_number() over(order by d.allocation_run_source_id,d.id)::integer,
    source_line.managerial_account_id,
    d.business_unit_id,
    d.product_id,
    d.service_line_id,
    d.project_id,
    source_line.contract_id,
    source_line.party_id,
    d.cost_center_id,
    null,
    source_line.category_id,
    d.allocated_amount,
    0,
    concat('Débito de rateio — ',v_rule.code)
  from public.allocation_run_distributions d
  join public.allocation_run_sources s on s.id=d.allocation_run_source_id
  join public.journal_lines source_line on source_line.id=s.journal_line_id
  where d.allocation_run_id=p_run_id
    and d.allocated_amount>0
  order by d.allocation_run_source_id,d.id;

  update public.journal_entries
  set status='posted',
      posting_date=v_run.competence_date,
      posted_by=p_actor_user_id,
      posted_at=now()
  where id=v_entry_id
    and total_debit=total_credit
    and total_debit=v_run.source_total
    and total_debit>0;

  if not found then raise exception 'O lançamento de rateio não está balanceado.'; end if;

  update public.allocation_runs
  set status='posted',
      journal_entry_id=v_entry_id,
      posted_by=p_actor_user_id,
      posted_at=now()
  where id=p_run_id;

  return (select to_jsonb(r) from public.allocation_runs r where r.id=p_run_id);
end;
$$;

create or replace function public.admin_reverse_allocation_run(
  p_run_id uuid,
  p_expected_version integer,
  p_reversal_date date,
  p_reason text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.allocation_runs;
  v_original public.journal_entries;
  v_unit_code text;
  v_period_id uuid;
  v_reversal_id uuid;
  v_line record;
begin
  if p_reason is null or char_length(btrim(p_reason))<5 then
    raise exception 'Motivo de estorno obrigatório.';
  end if;

  select * into v_run from public.allocation_runs where id=p_run_id for update;
  if not found or v_run.version<>p_expected_version then return null; end if;
  v_unit_code:=private.allocation_run_unit_code(p_run_id);

  if not private.user_has_permission(p_actor_user_id,'allocation.approve',v_unit_code) then
    raise exception 'Permissão insuficiente para estornar o rateio.';
  end if;
  if v_run.status<>'posted' or v_run.reversal_entry_id is not null then
    raise exception 'O rateio não permite estorno.';
  end if;
  if v_run.posted_by=p_actor_user_id then
    raise exception 'O responsável pela postagem original não pode executar o próprio estorno.';
  end if;

  select * into v_original from public.journal_entries where id=v_run.journal_entry_id for update;
  v_period_id:=private.open_financial_period(v_original.legal_entity_id,p_reversal_date);
  if v_period_id is null then raise exception 'Não existe período aberto para a data do estorno.'; end if;

  insert into public.journal_entries(
    legal_entity_id,financial_period_id,source_type,source_id,
    competence_date,description,status,reversal_of_entry_id,
    created_by,validated_by
  ) values(
    v_original.legal_entity_id,v_period_id,'reversal',v_original.id,
    p_reversal_date,concat('Estorno de rateio #',v_original.entry_number,' — ',btrim(p_reason)),
    'draft',v_original.id,p_actor_user_id,p_actor_user_id
  ) returning id into v_reversal_id;

  for v_line in
    select * from public.journal_lines
    where journal_entry_id=v_original.id
    order by line_no
  loop
    insert into public.journal_lines(
      journal_entry_id,line_no,managerial_account_id,business_unit_id,
      product_id,service_line_id,project_id,contract_id,party_id,
      cost_center_id,revenue_center_id,category_id,
      debit_amount,credit_amount,original_currency_code,original_amount,fx_rate,description
    ) values(
      v_reversal_id,v_line.line_no,v_line.managerial_account_id,v_line.business_unit_id,
      v_line.product_id,v_line.service_line_id,v_line.project_id,v_line.contract_id,v_line.party_id,
      v_line.cost_center_id,v_line.revenue_center_id,v_line.category_id,
      v_line.credit_amount,v_line.debit_amount,v_line.original_currency_code,
      v_line.original_amount,v_line.fx_rate,concat('Estorno: ',coalesce(v_line.description,''))
    );
  end loop;

  update public.journal_entries
  set status='posted',posting_date=p_reversal_date,posted_by=p_actor_user_id,posted_at=now()
  where id=v_reversal_id and total_debit=total_credit and total_debit>0;

  if not found then raise exception 'O lançamento de estorno não está balanceado.'; end if;

  update public.journal_entries
  set status='reversed',reversed_by_entry_id=v_reversal_id
  where id=v_original.id;

  update public.allocation_runs
  set status='reversed',
      reversal_entry_id=v_reversal_id,
      reversed_by=p_actor_user_id,
      reversed_at=now()
  where id=p_run_id;

  return (select to_jsonb(r) from public.allocation_runs r where r.id=p_run_id);
end;
$$;

revoke all on function public.admin_submit_allocation_rule_version(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.admin_decide_allocation_rule_version(uuid,integer,boolean,text,uuid) from public,anon,authenticated;
revoke all on function public.admin_simulate_allocation_run(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.admin_submit_allocation_run(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.admin_decide_allocation_run(uuid,integer,boolean,text,uuid) from public,anon,authenticated;
revoke all on function public.admin_post_allocation_run(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.admin_reverse_allocation_run(uuid,integer,date,text,uuid) from public,anon,authenticated;

grant execute on function public.admin_submit_allocation_rule_version(uuid,integer,uuid) to service_role;
grant execute on function public.admin_decide_allocation_rule_version(uuid,integer,boolean,text,uuid) to service_role;
grant execute on function public.admin_simulate_allocation_run(uuid,integer,uuid) to service_role;
grant execute on function public.admin_submit_allocation_run(uuid,integer,uuid) to service_role;
grant execute on function public.admin_decide_allocation_run(uuid,integer,boolean,text,uuid) to service_role;
grant execute on function public.admin_post_allocation_run(uuid,integer,uuid) to service_role;
grant execute on function public.admin_reverse_allocation_run(uuid,integer,date,text,uuid) to service_role;
