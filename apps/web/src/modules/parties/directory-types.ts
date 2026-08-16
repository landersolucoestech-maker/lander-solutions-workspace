import type { Party } from "./types";

export type { Party, PartyStatus, PartyType } from "./types";

export interface PartyRole {
  id: string;
  party_id: string;
  role_code:
    | "client"
    | "supplier"
    | "partner"
    | "service_provider"
    | "participant"
    | "investor"
    | "carrier"
    | "international_client"
    | "technology_client"
    | "education_client"
    | "services_client";
  business_unit_id: string | null;
  status: "active" | "inactive" | "revoked";
  started_on: string | null;
  ended_on: string | null;
  notes: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface PartyContact {
  id: string;
  party_id: string;
  contact_type: "email" | "phone" | "mobile" | "website" | "other";
  label: string | null;
  value: string;
  normalized_value: string;
  is_primary: boolean;
  status: "active" | "inactive";
  version: number;
  created_at: string;
  updated_at: string;
}

export interface PartyAddress {
  id: string;
  party_id: string;
  address_type: "legal" | "billing" | "service" | "residential" | "other";
  label: string | null;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state_region: string | null;
  postal_code: string | null;
  country_code: string;
  is_primary: boolean;
  status: "active" | "inactive";
  version: number;
  created_at: string;
  updated_at: string;
}

export interface PartyRelationship {
  id: string;
  organization_party_id: string;
  person_party_id: string;
  relationship_type: "contact" | "representative" | "employee" | "owner" | "partner" | "other";
  title: string | null;
  is_primary: boolean;
  status: "active" | "inactive" | "ended";
  started_on: string | null;
  ended_on: string | null;
  notes: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface PartyDocument {
  id: string;
  party_id: string;
  document_type: string;
  label: string | null;
  reference_number_masked: string | null;
  issued_on: string | null;
  expires_on: string | null;
  storage_provider: "none" | "r2" | "supabase" | "external";
  storage_bucket: string | null;
  storage_object_key: string | null;
  external_reference: string | null;
  status: "pending" | "uploaded" | "verified" | "expired" | "rejected" | "inactive";
  verified_at: string | null;
  verified_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface RestrictedReference {
  id: string;
  party_id: string;
  reference_type:
    "bank_account" | "payment_method" | "tax_document" | "identity_document" | "other";
  label: string;
  masked_value: string | null;
  vault_reference: string;
  status: "active" | "inactive" | "revoked";
  version: number;
  created_at: string;
  updated_at: string;
}

export interface PartiesData {
  parties: Party[];
  roles: PartyRole[];
  contacts: PartyContact[];
  addresses: PartyAddress[];
  relationships: PartyRelationship[];
  documents: PartyDocument[];
}
