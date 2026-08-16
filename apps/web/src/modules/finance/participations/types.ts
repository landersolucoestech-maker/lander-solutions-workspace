export type ParticipationStatus =
  "draft" | "calculated" | "pending_approval" | "approved" | "posted" | "cancelled" | "reversed";
export type ParticipationLineStatus = "calculated" | "held" | "payable" | "cancelled" | "paid";

export interface ParticipationCalculation {
  id: string;
  legal_entity_id: string;
  business_unit_id: string;
  product_id: string | null;
  service_line_id: string | null;
  contract_id: string;
  contract_version_id: string;
  financial_period_id: string;
  code: string;
  competence_start: string;
  competence_end: string;
  currency_code: string;
  gross_revenue: number;
  deductions: number;
  direct_costs: number;
  allocated_costs: number;
  taxes: number;
  payment_fees: number;
  investments: number;
  reserves: number;
  prior_loss_offset: number;
  distributable_base: number | null;
  calculation_method: "contract_formula" | "manual_adjustment";
  status: ParticipationStatus;
  description: string | null;
  requested_by: string | null;
  requested_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  posted_by: string | null;
  posted_at: string | null;
  journal_entry_id: string | null;
  reversal_journal_entry_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ParticipationLine {
  id: string;
  participation_calculation_id: string;
  contract_participant_id: string;
  party_id: string;
  sequence_no: number;
  percentage: number;
  calculation_base: number;
  gross_share: number;
  retention_percentage: number;
  retention_amount: number;
  minimum_adjustment: number;
  maximum_adjustment: number;
  loss_offset: number;
  net_payable: number;
  calculation_memory: Record<string, unknown>;
  status: ParticipationLineStatus;
  hold_reason: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ParticipationApproval {
  id: string;
  participation_calculation_id: string;
  requester_id: string;
  approver_id: string | null;
  decision: "pending" | "approved" | "rejected";
  reason: string | null;
  requested_at: string;
  decided_at: string | null;
}

export interface ContractOption {
  id: string;
  legal_entity_id: string;
  business_unit_id: string;
  product_id: string | null;
  service_line_id: string | null;
  code: string;
  title: string;
  currency_code: string;
  status: string;
}

export interface ContractVersionOption {
  id: string;
  contract_id: string;
  version_number: number;
  effective_from: string;
  effective_to: string | null;
  payment_term_days: number;
  status: string;
}

export interface PartyOption {
  id: string;
  legal_name: string;
  trade_name: string | null;
  status: string;
}

export interface NamedOption {
  id: string;
  code?: string;
  name: string;
  legal_entity_id?: string;
  status?: string;
}

export interface PeriodOption {
  id: string;
  legal_entity_id: string;
  period_start: string;
  period_end: string;
  status: string;
}
