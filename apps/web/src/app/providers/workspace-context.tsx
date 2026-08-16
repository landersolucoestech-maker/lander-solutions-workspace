import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type UnitFilter = string | "TODAS";

interface WorkspaceState {
  unit: UnitFilter;
  setUnit: (unit: UnitFilter) => void;
  period: string;
  setPeriod: (period: string) => void;
}

const WorkspaceContext = createContext<WorkspaceState | null>(null);

function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [unit, setUnit] = useState<UnitFilter>("TODAS");
  const [period, setPeriod] = useState(currentPeriod);

  const value = useMemo(() => ({ unit, setUnit, period, setPeriod }), [unit, period]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace deve ser usado dentro de WorkspaceProvider");
  return context;
}

export const matchesUnit = (unitFilter: UnitFilter, unit: string) =>
  unitFilter === "TODAS" || unitFilter === unit;
