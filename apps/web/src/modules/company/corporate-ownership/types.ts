export interface LegalEntityOption {
  id: string;
  code: string;
  legal_name: string;
  trade_name: string | null;
  functional_currency_code: string;
  status: string;
}

export interface PartyOption {
  id: string;
  party_type: "person" | "organization";
  legal_name: string;
  trade_name: string | null;
  tax_id: string | null;
  status: string;
}

export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
}

export interface ProfileOption {
  id: string;
  display_name: string;
  email: string | null;
  status: string;
}

export interface CapitalStructure {
  id: string;
  legal_entity_id: string;
  version_no: number;
  currency_code: string;
  capital_amount: number;
  total_quotas: number;
  status: "draft" | "approved" | "effective" | "superseded" | "cancelled";
  effective_from: string;
  effective_to: string | null;
  change_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  applied_by: string | null;
  applied_at: string | null;
  created_by: string;
  updated_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ShareClass {
  id: string;
  capital_structure_id: string;
  code: string;
  name: string;
  description: string | null;
  authorized_quotas: number;
  voting_rights: boolean;
  votes_per_quota: number;
  distribution_priority: number;
  liquidation_priority: number;
  status: "active" | "inactive";
  created_by: string;
  updated_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface OwnershipPosition {
  id: string;
  capital_structure_id: string;
  share_class_id: string;
  holder_party_id: string;
  quota_quantity: number;
  acquisition_method:
    "subscription" | "transfer" | "capitalization" | "inheritance" | "conversion" | "adjustment";
  effective_from: string;
  effective_to: string | null;
  status: "active" | "exited" | "cancelled";
  evidence_document_id: string | null;
  notes: string | null;
  created_by: string;
  updated_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface OwnershipRole {
  id: string;
  legal_entity_id: string;
  party_id: string;
  ownership_position_id: string | null;
  role_type:
    | "shareholder"
    | "administrator"
    | "director"
    | "officer"
    | "beneficial_owner"
    | "legal_representative";
  ultimate_ownership_percentage: number | null;
  effective_from: string;
  effective_to: string | null;
  status: "active" | "ended" | "cancelled";
  evidence_document_id: string | null;
  notes: string | null;
  created_by: string;
  updated_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface GovernanceDocument {
  id: string;
  legal_entity_id: string;
  business_unit_id: string | null;
  asset_id: string | null;
  legal_matter_id: string | null;
  compliance_obligation_id: string | null;
  document_type: string;
  label: string;
  storage_provider: string;
  storage_bucket: string | null;
  storage_object_key: string | null;
  external_reference: string | null;
  checksum_sha256: string | null;
  valid_from: string | null;
  valid_until: string | null;
  status: "draft" | "active" | "expired" | "superseded" | "cancelled";
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CorporateResolution {
  id: string;
  legal_entity_id: string;
  code: string;
  resolution_type:
    | "shareholders_meeting"
    | "quotaholders_meeting"
    | "sole_shareholder_decision"
    | "board_resolution"
    | "management_decision"
    | "written_consent";
  title: string;
  summary: string | null;
  held_on: string;
  status: "draft" | "approved" | "applied" | "cancelled";
  evidence_document_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string;
  updated_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CapitalContribution {
  id: string;
  legal_entity_id: string;
  capital_structure_id: string;
  ownership_change_id: string;
  change_line_id: string;
  holder_party_id: string;
  share_class_id: string | null;
  amount: number;
  currency_code: string;
  contributed_on: string;
  contribution_type: "cash" | "asset" | "service" | "conversion" | "other";
  status: "confirmed" | "reversed";
  evidence_document_id: string;
  notes: string | null;
  reversed_by: string | null;
  reversed_at: string | null;
  reversal_reason: string | null;
  created_by: string;
  updated_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export type OwnershipChangeType =
  | "incorporation"
  | "quota_issue"
  | "quota_transfer"
  | "capital_increase"
  | "capital_reduction"
  | "capital_contribution"
  | "share_class_change"
  | "beneficial_owner_change"
  | "administration_change"
  | "correction"
  | "reversal";

export type OwnershipChangeStatus =
  "draft" | "submitted" | "approved" | "applied" | "rejected" | "reversed" | "cancelled";

export interface OwnershipChange {
  id: string;
  legal_entity_id: string;
  code: string;
  change_type: OwnershipChangeType;
  effective_on: string;
  status: OwnershipChangeStatus;
  source_capital_structure_id: string | null;
  resulting_capital_structure_id: string | null;
  resolution_id: string | null;
  evidence_document_id: string | null;
  justification: string;
  decision_reason: string | null;
  requested_by: string;
  approved_by: string | null;
  approved_at: string | null;
  applied_by: string | null;
  applied_at: string | null;
  reversed_by: string | null;
  reversed_at: string | null;
  reversal_reason: string | null;
  request_id: string | null;
  created_by: string;
  updated_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export type OwnershipOperationType =
  | "issue"
  | "transfer_out"
  | "transfer_in"
  | "cancel"
  | "increase"
  | "reduce"
  | "contribute"
  | "role_add"
  | "role_end"
  | "adjust";

export interface OwnershipChangeLine {
  id: string;
  change_id: string;
  sequence_no: number;
  operation_type: OwnershipOperationType;
  holder_party_id: string | null;
  counterparty_party_id: string | null;
  share_class_id: string | null;
  source_position_id: string | null;
  quota_delta: number;
  capital_delta: number;
  details: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

export interface CorporateOwnershipWorkspace {
  legalEntities: LegalEntityOption[];
  parties: PartyOption[];
  profiles: ProfileOption[];
  currencies: CurrencyOption[];
  capitalStructures: CapitalStructure[];
  shareClasses: ShareClass[];
  positions: OwnershipPosition[];
  roles: OwnershipRole[];
  documents: GovernanceDocument[];
  resolutions: CorporateResolution[];
  contributions: CapitalContribution[];
  changes: OwnershipChange[];
  changeLines: OwnershipChangeLine[];
}
