import type { CrmDirectory, CrmLead } from "./types";

const unavailable = "Não disponível";

export interface LeadViewRelationships {
  unitName: string;
  ownerName: string;
  relatedPartyName: string;
}

export function buildLeadViewRelationships(
  lead: CrmLead,
  directory: Pick<CrmDirectory, "businessUnits" | "profiles" | "parties">,
): LeadViewRelationships {
  return {
    unitName:
      directory.businessUnits.find((item) => item.id === lead.business_unit_id)?.name ??
      unavailable,
    ownerName:
      directory.profiles.find((item) => item.id === lead.owner_user_id)?.name ?? unavailable,
    relatedPartyName:
      directory.parties.find((item) => item.id === lead.converted_party_id)?.name ?? unavailable,
  };
}
