import type { AssetCategory, AssetType } from "./asset-classification";

export interface CorporateAsset {
  id: string;
  legal_entity_id: string;
  business_unit_id: string | null;
  product_id: string | null;
  service_line_id: string | null;
  project_id: string | null;
  supplier_party_id: string | null;
  contract_id: string | null;
  acquisition_document_id: string | null;
  custodian_user_id: string | null;
  code: string;
  name: string;
  description: string | null;
  asset_category: AssetCategory;
  asset_type: AssetType;
  asset_tag: string | null;
  serial_number: string | null;
  quantity: number;
  currency_code: string;
  acquisition_cost: number;
  current_value: number;
  depreciation_method: string;
  useful_life_months: number | null;
  acquired_on: string | null;
  in_service_on: string | null;
  warranty_until: string | null;
  renewal_date: string | null;
  expires_on: string | null;
  status: string;
  storage_location: string | null;
  external_reference: string | null;
  storage_provider: string;
  storage_bucket: string | null;
  storage_object_key: string | null;
  checksum_sha256: string | null;
  notes: string | null;
  version: number;
}

export interface AssetEvent {
  id: string;
  asset_id: string;
  event_type: string;
  occurred_on: string;
  from_business_unit_id: string | null;
  to_business_unit_id: string | null;
  from_custodian_user_id: string | null;
  to_custodian_user_id: string | null;
  from_location: string | null;
  to_location: string | null;
  financial_document_id: string | null;
  currency_code: string | null;
  amount: number | null;
  reason: string;
  evidence_reference: string | null;
  status: string;
  requested_by: string | null;
  approved_by: string | null;
  decision_reason: string | null;
  applied_by: string | null;
  version: number;
}

/** Minimal reference shape required by Assets forms; ownership remains in the source domain. */
export interface AssetReferenceOption {
  id: string;
  name: string;
  code?: string;
  status?: string;
  type?: string;
  business_unit_id?: string | null;
  legal_entity_id?: string;
}

export interface AssetsWorkspace {
  assets: CorporateAsset[];
  assetEvents: AssetEvent[];
  legalEntities: AssetReferenceOption[];
  businessUnits: AssetReferenceOption[];
  products: AssetReferenceOption[];
  serviceLines: AssetReferenceOption[];
  projects: AssetReferenceOption[];
  parties: AssetReferenceOption[];
  contracts: AssetReferenceOption[];
  financialDocuments: AssetReferenceOption[];
  profiles: AssetReferenceOption[];
  currencies: AssetReferenceOption[];
}
