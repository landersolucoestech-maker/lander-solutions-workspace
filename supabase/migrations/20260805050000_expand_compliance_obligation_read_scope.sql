-- Administrative compliance actions resolve their unit scope through the
-- obligation. Users allowed to manage, complete or waive occurrences must be
-- able to read that parent record before the caller-scoped RPC is invoked.

DROP POLICY IF EXISTS compliance_obligations_select ON public.compliance_obligations;

CREATE POLICY compliance_obligations_select
ON public.compliance_obligations
FOR SELECT
TO authenticated
USING (
  private.current_user_has_permission(
    'compliance.read',
    private.governance_unit_code(business_unit_id)
  )
  OR private.current_user_has_permission(
    'compliance.manage',
    private.governance_unit_code(business_unit_id)
  )
  OR private.current_user_has_permission(
    'compliance.complete',
    private.governance_unit_code(business_unit_id)
  )
  OR private.current_user_has_permission(
    'compliance.waive',
    private.governance_unit_code(business_unit_id)
  )
);
