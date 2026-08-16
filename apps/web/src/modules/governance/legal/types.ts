export interface LegalMatter {
  id: string;
  legal_entity_id: string;
  business_unit_id: string | null;
  product_id: string | null;
  service_line_id: string | null;
  project_id: string | null;
  contract_id: string | null;
  counterparty_id: string | null;
  external_counsel_party_id: string | null;
  responsible_user_id: string | null;
  code: string;
  title: string;
  description: string | null;
  matter_type: string;
  jurisdiction: string | null;
  authority: string | null;
  case_number: string | null;
  status: string;
  risk_level: string;
  probability: number;
  exposure_currency_code: string;
  exposure_amount: number;
  opened_on: string;
  due_date: string | null;
  closed_on: string | null;
  outcome: string | null;
  storage_provider: string;
  storage_bucket: string | null;
  storage_object_key: string | null;
  notes: string | null;
  version: number;
}

export interface LegalMatterEvent {
  id: string;
  legal_matter_id: string;
  sequence_no: number;
  event_type: string;
  title: string;
  description: string | null;
  occurred_at: string | null;
  due_at: string | null;
  status: string;
  responsible_user_id: string | null;
  evidence_reference: string | null;
  outcome: string | null;
  version: number;
}

export interface LegalMatterIntellectualPropertyLink {
  legal_matter_id: string;
  intellectual_property_asset_id: string;
  relationship_type: string;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface LegalReferenceOption {
  id: string;
  name: string;
  code?: string;
  status?: string;
  type?: string;
  business_unit_id?: string | null;
  legal_entity_id?: string;
}

export interface IntellectualPropertyReference {
  id: string;
  code: string;
  title: string;
  status: string;
}

export interface LegalWorkspace {
  legalMatters: LegalMatter[];
  legalEvents: LegalMatterEvent[];
  intellectualPropertyLinks: LegalMatterIntellectualPropertyLink[];
  intellectualPropertyReferences: IntellectualPropertyReference[];
  legalEntities: LegalReferenceOption[];
  businessUnits: LegalReferenceOption[];
  projects: LegalReferenceOption[];
  parties: LegalReferenceOption[];
  contracts: LegalReferenceOption[];
  profiles: LegalReferenceOption[];
  currencies: LegalReferenceOption[];
}
