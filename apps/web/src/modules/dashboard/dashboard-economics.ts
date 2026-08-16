export interface ExecutiveExpenseSummary {
  revenue: number;
  deductions: number;
  taxes: number;
  directExpenses: number;
  allocations: number;
  participations: number;
}

export function buildExecutiveResult(summary: ExecutiveExpenseSummary) {
  const resultBeforeParticipations =
    summary.revenue -
    summary.deductions -
    summary.taxes -
    summary.directExpenses -
    summary.allocations;
  const finalResult = resultBeforeParticipations - summary.participations;
  const netRevenue = summary.revenue - summary.deductions;

  return {
    ...summary,
    resultBeforeParticipations,
    finalResult,
    marginPercent: netRevenue === 0 ? 0 : (finalResult / netRevenue) * 100,
  };
}
