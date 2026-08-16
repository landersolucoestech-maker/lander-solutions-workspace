export type PartyType = "organization" | "person";
export type PartyStatus = "prospect" | "active" | "inactive" | "blocked" | "under_review";

export interface Party {
  id: string;
  party_type: PartyType;
  legal_name: string;
  trade_name: string | null;
  tax_id: string | null;
  country_code: string;
  preferred_currency_code: string;
  language_code: string;
  primary_business_unit_id: string | null;
  status: PartyStatus;
  category: "client" | "supplier" | "partner" | "service_provider" | "collaborator" | "other";
  internal_owner_user_id: string | null;
  registration_source: string | null;
  tags: string[];
  created_by: string | null;
  updated_by: string | null;
  notes: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export type PartyLookup = Pick<Party, "id" | "legal_name" | "trade_name" | "status">;
