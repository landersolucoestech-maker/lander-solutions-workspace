export type CrmLeadStatus =
  | "new"
  | "contact_pending"
  | "contacted"
  | "qualifying"
  | "qualified"
  | "proposal_sent"
  | "negotiation"
  | "converted"
  | "lost"
  | "disqualified";
export type CrmLeadPriority = "low" | "medium" | "high" | "urgent";
export type CrmLeadSource =
  | "site"
  | "online_form"
  | "whatsapp"
  | "phone"
  | "email"
  | "social"
  | "referral"
  | "prospecting"
  | "partner"
  | "other";
export type CrmOpportunityStatus = "open" | "won" | "lost" | "cancelled";
export type CrmProposalStatus =
  "draft" | "in_review" | "approved" | "sent" | "accepted" | "rejected" | "expired" | "cancelled";
export type CrmProposalVersionStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "sent"
  | "accepted"
  | "rejected"
  | "superseded"
  | "cancelled";

export interface CrmPipelineStage {
  id: string;
  business_unit_id: string;
  code: string;
  name: string;
  position: number;
  probability: number;
  stage_type: "open" | "won" | "lost";
  status: "active" | "inactive";
  version: number;
}

export interface CrmLead {
  id: string;
  code: string;
  business_unit_id: string;
  product_id: string | null;
  service_line_id: string | null;
  converted_party_id: string | null;
  lead_type: "organization" | "person";
  company_name: string | null;
  trade_name: string | null;
  contact_name: string;
  tax_id: string | null;
  birth_date: string | null;
  profession_activity: string | null;
  segment: string | null;
  company_size: "mei" | "micro" | "small" | "medium" | "large" | "other" | null;
  website: string | null;
  contact_role: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  city: string | null;
  state_region: string | null;
  country_code: string;
  preferred_currency_code: string;
  primary_service_other: string | null;
  need_summary: string | null;
  contact_preference: "phone" | "whatsapp" | "email" | "no_preference" | null;
  best_contact_time: string | null;
  source: CrmLeadSource;
  campaign: string | null;
  referred_by: string | null;
  status: CrmLeadStatus;
  priority: CrmLeadPriority;
  score: number;
  estimated_value: number;
  expected_close_date: string | null;
  owner_user_id: string | null;
  last_contact_at: string | null;
  next_action: string | null;
  next_action_at: string | null;
  notes: string | null;
  last_interaction_at: string | null;
  interaction_count: number;
  version: number;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmLeadService {
  id: string;
  lead_id: string;
  service_line_id: string | null;
  custom_service_name: string | null;
  is_primary: boolean;
  created_by: string;
  created_at: string;
}

export interface CrmLeadDiagnosticRequest {
  id: string;
  lead_id: string;
  service_line_id: string | null;
  custom_service_name: string | null;
  delivery_mode: "internal" | "external";
  form_url: string | null;
  status: "sent" | "opened" | "completed" | "cancelled";
  sent_at: string;
  sent_by: string;
  opened_at: string | null;
  completed_at: string | null;
  response_reference: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface CrmOpportunity {
  id: string;
  business_unit_id: string;
  lead_id: string | null;
  party_id: string;
  product_id: string | null;
  service_line_id: string | null;
  stage_id: string;
  owner_user_id: string | null;
  code: string;
  title: string;
  description: string | null;
  currency_code: string;
  estimated_amount: number;
  probability: number;
  weighted_amount: number;
  expected_close_date: string | null;
  status: CrmOpportunityStatus;
  loss_reason: string | null;
  next_step: string | null;
  next_step_at: string | null;
  won_at: string | null;
  lost_at: string | null;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CrmProposal {
  id: string;
  opportunity_id: string;
  party_id: string;
  business_unit_id: string;
  code: string;
  title: string;
  status: CrmProposalStatus;
  current_version_id: string | null;
  owner_user_id: string | null;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CrmProposalVersion {
  id: string;
  proposal_id: string;
  version_number: number;
  currency_code: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  estimated_cost: number;
  estimated_profit: number;
  estimated_margin: number;
  valid_until: string;
  payment_terms: string | null;
  scope_summary: string | null;
  assumptions: string | null;
  exclusions: string | null;
  status: CrmProposalVersionStatus;
  requested_by: string | null;
  requested_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  decision_reason: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CrmProposalItem {
  id: string;
  proposal_version_id: string;
  sequence_no: number;
  item_type: "product" | "service" | "custom" | "deliverable" | "milestone";
  product_id: string | null;
  service_line_id: string | null;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  estimated_unit_cost: number;
  line_total: number;
  line_cost: number;
  planned_hours: number;
  version: number;
}

export interface CrmProjectProfile {
  id: string;
  project_id: string;
  opportunity_id: string;
  proposal_id: string;
  proposal_version_id: string;
  party_id: string;
  contract_id: string | null;
  cost_center_id: string | null;
  revenue_center_id: string | null;
  currency_code: string;
  contracted_revenue: number;
  planned_cost: number;
  planned_profit: number;
  planned_margin: number;
  status: "planned" | "active" | "on_hold" | "completed" | "cancelled";
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CrmProjectScopeItem {
  id: string;
  project_profile_id: string;
  proposal_item_id: string | null;
  sequence_no: number;
  scope_type: "deliverable" | "milestone" | "assumption" | "exclusion" | "task";
  title: string;
  description: string | null;
  planned_hours: number;
  planned_revenue: number;
  planned_cost: number;
  due_date: string | null;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  version: number;
}

export interface CrmProjectProfitability {
  project_profile_id: string;
  project_id: string;
  project_code: string;
  project_name: string;
  business_unit_id: string;
  party_id: string;
  currency_code: string;
  contracted_revenue: number;
  planned_cost: number;
  planned_profit: number;
  planned_margin: number;
  actual_revenue: number;
  actual_cost: number;
  actual_profit: number;
  actual_margin: number;
}

export interface CrmActivity {
  id: string;
  business_unit_id: string;
  lead_id: string | null;
  opportunity_id: string | null;
  proposal_id: string | null;
  project_profile_id: string | null;
  activity_type: string;
  subject: string;
  description: string | null;
  status: "open" | "completed" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  assigned_user_id: string | null;
  due_at: string | null;
  completed_at: string | null;
  outcome: string | null;
  version: number;
}

export interface CrmOption {
  id: string;
  name: string;
  code?: string;
  business_unit_id?: string;
}

export interface CrmDirectory {
  stages: CrmPipelineStage[];
  leads: CrmLead[];
  leadServices: CrmLeadService[];
  leadDiagnostics: CrmLeadDiagnosticRequest[];
  opportunities: CrmOpportunity[];
  proposals: CrmProposal[];
  proposalVersions: CrmProposalVersion[];
  proposalItems: CrmProposalItem[];
  projectProfiles: CrmProjectProfile[];
  projectScopeItems: CrmProjectScopeItem[];
  profitability: CrmProjectProfitability[];
  activities: CrmActivity[];
  businessUnits: CrmOption[];
  products: CrmOption[];
  serviceLines: CrmOption[];
  parties: CrmOption[];
  profiles: CrmOption[];
  projects: CrmOption[];
}
