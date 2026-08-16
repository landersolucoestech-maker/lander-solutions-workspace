-- Caller-scoped participation and payout workflows.
-- The legacy admin functions remain internal implementation details and cannot
-- be executed by browser clients with an arbitrary actor id.

create or replace function public.calculate_participation(
  p_calculation_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
begin
  if v_actor is null then raise exception 'Autenticação obrigatória.' using errcode='42501'; end if;
  if not private.current_user_has_aal2() then raise exception 'MFA aal2 obrigatório.' using errcode='42501'; end if;
  return public.admin_calculate_participation(p_calculation_id,p_expected_version,v_actor);
end;
$$;

create or replace function public.submit_participation(
  p_calculation_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
begin
  if v_actor is null then raise exception 'Autenticação obrigatória.' using errcode='42501'; end if;
  if not private.current_user_has_aal2() then raise exception 'MFA aal2 obrigatório.' using errcode='42501'; end if;
  return public.admin_submit_participation(p_calculation_id,p_expected_version,v_actor);
end;
$$;

create or replace function public.decide_participation(
  p_calculation_id uuid,
  p_expected_version integer,
  p_approve boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
begin
  if v_actor is null then raise exception 'Autenticação obrigatória.' using errcode='42501'; end if;
  if not private.current_user_has_aal2() then raise exception 'MFA aal2 obrigatório.' using errcode='42501'; end if;
  return public.admin_decide_participation(
    p_calculation_id,p_expected_version,v_actor,p_approve,nullif(btrim(coalesce(p_reason,'')),'')
  );
end;
$$;

create or replace function public.post_participation(
  p_calculation_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
begin
  if v_actor is null then raise exception 'Autenticação obrigatória.' using errcode='42501'; end if;
  if not private.current_user_has_aal2() then raise exception 'MFA aal2 obrigatório.' using errcode='42501'; end if;
  return public.admin_post_participation(p_calculation_id,p_expected_version,v_actor);
end;
$$;

create or replace function public.post_payout_payment(
  p_payment_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
begin
  if v_actor is null then raise exception 'Autenticação obrigatória.' using errcode='42501'; end if;
  if not private.current_user_has_aal2() then raise exception 'MFA aal2 obrigatório.' using errcode='42501'; end if;
  return public.admin_post_payout_payment(p_payment_id,p_expected_version,v_actor);
end;
$$;

create or replace function public.list_available_payout_settlements(
  p_obligation_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_obligation public.payout_obligations;
  v_unit_code text;
  v_result jsonb;
begin
  if v_actor is null then raise exception 'Autenticação obrigatória.' using errcode='42501'; end if;
  if not private.current_user_has_aal2() then raise exception 'MFA aal2 obrigatório.' using errcode='42501'; end if;

  select * into v_obligation
  from public.payout_obligations
  where id=p_obligation_id;
  if not found then raise exception 'Obrigação de repasse não encontrada.'; end if;

  v_unit_code:=private.unit_code_for_id(v_obligation.business_unit_id);
  if not private.current_user_has_permission('payout.read',v_unit_code) then
    raise exception 'Permissão payout.read obrigatória.' using errcode='42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',settlement.id,
        'financial_document_id',settlement.financial_document_id,
        'settlement_date',settlement.settlement_date,
        'original_currency_code',settlement.original_currency_code,
        'original_amount',settlement.original_amount,
        'functional_amount',settlement.functional_amount,
        'external_reference',settlement.external_reference,
        'cash_account_name',coalesce(cash_account.name,'Conta financeira')
      ) order by settlement.settlement_date desc,settlement.created_at desc
    ),
    '[]'::jsonb
  ) into v_result
  from public.financial_settlements settlement
  left join public.cash_accounts cash_account on cash_account.id=settlement.cash_account_id
  where settlement.financial_document_id=v_obligation.financial_document_id
    and settlement.status='posted'
    and settlement.original_currency_code=v_obligation.currency_code
    and settlement.original_amount<=v_obligation.amount-v_obligation.paid_amount
    and not exists (
      select 1 from public.payout_payments payment
      where payment.financial_settlement_id=settlement.id
    );

  return v_result;
end;
$$;

revoke all on function public.calculate_participation(uuid,integer) from public,anon;
revoke all on function public.submit_participation(uuid,integer) from public,anon;
revoke all on function public.decide_participation(uuid,integer,boolean,text) from public,anon;
revoke all on function public.post_participation(uuid,integer) from public,anon;
revoke all on function public.post_payout_payment(uuid,integer) from public,anon;
revoke all on function public.list_available_payout_settlements(uuid) from public,anon;

grant execute on function public.calculate_participation(uuid,integer) to authenticated;
grant execute on function public.submit_participation(uuid,integer) to authenticated;
grant execute on function public.decide_participation(uuid,integer,boolean,text) to authenticated;
grant execute on function public.post_participation(uuid,integer) to authenticated;
grant execute on function public.post_payout_payment(uuid,integer) to authenticated;
grant execute on function public.list_available_payout_settlements(uuid) to authenticated;

revoke all on function public.admin_calculate_participation(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.admin_submit_participation(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.admin_decide_participation(uuid,integer,uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.admin_post_participation(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.admin_post_payout_payment(uuid,integer,uuid) from public,anon,authenticated;

grant execute on function public.admin_calculate_participation(uuid,integer,uuid) to service_role;
grant execute on function public.admin_submit_participation(uuid,integer,uuid) to service_role;
grant execute on function public.admin_decide_participation(uuid,integer,uuid,boolean,text) to service_role;
grant execute on function public.admin_post_participation(uuid,integer,uuid) to service_role;
grant execute on function public.admin_post_payout_payment(uuid,integer,uuid) to service_role;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'participation_calculations','participation_calculation_lines','participation_approvals',
    'payout_obligations','payout_payments'
  ] loop
    execute format('alter table public.%I enable row level security',v_table);
    execute format('drop policy if exists dev_public_read on public.%I',v_table);
    execute format('revoke all on public.%I from anon',v_table);
  end loop;
end;
$$;

comment on function public.calculate_participation(uuid,integer) is
  'Caller-scoped calculation workflow. Actor identity is derived from auth.uid().';
comment on function public.post_payout_payment(uuid,integer) is
  'Caller-scoped payout posting workflow. Actor identity is derived from auth.uid().';
