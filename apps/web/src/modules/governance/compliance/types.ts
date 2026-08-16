export interface DirectoryOption {
  id: string;
  name: string;
  code?: string;
  status?: string;
  business_unit_id?: string | null;
  legal_entity_id?: string | null;
}

export interface ComplianceObligation {
  id: string;
  legal_entity_id: string;
  business_unit_id: string | null;
  product_id: string | null;
  service_line_id: string | null;
  project_id: string | null;
  contract_id: string | null;
  intellectual_property_asset_id: string | null;
  responsible_user_id: string | null;
  code: string;
  title: string;
  description: string;
  category: string;
  authority: string | null;
  legal_basis: string | null;
  frequency: string;
  due_rule: string | null;
  first_due_date: string | null;
  next_due_date: string | null;
  risk_level: string;
  evidence_required: boolean;
  remediation_plan: string | null;
  notes: string | null;
  status: string;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ComplianceOccurrence {
  id: string;
  compliance_obligation_id: string;
  reference_start: string | null;
  reference_end: string | null;
  due_date: string;
  status: string;
  responsible_user_id: string | null;
  evidence_reference: string | null;
  notes: string | null;
  waiver_reason: string | null;
  completed_at: string | null;
  completed_by: string | null;
  waived_at: string | null;
  waived_by: string | null;
  created_by: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CorporatePolicy {
  id: string;
  legal_entity_id: string;
  business_unit_id: string | null;
  owner_user_id: string | null;
  code: string;
  title: string;
  policy_type: string;
  description: string | null;
  status: string;
  current_version_id: string | null;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CorporatePolicyVersion {
  id: string;
  policy_id: string;
  version_number: number;
  effective_from: string;
  effective_to: string | null;
  change_summary: string;
  storage_provider: string;
  storage_bucket: string | null;
  storage_object_key: string;
  checksum_sha256: string;
  status: string;
  requested_by: string | null;
  approved_by: string | null;
  published_by: string | null;
  decision_reason: string | null;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ComplianceDirectory {
  obligations: ComplianceObligation[];
  occurrences: ComplianceOccurrence[];
  policies: CorporatePolicy[];
  policyVersions: CorporatePolicyVersion[];
  legalEntities: DirectoryOption[];
  businessUnits: DirectoryOption[];
  products: DirectoryOption[];
  projects: DirectoryOption[];
  profiles: DirectoryOption[];
  intellectualPropertyAssets: DirectoryOption[];
}
