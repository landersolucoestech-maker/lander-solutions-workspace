import type { FinancialSettlement } from "./types";

export function transactionKind(expense: number, revenue: number): "Receita" | "Despesa" {
  return revenue > 0 && expense === 0 ? "Receita" : "Despesa";
}

export function settlementSummary(documentAmount: number, settlements: FinancialSettlement[]) {
  const postedAmount = settlements.reduce(
    (total, settlement) =>
      settlement.status === "posted" ? total + Number(settlement.functional_amount) : total,
    0,
  );

  return {
    hasSettlements: settlements.length > 0,
    postedAmount,
    remainingAmount: Math.max(0, documentAmount - postedAmount),
  };
}
