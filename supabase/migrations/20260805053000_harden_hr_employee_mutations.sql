-- Employee creation and update derive the actor from the authenticated
-- session. Internal routines that accept an actor identifier remain owner-only.

CREATE OR REPLACE FUNCTION public.create_hr_employee(
  p_legal_name text,
  p_social_name text,
  p_cpf text,
  p_birth_date date,
  p_personal_email text,
  p_phone text,
  p_address_line text,
  p_city text,
  p_state text,
  p_postal_code text,
  p_emergency_contact_name text,
  p_emergency_contact_phone text,
  p_photo_path text,
  p_user_id uuid,
  p_corporate_email text,
  p_business_unit_id uuid,
  p_department_id uuid,
  p_position_id uuid,
  p_manager_employee_id uuid,
  p_hire_date date,
  p_employment_type text,
  p_work_schedule text,
  p_work_mode text,
  p_status text,
  p_internal_notes text
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

  RETURN public.admin_create_hr_employee(
    p_legal_name,
    p_social_name,
    p_cpf,
    p_birth_date,
    p_personal_email,
    p_phone,
    p_address_line,
    p_city,
    p_state,
    p_postal_code,
    p_emergency_contact_name,
    p_emergency_contact_phone,
    p_photo_path,
    p_user_id,
    p_corporate_email,
    p_business_unit_id,
    p_department_id,
    p_position_id,
    p_manager_employee_id,
    p_hire_date,
    p_employment_type,
    p_work_schedule,
    p_work_mode,
    p_status,
    p_internal_notes,
    v_actor_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_hr_employee(
  p_employee_id uuid,
  p_employee_expected_version bigint,
  p_person_expected_version bigint,
  p_legal_name text,
  p_social_name text,
  p_birth_date date,
  p_personal_email text,
  p_phone text,
  p_address_line text,
  p_city text,
  p_state text,
  p_postal_code text,
  p_emergency_contact_name text,
  p_emergency_contact_phone text,
  p_photo_path text,
  p_user_id uuid,
  p_corporate_email text,
  p_business_unit_id uuid,
  p_department_id uuid,
  p_position_id uuid,
  p_manager_employee_id uuid,
  p_hire_date date,
  p_employment_type text,
  p_work_schedule text,
  p_work_mode text,
  p_status text,
  p_internal_notes text
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

  RETURN public.admin_update_hr_employee(
    p_employee_id,
    p_employee_expected_version,
    p_person_expected_version,
    p_legal_name,
    p_social_name,
    p_birth_date,
    p_personal_email,
    p_phone,
    p_address_line,
    p_city,
    p_state,
    p_postal_code,
    p_emergency_contact_name,
    p_emergency_contact_phone,
    p_photo_path,
    p_user_id,
    p_corporate_email,
    p_business_unit_id,
    p_department_id,
    p_position_id,
    p_manager_employee_id,
    p_hire_date,
    p_employment_type,
    p_work_schedule,
    p_work_mode,
    p_status,
    p_internal_notes,
    v_actor_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_hr_employee(
  text,text,text,date,text,text,text,text,text,text,text,text,text,uuid,text,uuid,uuid,uuid,uuid,date,text,text,text,text,text,uuid
) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_update_hr_employee(
  uuid,bigint,bigint,text,text,date,text,text,text,text,text,text,text,text,text,uuid,text,uuid,uuid,uuid,uuid,date,text,text,text,text,text,uuid
) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_hr_employee(
  text,text,text,date,text,text,text,text,text,text,text,text,text,uuid,text,uuid,uuid,uuid,uuid,date,text,text,text,text,text
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_hr_employee(
  text,text,text,date,text,text,text,text,text,text,text,text,text,uuid,text,uuid,uuid,uuid,uuid,date,text,text,text,text,text
) TO authenticated;

REVOKE ALL ON FUNCTION public.update_hr_employee(
  uuid,bigint,bigint,text,text,date,text,text,text,text,text,text,text,text,text,uuid,text,uuid,uuid,uuid,uuid,date,text,text,text,text,text
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.update_hr_employee(
  uuid,bigint,bigint,text,text,date,text,text,text,text,text,text,text,text,text,uuid,text,uuid,uuid,uuid,uuid,date,text,text,text,text,text
) TO authenticated;
