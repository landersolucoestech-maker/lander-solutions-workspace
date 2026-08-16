import { describe, expect, it } from "vitest";
import type { CrmLead } from "./types";
import { buildLeadViewRelationships } from "./lead-view-model";

describe("lead view model", () => {
  it("keeps an existing lead visible when business units and protected lookups are empty", () => {
    const lead = {
      id: "lead-aurora",
      company_name: "Aurora Eventos",
      contact_name: "Aurora Eventos",
      business_unit_id: "protected-unit",
      owner_user_id: "protected-owner",
      converted_party_id: null,
    } as CrmLead;

    const relationships = buildLeadViewRelationships(lead, {
      businessUnits: [],
      profiles: [],
      parties: [],
    });

    expect(lead.company_name).toBe("Aurora Eventos");
    expect(relationships).toEqual({
      unitName: "Não disponível",
      ownerName: "Não disponível",
      relatedPartyName: "Não disponível",
    });
  });
});
