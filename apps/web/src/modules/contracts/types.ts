export type ContractStatus =
  | "draft"
  | "in_review"
  | "pending_signature"
  | "active"
  | "renewal"
  | "expired"
  | "terminated"
  | "cancelled";

export type ContractVersionStatus = "draft" | "in_review" | "approved" | "superseded" | "rejected";

export type Contract = {
  id: string;
  legal_entity_id: string;
  business_unit_id: string;
  product_id: string | null;
  service_line_id: string | null;
  template_id: string | null;
  code: string;
  title: string;
  contract_type: string;
  currency_code: string;
  billing_frequency: string;
  base_amount: number | null;
  recognition_regime: "COMPETENCIA" | "CAIXA" | "HIBRIDO_CONTRATUAL";
  starts_on: string | null;
  ends_on: string | null;
  auto_renewal: boolean;
  renewal_notice_days: number;
  responsible_user_id: string | null;
  status: ContractStatus;
  notes: string | null;
  version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ContractTemplateVariable = {
  key: string;
  label: string;
  type: "text" | "textarea" | "date" | "number" | "currency" | "percentage" | "select";
  required: boolean;
  group: string;
  source?: string;
  description?: string;
  active?: boolean;
  options?: string[];
};

export type ContractTemplateImageAlignment = "left" | "center" | "right";

export type ContractTemplate = {
  id: string;
  business_unit_id: string | null;
  code: string;
  name: string;
  description: string | null;
  contract_type: string;
  body_text: string;
  variables_manifest: unknown[];
  party_roles: string[];
  signature_roles: string[];
  header_text: string;
  footer_text: string;
  header_image_path: string | null;
  footer_image_path: string | null;
  header_image_alignment: ContractTemplateImageAlignment;
  footer_image_alignment: ContractTemplateImageAlignment;
  default_calculation_basis: string;
  default_included_components: string[];
  default_excluded_components: string[];
  default_loss_rule: string;
  default_investment_rule: string;
  status: "active" | "inactive";
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ContractParty = {
  id: string;
  contract_id: string;
  party_id: string;
  party_role: string;
  is_primary: boolean;
  status: "active" | "inactive" | "ended";
  starts_on: string | null;
  ends_on: string | null;
  notes: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export type ContractVersion = {
  id: string;
  contract_id: string;
  version_number: number;
  effective_from: string;
  effective_to: string | null;
  change_reason: string;
  template_body_snapshot: string;
  calculation_basis: string;
  included_components: string[];
  excluded_components: string[];
  loss_rule: string;
  investment_rule: string;
  reserve_method: string;
  reserve_value: number | null;
  rounding_scale: number;
  allows_distinct_bases: boolean;
  payment_term_days: number;
  party_snapshot: unknown[];
  template_variables: Record<string, unknown>;
  signers_snapshot: unknown[];
  rendered_body: string;
  unresolved_placeholders: string[];
  status: ContractVersionStatus;
  requested_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export type ContractFormulaComponent = {
  id: string;
  contract_version_id: string;
  sequence_no: number;
  component_type: string;
  operation: string;
  recognition_basis: string;
  filter_scope: string;
  filter_value: string | null;
  description: string | null;
  status: "active" | "inactive";
  version: number;
  created_at: string;
  updated_at: string;
};

export type ContractParticipant = {
  id: string;
  contract_version_id: string;
  party_id: string;
  percentage: number;
  priority: number;
  minimum_amount: number | null;
  maximum_amount: number | null;
  retention_percentage: number;
  eligibility_condition: string | null;
  status: "active" | "inactive" | "suspended";
  version: number;
  created_at: string;
  updated_at: string;
};

export type ContractObligation = {
  id: string;
  contract_version_id: string;
  obligation_type: string;
  title: string;
  description: string;
  responsible_party_id: string | null;
  due_rule: string;
  due_date: string | null;
  recurrence: string;
  amount: number | null;
  currency_code: string | null;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
};

export type ContractDocument = {
  id: string;
  contract_version_id: string;
  document_type: string;
  label: string;
  storage_provider: string;
  storage_bucket: string | null;
  storage_object_key: string | null;
  external_reference: string | null;
  checksum_sha256: string | null;
  status: string;
  verified_by: string | null;
  verified_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export type ContractApproval = {
  id: string;
  contract_version_id: string;
  requested_by: string;
  approver_user_id: string | null;
  decision: string;
  decision_reason: string | null;
  decided_at: string | null;
  created_at: string;
};

export type ContractAuditEvent = {
  id: number;
  occurred_at: string;
  actor_user_id: string | null;
  action: string;
  entity_table: string;
  entity_id: string | null;
  metadata: unknown;
};

export type PartyOption = {
  id: string;
  legal_name: string;
  trade_name: string | null;
  tax_id: string | null;
  party_type: "organization" | "person";
  status: string;
};

export type ProfileOption = {
  id: string;
  display_name: string;
  email: string | null;
};

export type ContractDirectory = {
  contracts: Contract[];
  parties: ContractParty[];
  versions: ContractVersion[];
  components: ContractFormulaComponent[];
  participants: ContractParticipant[];
  obligations: ContractObligation[];
  documents: ContractDocument[];
  approvals: ContractApproval[];
  partyOptions: PartyOption[];
  profiles: ProfileOption[];
};
