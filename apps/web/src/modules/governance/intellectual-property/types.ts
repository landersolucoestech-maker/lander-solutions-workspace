export interface IntellectualPropertyAsset {
  id: string;
  legal_entity_id: string;
  business_unit_id: string | null;
  product_id: string | null;
  service_line_id: string | null;
  creator_party_id: string | null;
  responsible_user_id: string | null;
  code: string;
  title: string;
  description: string | null;
  ip_type: string;
  jurisdiction: string | null;
  authority: string | null;
  application_number: string | null;
  registration_number: string | null;
  classification_codes: string[];
  filing_date: string | null;
  registration_date: string | null;
  expires_on: string | null;
  renewal_due_on: string | null;
  status: string;
  storage_provider: string;
  storage_bucket: string | null;
  storage_object_key: string | null;
  checksum_sha256: string | null;
  notes: string | null;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface IntellectualPropertyEvent {
  id: string;
  intellectual_property_id: string;
  sequence_no: number;
  event_type: string;
  event_status: string;
  occurred_on: string | null;
  due_date: string | null;
  protocol: string | null;
  authority: string | null;
  reason: string | null;
  evidence_reference: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface IpNamedOption {
  id: string;
  code?: string;
  name: string;
  legal_entity_id?: string;
  business_unit_id?: string;
  status?: string;
}

export interface IpPartyOption {
  id: string;
  legal_name: string;
  trade_name: string | null;
  status: string;
}

export interface IpProfileOption {
  id: string;
  display_name: string;
  email: string | null;
  status: string;
}

export interface IntellectualPropertyWorkspace {
  assets: IntellectualPropertyAsset[];
  events: IntellectualPropertyEvent[];
  legalEntities: Array<{ id: string; code: string; name: string; status: string }>;
  businessUnits: IpNamedOption[];
  products: IpNamedOption[];
  serviceLines: IpNamedOption[];
  parties: IpPartyOption[];
  profiles: IpProfileOption[];
}
