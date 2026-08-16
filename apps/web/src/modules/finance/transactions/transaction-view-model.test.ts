import { describe, expect, it } from "vitest";

import type { FinancialSettlement } from "./types";
import { settlementSummary, transactionKind } from "./transaction-view-model";

const settlement = (overrides: Partial<FinancialSettlement> = {}): FinancialSettlement => ({
  id: "10000000-0000-4000-8000-000000000001",
  financial_document_id: "20000000-0000-4000-8000-000000000001",
  cash_account_id: "30000000-0000-4000-8000-000000000001",
  settlement_date: "2026-08-07",
  original_currency_code: "BRL",
  original_amount: 3200,
  fx_rate: 1,
  functional_amount: 3200,
  bank_fee_functional: 0,
  fee_account_id: null,
  status: "posted",
  requested_by: null,
  requested_at: null,
  posted_by: null,
  posted_at: "2026-08-07T12:00:00Z",
  journal_entry_id: null,
  external_reference: null,
  notes: null,
  version: 1,
  created_at: "2026-08-07T12:00:00Z",
  updated_at: "2026-08-07T12:00:00Z",
  ...overrides,
});

describe("transaction view model", () => {
  it("classifies real inflows and outflows for the view header", () => {
    expect(transactionKind(0, 4000)).toBe("Receita");
    expect(transactionKind(3200, 0)).toBe("Despesa");
  });

  it("summarizes posted settlements and the remaining balance", () => {
    expect(settlementSummary(5000, [settlement()])).toEqual({
      hasSettlements: true,
      postedAmount: 3200,
      remainingAmount: 1800,
    });
  });

  it("does not present an absent settlement as a payment", () => {
    expect(settlementSummary(5000, [])).toEqual({
      hasSettlements: false,
      postedAmount: 0,
      remainingAmount: 5000,
    });
  });
});
