export interface DashboardFilters {
  unitCode: string;
  period: string;
}

export interface DashboardUnitResult {
  id: string;
  code: string;
  name: string;
  revenue: number;
  deductions: number;
  taxes: number;
  directExpenses: number;
  allocations: number;
  participations: number;
  expenses: number;
  result: number;
  resultBeforeParticipations: number;
  finalResult: number;
  marginPercent: number;
}

export interface DashboardMonthResult {
  month: string;
  monthKey: string;
  revenue: number;
  expenses: number;
  result: number;
  cashIn: number;
  cashOut: number;
}

export interface DashboardRenewal {
  id: string;
  code: string;
  title: string;
  endsOn: string;
  status: string;
  businessUnitName: string;
}

export interface DashboardData {
  summary: {
    revenue: number;
    deductions: number;
    directCost: number;
    exclusiveExpense: number;
    sharedExpense: number;
    participationExpense: number;
    taxExpense: number;
    feeExpense: number;
    totalExpense: number;
    operatingResult: number;
    marginPercent: number;
    directOperatingExpense: number;
    allocatedExpense: number;
    resultBeforeParticipations: number;
    finalResult: number;
  };
  receivables: {
    open: number;
    overdue: number;
    pendingApproval: number;
  };
  payables: {
    open: number;
    overdue: number;
    pendingApproval: number;
  };
  recurring: {
    monthlyBrl: number;
    activeContracts: number;
    nonBrlContracts: number;
  };
  units: DashboardUnitResult[];
  months: DashboardMonthResult[];
  renewals: DashboardRenewal[];
  contracts: {
    active: number;
    awaitingAction: number;
    endingSoon: number;
  };
  payouts: {
    available: boolean;
    due: number;
    paid: number;
    pending: number;
    overdue: number;
  };
  postedEntries: number;
  postedSettlements: number;
}
