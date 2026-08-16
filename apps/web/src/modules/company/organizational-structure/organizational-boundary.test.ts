import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Organizational structure ownership boundary", () => {
  it("uses organizational permissions for operational hierarchy", () => {
    const page = read(
      "src/modules/company/organizational-structure/organizational-structure-page.tsx",
    );
    expect(page).toContain('hasPermission("organizational_structure.read")');
    expect(page).toContain('hasPermission("organizational_structure.manage")');
    expect(page).not.toContain("corporate_ownership.");
  });

  it("does not consume corporate ownership ledgers", () => {
    const api = read("src/modules/company/organizational-structure/api.ts");
    for (const table of [
      "corporate_capital_structures",
      "corporate_share_classes",
      "corporate_ownership_positions",
      "corporate_ownership_roles",
      "corporate_ownership_changes",
    ]) {
      expect(api).not.toContain(table);
    }
  });

  it("keeps business units canonical and gives them a dedicated contextual route", () => {
    const unitsRoute = read("src/routes/unidades.tsx");
    const detailRoute = read("src/routes/unidades.$unitId.tsx");
    const page = read(
      "src/modules/company/organizational-structure/business-units/business-units-page.tsx",
    );
    const economics = read("src/modules/finance/reports/unit-economics-queries.ts");

    expect(unitsRoute).toContain("BusinessUnitsPage");
    expect(unitsRoute).not.toContain("redirect");
    expect(detailRoute).toContain('createFileRoute("/unidades/$unitId")');
    expect(page).toContain('queryKey: ["business-unit-directory"]');
    expect(economics).toContain('"business_units"');
    expect(economics).toContain("hasPayoutData ? payoutDue : participationExpenses");
    expect(economics).toContain("hasFinancialData");
  });

  it("prioritizes services and products without duplicating the units workspace", () => {
    const page = read(
      "src/modules/company/organizational-structure/organizational-structure-page.tsx",
    );

    expect(page).toContain('useState<OrganizationalEntityKind>("service_lines")');
    expect(page).toContain("Estrutura essencial");
    expect(page).toContain('to="/unidades"');
    expect(page).toContain("Cadastros financeiros e projetos vinculados");
    expect(page).not.toContain('kind: "business_units"');
  });
});
