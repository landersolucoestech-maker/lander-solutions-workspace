revoke all privileges on public.allocation_source_candidates from anon;

grant select on public.allocation_source_candidates to authenticated,service_role;

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
  select * into v_run
  from public.allocation_runs
  where id=p_run_id
  for update;

  if not found or v_run.version<>p_expected_version then return null; end if;

  select * into v_version
  from public.allocation_rule_versions
  where id=v_run.allocation_rule_version_id;

  select * into v_rule
  from public.allocation_rules
  where id=v_version.allocation_rule_id;

  select * into v_period
  from public.financial_periods
  where id=v_run.financial_period_id;

  v_unit_code:=private.allocation_rule_unit_code(v_rule.id);

  if not private.user_has_permission(p_actor_user_id,'allocation.manage',v_unit_code) then
    raise exception 'Permissão insuficiente para simular o rateio.';
  end if;
  if v_run.status not in ('draft','simulated') then
    raise exception 'Execução não permite nova simulação.';
  end if;
  if v_version.status<>'approved' then
    raise exception 'A execução exige versão aprovada.';
  end if;
  if v_period.status not in ('open','reopened') then
    raise exception 'O período financeiro não está aberto.';
  end if;
  if v_run.competence_date not between v_period.period_start and v_period.period_end then
    raise exception 'A competência não pertence ao período selecionado.';
  end if;
  if v_run.competence_date < v_version.effective_start
     or (v_version.effective_end is not null and v_run.competence_date>v_version.effective_end) then
    raise exception 'A versão não está vigente na competência da execução.';
  end if;
  if not exists(
    select 1
    from public.allocation_run_sources
    where allocation_run_id=p_run_id
  ) then
    raise exception 'Selecione ao menos uma partida de origem.';
  end if;

  perform private.validate_allocation_version_ready(v_version.id);

  select coalesce(sum(
    private.allocation_target_basis(
      t.id,
      v_version.method,
      v_run.financial_period_id
    )
  ),0)
  into v_total_basis
  from public.allocation_rule_targets t
  where t.allocation_rule_version_id=v_version.id
    and t.is_active;

  if v_total_basis<=0 then
    raise exception 'A base do direcionador é zero; confirme os valores ou os dados do período.';
  end if;

  if v_version.method='fixed_percentage' and abs(v_total_basis-100)>0.000001 then
    raise exception 'Os percentuais fixos não totalizam 100%%.';
  end if;

  delete from public.allocation_run_distributions
  where allocation_run_id=p_run_id;

  with target_basis as (
    select
      t.id as target_id,
      t.business_unit_id,
      t.product_id,
      t.service_line_id,
      t.project_id,
      t.cost_center_id,
      t.sequence_no,
      private.allocation_target_basis(
        t.id,
        v_version.method,
        v_run.financial_period_id
      ) as basis
    from public.allocation_rule_targets t
    where t.allocation_rule_version_id=v_version.id
      and t.is_active
  ), raw as (
    select
      s.id as source_id,
      t.target_id,
      t.business_unit_id,
      t.product_id,
      t.service_line_id,
      t.project_id,
      t.cost_center_id,
      t.sequence_no,
      t.basis,
      (t.basis/v_total_basis)::numeric(24,12) as weight,
      (s.selected_amount*t.basis/v_total_basis)::numeric(24,12) as raw_amount,
      trunc((s.selected_amount*t.basis/v_total_basis)::numeric,2) as floor_amount
    from public.allocation_run_sources s
    cross join target_basis t
    where s.allocation_run_id=p_run_id
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
    allocation_run_id,
    allocation_run_source_id,
    allocation_target_id,
    business_unit_id,
    product_id,
    service_line_id,
    project_id,
    cost_center_id,
    driver_value,
    normalized_weight,
    allocation_percentage,
    allocated_amount,
    rounding_adjustment
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
    round(
      r.floor_amount
      + case when r.residual_rank=1 then s.selected_amount-r.floor_total else 0 end,
      2
    ),
    round(
      (
        r.floor_amount
        + case when r.residual_rank=1 then s.selected_amount-r.floor_total else 0 end
      ) - round(r.raw_amount,2),
      2
    )
  from ranked r
  join public.allocation_run_sources s on s.id=r.source_id;

  select coalesce(sum(selected_amount),0)
  into v_source_total
  from public.allocation_run_sources
  where allocation_run_id=p_run_id;

  update public.allocation_runs
  set status='simulated',
      method_snapshot=v_version.method,
      source_total=round(v_source_total,2),
      allocated_total=(
        select round(coalesce(sum(allocated_amount),0),2)
        from public.allocation_run_distributions
        where allocation_run_id=p_run_id
      ),
      residual_amount=round(
        v_source_total-(
          select coalesce(sum(allocated_amount),0)
          from public.allocation_run_distributions
          where allocation_run_id=p_run_id
        ),
        2
      )
  where id=p_run_id;

  if exists(
    select 1
    from public.allocation_run_sources s
    where s.allocation_run_id=p_run_id
      and round(
        s.selected_amount-(
          select coalesce(sum(d.allocated_amount),0)
          from public.allocation_run_distributions d
          where d.allocation_run_source_id=s.id
        ),
        2
      )<>0
  ) then
    raise exception 'A memória de cálculo não fecha com as origens selecionadas.';
  end if;

  return (
    select to_jsonb(r)
    from public.allocation_runs r
    where r.id=p_run_id
  );
end;
$$;

revoke all on function public.admin_simulate_allocation_run(uuid,integer,uuid)
from public,anon,authenticated;

grant execute on function public.admin_simulate_allocation_run(uuid,integer,uuid)
to service_role;
