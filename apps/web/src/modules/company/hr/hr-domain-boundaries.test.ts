import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("HR domain boundaries", () => {
  it("keeps equipment mutations exclusively in Assets", () => {
    const api = read("src/modules/company/hr/api.ts");
    const dialogs = read("src/modules/company/hr/hr-action-dialogs.tsx");
    const sections = read("src/modules/company/hr/hr-sections.tsx");
    const types = read("src/modules/company/hr/types.ts");

    for (const forbidden of [
      "admin-assets",
      "invokeAdminAssets",
      "hr.equipment.manage",
      "manageEquipment",
      "createEquipment",
      "assignEquipment",
      "returnEquipment",
      'kind: "create-equipment"',
      'kind: "assign-equipment"',
      'kind: "return-equipment"',
    ]) {
      expect(`${api}
${dialogs}
${types}`).not.toContain(forbidden);
    }

    expect(sections).toContain("administrados exclusivamente em Patrimônio e Licenças");
    expect(sections).not.toContain('kind: "create-equipment"');
    expect(sections).not.toContain('kind: "assign-equipment"');
    expect(sections).not.toContain('kind: "return-equipment"');
  });

  it("keeps position mutations exclusively in Organizational Structure", () => {
    const api = read("src/modules/company/hr/api.ts");
    const dialogs = read("src/modules/company/hr/hr-action-dialogs.tsx");
    const sections = read("src/modules/company/hr/hr-sections.tsx");
    const admin = read("../../supabase/functions/admin-hr/index.ts");

    expect(api).not.toContain("createPosition");
    expect(dialogs).not.toContain('kind: "create-position"');
    expect(admin).not.toContain('case "create-position"');
    expect(admin).not.toContain('case "update-position"');
    expect(sections).toContain("exclusivamente em Estrutura Organizacional");
  });
});
