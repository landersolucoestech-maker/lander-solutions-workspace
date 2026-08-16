export type AllocationRuleStatus = "draft" | "active" | "inactive" | "archived";
export type AllocationVersionStatus =
  "draft" | "pending_approval" | "approved" | "rejected" | "superseded";
export type AllocationMethod =
  | "fixed_percentage"
  | "equal"
  | "revenue"
  | "direct_cost"
  | "transaction_count"
  | "headcount"
  | "usage"
  | "manual_driver";
export type AllocationRunStatus =
  "draft" | "simulated" | "pending_approval" | "approved" | "posted" | "reversed" | "cancelled";

export interface AllocationRule {
  id: string;
  legal_entity_id: string;
  code: string;
  name: string;
  description: string | null;
  source_business_unit_id: string;
  status: AllocationRuleStatus;
  current_version_id: string | null;
  is_system: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AllocationRuleVersion {
  id: string;
  allocation_rule_id: string;
  version_no: number;
  method: AllocationMethod;
  effective_start: string;
  effective_end: string | null;
  source_managerial_account_id: string | null;
  source_cost_center_id: string | null;
  source_category_id: string | null;
  source_project_id: string | null;
  residual_strategy: "largest_fraction" | "designated_target";
  residual_business_unit_id: string | null;
  notes: string | null;
  status: AllocationVersionStatus;
  requested_by: string | null;
  requested_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  decision_reason: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AllocationTarget {
  id: string;
  allocation_rule_version_id: string;
  business_unit_id: string;
  product_id: string | null;
  service_line_id: string | null;
  project_id: string | null;
  cost_center_id: string | null;
  fixed_percentage: number | null;
  sequence_no: number;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AllocationDriverValue {
  id: string;
  allocation_rule_version_id: string;
  financial_period_id: string;
  allocation_target_id: string;
  driver_value: number;
  source_type: "manual" | "system" | "xlsx_import";
  source_reference: string | null;
  evidence: string | null;
  status: "draft" | "confirmed";
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AllocationRun {
  id: string;
  allocation_rule_version_id: string;
  financial_period_id: string;
  competence_date: string;
  description: string;
  status: AllocationRunStatus;
  method_snapshot: AllocationMethod;
  source_total: number;
  allocated_total: number;
  residual_amount: number;
  journal_entry_id: string | null;
  reversal_entry_id: string | null;
  requested_by: string | null;
  requested_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  posted_by: string | null;
  posted_at: string | null;
  reversed_by: string | null;
  reversed_at: string | null;
  cancellation_reason: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AllocationRunSource {
  id: string;
  allocation_run_id: string;
  journal_line_id: string;
  available_amount_snapshot: number;
  selected_amount: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AllocationDistribution {
  id: string;
  allocation_run_id: string;
  allocation_run_source_id: string;
  allocation_target_id: string;
  business_unit_id: string;
  product_id: string | null;
  service_line_id: string | null;
  project_id: string | null;
  cost_center_id: string | null;
  driver_value: number;
  normalized_weight: number;
  allocation_percentage: number;
  allocated_amount: number;
  rounding_adjustment: number;
  created_at: string;
}

export interface AllocationApproval {
  id: string;
  allocation_run_id: string;
  requested_by: string;
  requested_at: string;
  approver_user_id: string | null;
  decision: "pending" | "approved" | "rejected";
  reason: string | null;
  decided_at: string | null;
  version: number;
}

export interface AllocationSourceCandidate {
  journal_line_id: string;
  journal_entry_id: string;
  entry_number: number;
  competence_date: string;
  entry_description: string;
  line_description: string | null;
  managerial_account_id: string;
  account_code: string;
  account_name: string;
  business_unit_id: string;
  business_unit_code: string;
  product_id: string | null;
  service_line_id: string | null;
  project_id: string | null;
  contract_id: string | null;
  party_id: string | null;
  cost_center_id: string | null;
  category_id: string | null;
  source_amount: number;
  allocated_amount: number;
  available_amount: number;
}

export interface NamedOption {
  id: string;
  code?: string;
  name: string;
  legal_entity_id?: string;
  business_unit_id?: string;
  status?: string;
}

export interface FinancialPeriodOption {
  id: string;
  legal_entity_id: string;
  period_start: string;
  period_end: string;
  status: string;
}

export interface AllocationWorkspace {
  rules: AllocationRule[];
  versions: AllocationRuleVersion[];
  targets: AllocationTarget[];
  driverValues: AllocationDriverValue[];
  runs: AllocationRun[];
  sources: AllocationRunSource[];
  distributions: AllocationDistribution[];
  approvals: AllocationApproval[];
  sourceCandidates: AllocationSourceCandidate[];
  legalEntities: Array<{ id: string; code: string; name: string; status: string }>;
  businessUnits: NamedOption[];
  financialPeriods: FinancialPeriodOption[];
  products: NamedOption[];
  serviceLines: NamedOption[];
  projects: NamedOption[];
  costCenters: NamedOption[];
  managerialAccounts: NamedOption[];
  categories: NamedOption[];
}
