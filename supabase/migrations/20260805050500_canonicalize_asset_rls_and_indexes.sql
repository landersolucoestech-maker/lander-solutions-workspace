-- Equipment is no longer an HR-owned subdomain. Corporate assets and their
-- assignment history are governed exclusively by the assets permission set.

DROP POLICY IF EXISTS corporate_assets_hr_equipment_insert ON public.corporate_assets;
DROP POLICY IF EXISTS corporate_assets_hr_equipment_select ON public.corporate_assets;
DROP POLICY IF EXISTS corporate_assets_hr_equipment_update ON public.corporate_assets;

DROP POLICY IF EXISTS corporate_assets_select ON public.corporate_assets;
CREATE POLICY corporate_assets_select
ON public.corporate_assets
FOR SELECT
TO authenticated
USING (
  private.current_user_has_permission(
    'assets.read',
    private.governance_unit_code(business_unit_id)
  )
  OR private.current_user_has_permission(
    'assets.manage',
    private.governance_unit_code(business_unit_id)
  )
  OR private.current_user_has_permission(
    'assets.approve_events',
    private.governance_unit_code(business_unit_id)
  )
);

DROP POLICY IF EXISTS asset_assignments_manage ON public.asset_assignments;
CREATE POLICY asset_assignments_manage
ON public.asset_assignments
FOR ALL
TO authenticated
USING (
  private.current_user_has_permission(
    'assets.manage',
    private.asset_unit_code(asset_id)
  )
)
WITH CHECK (
  private.current_user_has_permission(
    'assets.manage',
    private.asset_unit_code(asset_id)
  )
);

DROP POLICY IF EXISTS asset_assignments_read ON public.asset_assignments;
CREATE POLICY asset_assignments_read
ON public.asset_assignments
FOR SELECT
TO authenticated
USING (
  private.current_user_has_permission(
    'assets.read',
    private.asset_unit_code(asset_id)
  )
  OR private.current_user_has_permission(
    'assets.manage',
    private.asset_unit_code(asset_id)
  )
  OR private.current_user_has_permission(
    'assets.approve_events',
    private.asset_unit_code(asset_id)
  )
);

CREATE INDEX IF NOT EXISTS idx_asset_assignments_assigned_by
  ON public.asset_assignments(assigned_by)
  WHERE assigned_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_asset_assignments_created_by
  ON public.asset_assignments(created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_asset_assignments_returned_by
  ON public.asset_assignments(returned_by)
  WHERE returned_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_asset_assignments_updated_by
  ON public.asset_assignments(updated_by)
  WHERE updated_by IS NOT NULL;
