import { describe, expect, it } from "vitest";
import { buildExecutiveResult } from "./dashboard-economics";

describe("buildExecutiveResult", () => {
  it("reconciles the executive sequence without changing financial semantics", () => {
    const result = buildExecutiveResult({
      revenue: 22_000,
      deductions: 0,
      taxes: 0,
      directExpenses: 2_400,
      allocations: 3_200,
      participations: 4_081.2,
    });
    expect(result.resultBeforeParticipations).toBeCloseTo(16_400);
    expect(result.finalResult).toBeCloseTo(12_318.8);
    expect(result.marginPercent).toBeCloseTo(55.9945, 3);
  });

  it("keeps the margin finite when there is no net revenue", () => {
    expect(
      buildExecutiveResult({
        revenue: 0,
        deductions: 0,
        taxes: 0,
        directExpenses: 0,
        allocations: 0,
        participations: 0,
      }).marginPercent,
    ).toBe(0);
  });
});
