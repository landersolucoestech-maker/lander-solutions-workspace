-- Leave decisions derive the actor from the authenticated session. The
-- internal routine that accepts an actor identifier remains owner-only.

CREATE OR REPLACE FUNCTION public.decide_hr_leave(
  p_request_id uuid,
  p_decision text,
  p_rejection_reason text,
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

  RETURN public.admin_decide_hr_leave(
    p_request_id,
    p_decision,
    p_rejection_reason,
    p_expected_version,
    v_actor_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_decide_hr_leave(
  uuid,text,text,bigint,uuid
) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.decide_hr_leave(
  uuid,text,text,bigint
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.decide_hr_leave(
  uuid,text,text,bigint
) TO authenticated;
