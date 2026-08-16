import { createServerFn } from "@tanstack/react-start";

import { loadDashboardData } from "./api";
import type { DashboardFilters } from "./types";

function validateDashboardFilters(data: unknown): DashboardFilters {
  if (!data || typeof data !== "object") {
    throw new Error("Filtros do dashboard inválidos.");
  }

  const filters = data as Record<string, unknown>;
  if (typeof filters.unitCode !== "string" || typeof filters.period !== "string") {
    throw new Error("Filtros do dashboard incompletos.");
  }

  if (!/^\d{4}-\d{2}$/.test(filters.period)) {
    throw new Error("Competência do dashboard inválida.");
  }

  return {
    unitCode: filters.unitCode,
    period: filters.period,
  };
}

export const getDashboardData = createServerFn({ method: "GET" })
  .validator(validateDashboardFilters)
  .handler(async ({ data }) => loadDashboardData(data));
