-- Employee payment posting derives the actor from the authenticated session.
-- The internal routine accepting an actor identifier remains owner-only.

CREATE OR REPLACE FUNCTION public.mark_hr_payment_paid(
  p_payment_id uuid,
  p_payment_date date,
  p_payment_method text,
  p_proof_storage_path text,
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

  RETURN public.admin_mark_hr_payment_paid(
    p_payment_id,
    p_payment_date,
    p_payment_method,
    p_proof_storage_path,
    p_expected_version,
    v_actor_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_mark_hr_payment_paid(
  uuid,date,text,text,bigint,uuid
) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.mark_hr_payment_paid(
  uuid,date,text,text,bigint
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.mark_hr_payment_paid(
  uuid,date,text,text,bigint
) TO authenticated;
