import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  join(process.cwd(), "src/modules/finance/accounting/accounting-page.tsx"),
  "utf8",
);
const topbar = readFileSync(join(process.cwd(), "src/app/navigation/topbar.tsx"), "utf8");

describe("accounting reconciliation UI", () => {
  it("renders the same DRE rows used for totals and keeps unclassified real postings visible", () => {
    expect(page).toContain("snapshot?.dreRows ?? []");
    expect(page).toContain('label: "Não classificado"');
    expect(page).toContain('type === "unclassified"');
    expect(page).toContain("summary.deductions + summary.totalExpense");
    expect(page).toContain("unclassifiedTotal");
  });

  it("wraps accounting actions before wide desktop to prevent global overflow", () => {
    expect(topbar).toContain("isAgenda || isAccounting");
    expect(topbar).toContain('"order-3 w-full flex-wrap xl:order-none xl:w-auto xl:flex-nowrap"');
  });
});
