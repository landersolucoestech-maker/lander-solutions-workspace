-- The equipment domain is canonical in corporate_assets and asset_assignments.
-- Remove the obsolete HR workflow only after the legacy tables are gone.

DO $$
BEGIN
  IF to_regclass('public.equipment') IS NOT NULL
     OR to_regclass('public.equipment_assignments') IS NOT NULL THEN
    RAISE EXCEPTION 'As tabelas legadas de equipamento ainda existem.';
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_assign_hr_equipment(
  uuid, uuid, date, date, text, text, uuid
) RESTRICT;

DROP FUNCTION IF EXISTS public.admin_create_hr_equipment(
  uuid, text, text, text, text, text, text, text, text, text, uuid
) RESTRICT;

DROP FUNCTION IF EXISTS public.admin_return_hr_equipment(
  uuid, date, text, text, bigint, uuid
) RESTRICT;

DROP FUNCTION IF EXISTS private.block_legacy_equipment_write() RESTRICT;

-- role_permissions is configured with ON DELETE CASCADE for permission_id.
DELETE FROM public.permissions
WHERE code IN ('hr.equipment.read', 'hr.equipment.manage');
