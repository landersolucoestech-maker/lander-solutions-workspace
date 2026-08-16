import { describe, expect, it } from "vitest";

import { summarizeUnitLedger } from "./unit-economic-calculations";

describe("unit economic reconciliation", () => {
  it("reconciles revenue, direct cost, allocation and posted participation without double counting", () => {
    const accounts = [
      { id: "revenue", account_type: "revenue", reporting_group: null },
      { id: "direct", account_type: "expense", reporting_group: "direct_cost" },
      { id: "shared", account_type: "expense", reporting_group: "shared_expense" },
      {
        id: "participation",
        account_type: "expense",
        reporting_group: "participation_expense",
      },
    ];
    const entries = [
      { id: "operating", source_type: "document" },
      { id: "allocation", source_type: "allocation" },
      { id: "payout", source_type: "participation" },
    ];
    const lines = [
      ledgerLine("revenue", "operating", 22_000),
      ledgerLine("direct", "operating", 2_400),
      ledgerLine("shared", "operating", 3_200),
      ledgerLine("shared", "allocation", -3_200),
      ledgerLine("shared", "allocation", 3_200),
      ledgerLine("participation", "payout", 4_081.2),
    ];

    const summary = summarizeUnitLedger(lines, accounts, entries);

    expect(summary.revenue).toBe(22_000);
    expect(summary.directExpenses).toBe(2_400);
    expect(summary.allocatedExpenses).toBe(3_200);
    expect(summary.result).toBe(16_400);
    expect(summary.retainedAfterPostedParticipation).toBeCloseTo(12_318.8, 2);
    expect(summary.result).toBe(
      summary.revenue -
        summary.deductions -
        summary.taxes -
        summary.directExpenses -
        summary.allocatedExpenses,
    );
  });

  it("keeps a primary ledger line when its business-unit lookup is unavailable", () => {
    const summary = summarizeUnitLedger(
      [ledgerLine("revenue", "posted", 500)],
      [{ id: "revenue", account_type: "revenue", reporting_group: null }],
      [{ id: "posted", source_type: "document" }],
    );

    expect(summary.revenue).toBe(500);
    expect(summary.result).toBe(500);
  });
});

function ledgerLine(accountId: string, entryId: string, amount: number) {
  return {
    journal_line_id: `${entryId}:${accountId}:${amount}`,
    journal_entry_id: entryId,
    competence_date: "2026-08-01",
    managerial_account_id: accountId,
    business_unit_id: "unit-protected",
    signed_amount: amount,
  };
}
