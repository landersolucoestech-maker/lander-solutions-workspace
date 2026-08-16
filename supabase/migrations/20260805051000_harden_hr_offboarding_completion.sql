-- Expose offboarding completion through a caller-scoped RPC. The internal
-- routine that accepts an actor identifier remains callable only by its owner.

CREATE OR REPLACE FUNCTION public.complete_hr_offboarding(
  p_process_id uuid,
  p_effective_date date,
  p_expected_version bigint
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

  RETURN public.admin_complete_hr_offboarding(
    p_process_id,
    p_effective_date,
    p_expected_version,
    v_actor_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_complete_hr_offboarding(
  uuid,date,bigint,uuid
) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.complete_hr_offboarding(
  uuid,date,bigint
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.complete_hr_offboarding(
  uuid,date,bigint
) TO authenticated;
