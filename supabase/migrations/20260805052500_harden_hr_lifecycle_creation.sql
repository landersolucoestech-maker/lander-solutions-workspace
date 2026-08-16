-- HR lifecycle creation derives the actor from the authenticated session.
-- Internal routines that accept an actor identifier remain owner-only.

CREATE OR REPLACE FUNCTION public.create_hr_onboarding(
  p_employee_id uuid,
  p_expected_start_date date,
  p_responsible_user_id uuid,
  p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_actor_user_id uuid := auth.uid();
BEGIN
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING errcode='42501';
  END IF;
  IF NOT public.has_aal2() THEN
    RAISE EXCEPTION 'A operação exige MFA aal2.' USING errcode='42501';
  END IF;

  RETURN public.admin_create_hr_onboarding(
    p_employee_id,
    p_expected_start_date,
    p_responsible_user_id,
    p_notes,
    v_actor_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_hr_offboarding(
  p_employee_id uuid,
  p_last_working_day date,
  p_reason text,
  p_responsible_user_id uuid,
  p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_actor_user_id uuid := auth.uid();
BEGIN
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING errcode='42501';
  END IF;
  IF NOT public.has_aal2() THEN
    RAISE EXCEPTION 'A operação exige MFA aal2.' USING errcode='42501';
  END IF;

  RETURN public.admin_create_hr_offboarding(
    p_employee_id,
    p_last_working_day,
    p_reason,
    p_responsible_user_id,
    p_notes,
    v_actor_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_hr_onboarding(
  uuid,date,uuid,text,uuid
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_create_hr_offboarding(
  uuid,date,text,uuid,text,uuid
) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_hr_onboarding(
  uuid,date,uuid,text
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_hr_onboarding(
  uuid,date,uuid,text
) TO authenticated;

REVOKE ALL ON FUNCTION public.create_hr_offboarding(
  uuid,date,text,uuid,text
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_hr_offboarding(
  uuid,date,text,uuid,text
) TO authenticated;
