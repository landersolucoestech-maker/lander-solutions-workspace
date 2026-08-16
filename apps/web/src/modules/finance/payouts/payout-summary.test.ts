import { describe, expect, it } from "vitest";
import { summarizePayoutObligations } from "./payout-summary";
import type { PayoutObligation } from "./types";

function obligation(values: Partial<PayoutObligation>): PayoutObligation {
  return {
    id: "obligation",
    participation_calculation_id: "calculation",
    participation_calculation_line_id: "line",
    legal_entity_id: "entity",
    business_unit_id: "unit",
    contract_id: "contract",
    contract_version_id: "version",
    beneficiary_party_id: "party",
    currency_code: "BRL",
    amount: 0,
    paid_amount: 0,
    due_date: "2026-08-01",
    status: "open",
    financial_document_id: null,
    posted_at: "2026-08-01",
    created_by: "user",
    updated_by: null,
    version: 1,
    created_at: "2026-08-01",
    updated_at: "2026-08-01",
    ...values,
  };
}

describe("summarizePayoutObligations", () => {
  it("reconciles due, paid, pending and overdue obligations", () => {
    const summary = summarizePayoutObligations(
      [
        obligation({ amount: 1_000, paid_amount: 400, due_date: "2026-07-31" }),
        obligation({ id: "paid", amount: 500, paid_amount: 500, status: "paid" }),
        obligation({ id: "cancelled", amount: 9_000, status: "cancelled" }),
      ],
      "2026-08-14",
    );
    expect(summary).toEqual({ due: 1_500, paid: 900, pending: 600, overdue: 600 });
    expect(summary.paid + summary.pending).toBe(summary.due);
  });
});
