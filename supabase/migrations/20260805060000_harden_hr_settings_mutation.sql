create or replace function public.upsert_hr_settings(
  p_business_unit_id uuid,
  p_contract_expiry_alert_days integer,
  p_document_expiry_alert_days integer,
  p_expected_version bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_unit_code text;
  v_setting public.hr_settings;
begin
  if v_actor_user_id is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501';
  end if;

  if not public.has_aal2() then
    raise exception 'A operação exige MFA aal2.' using errcode = '42501';
  end if;

  if p_contract_expiry_alert_days is null
     or p_contract_expiry_alert_days < 1
     or p_contract_expiry_alert_days > 365 then
    raise exception 'O prazo de alerta de contratos deve estar entre 1 e 365 dias.';
  end if;

  if p_document_expiry_alert_days is null
     or p_document_expiry_alert_days < 1
     or p_document_expiry_alert_days > 365 then
    raise exception 'O prazo de alerta de documentos deve estar entre 1 e 365 dias.';
  end if;

  if p_business_unit_id is null then
    if not exists (
      select 1
      from public.profiles profile
      join public.user_role_assignments assignment
        on assignment.user_id = profile.id
      join public.role_permissions role_permission
        on role_permission.role_id = assignment.role_id
      join public.permissions permission
        on permission.id = role_permission.permission_id
      where profile.id = v_actor_user_id
        and profile.status = 'active'
        and assignment.status = 'active'
        and assignment.valid_from <= now()
        and (assignment.valid_until is null or assignment.valid_until > now())
        and assignment.unit_code is null
        and permission.code = 'hr.settings.manage'
    ) then
      raise exception 'Permissão global insuficiente.' using errcode = '42501';
    end if;
  else
    v_unit_code := private.unit_code_for_id(p_business_unit_id);
    if v_unit_code is null then
      raise exception 'Unidade de negócio não encontrada.' using errcode = 'P0002';
    end if;

    if not private.user_has_permission(
      v_actor_user_id,
      'hr.settings.manage',
      v_unit_code
    ) then
      raise exception 'Permissão insuficiente.' using errcode = '42501';
    end if;
  end if;

  select setting.*
    into v_setting
  from public.hr_settings setting
  where setting.business_unit_id is not distinct from p_business_unit_id
    and setting.deleted_at is null
  limit 1
  for update;

  if found then
    if p_expected_version is null then
      raise exception 'A versão atual da configuração é obrigatória.' using errcode = '40001';
    end if;

    if v_setting.version <> p_expected_version then
      raise exception 'A configuração foi alterada por outro usuário.' using errcode = '40001';
    end if;

    update public.hr_settings
    set contract_expiry_alert_days = p_contract_expiry_alert_days,
        document_expiry_alert_days = p_document_expiry_alert_days,
        updated_by = v_actor_user_id
    where id = v_setting.id
    returning * into v_setting;
  else
    if p_expected_version is not null then
      raise exception 'A configuração foi alterada por outro usuário.' using errcode = '40001';
    end if;

    begin
      insert into public.hr_settings (
        business_unit_id,
        contract_expiry_alert_days,
        document_expiry_alert_days,
        created_by,
        updated_by
      )
      values (
        p_business_unit_id,
        p_contract_expiry_alert_days,
        p_document_expiry_alert_days,
        v_actor_user_id,
        v_actor_user_id
      )
      returning * into v_setting;
    exception
      when unique_violation then
        raise exception 'A configuração foi alterada por outro usuário.' using errcode = '40001';
    end;
  end if;

  return jsonb_build_object(
    'id', v_setting.id,
    'business_unit_id', v_setting.business_unit_id,
    'contract_expiry_alert_days', v_setting.contract_expiry_alert_days,
    'document_expiry_alert_days', v_setting.document_expiry_alert_days,
    'version', v_setting.version
  );
end;
$function$;

revoke all on function public.upsert_hr_settings(uuid, integer, integer, bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.upsert_hr_settings(uuid, integer, integer, bigint)
  to authenticated;

comment on function public.upsert_hr_settings(uuid, integer, integer, bigint)
  is 'Caller-scoped HR settings upsert with MFA, exact global scope authorization, unit authorization, and optimistic concurrency.';
