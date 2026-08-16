export type IntegrationEnvironment = "development" | "staging" | "production";
export type IntegrationStatus = "draft" | "active" | "inactive" | "error";

export interface IntegrationConnection {
  id: string;
  business_unit_id: string | null;
  source_system: string;
  information_type: string;
  endpoint_url: string | null;
  environment: IntegrationEnvironment;
  status: IntegrationStatus;
  last_sync_at: string | null;
  last_failure_at: string | null;
  last_failure_message: string | null;
  technical_owner_user_id: string | null;
  secret_reference: string | null;
  summary_log: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface IntegrationOption {
  id: string;
  code?: string;
  name: string;
}

export interface IntegrationDirectory {
  connections: IntegrationConnection[];
  businessUnits: IntegrationOption[];
  technicalOwners: IntegrationOption[];
  canManage: boolean;
}

export interface IntegrationFormInput {
  businessUnitId: string | null;
  sourceSystem: string;
  informationType: string;
  endpointUrl: string | null;
  environment: IntegrationEnvironment;
  status: IntegrationStatus;
  lastSyncAt: string | null;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
  technicalOwnerUserId: string | null;
  secretReference: string | null;
  summaryLog: string | null;
}
