import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("unit economic composition boundary", () => {
  const calculations = read("src/modules/finance/reports/unit-economic-calculations.ts");

  it("derives results from persisted owners without creating another result store", () => {
    const api = read("src/modules/finance/reports/unit-economics-queries.ts");
    for (const source of [
      "reporting_posted_ledger_lines",
      "managerial_accounts",
      "participation_calculations",
      "payout_obligations",
      "allocation_run_distributions",
      "contracts",
    ]) {
      expect(api).toContain(source);
    }
    expect(api).not.toMatch(/\.from\(["'](?:business_results|product_finance|unit_results)["']\)/);
  });

  it("does not subtract participation expense twice from the retained value", () => {
    const api = read("src/modules/finance/reports/unit-economics-queries.ts");
    expect(calculations).toContain('account.reporting_group !== "participation_expense"');
    expect(api).toContain("hasPayoutData ? payoutDue : participationExpenses");
  });

  it("identifies allocated cost from the posted workflow instead of an account heuristic", () => {
    const api = read("src/modules/finance/reports/unit-economics-queries.ts");
    expect(calculations).toContain('journalSourceMap.get(line.journal_entry_id) === "allocation"');
    expect(calculations).toContain("isAllocationPosting && amount > 0");
    expect(calculations).not.toContain('account.reporting_group === "shared_expense"');
  });

  it("renders unavailable financial data distinctly from a real zero", () => {
    const detail = read(
      "src/modules/company/organizational-structure/business-units/business-unit-detail-page.tsx",
    );
    const reports = read("src/modules/finance/reports/reports-page.tsx");
    expect(detail).toContain("Não disponível");
    expect(reports).toContain("Não disponível");
  });
});
