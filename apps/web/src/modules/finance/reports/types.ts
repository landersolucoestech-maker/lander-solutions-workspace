import type { DashboardData, DashboardFilters } from "@/modules/dashboard/types";
import type { UnitEconomicSnapshot } from "./unit-economics-queries";

export type ReportFilters = DashboardFilters;

export interface DreReportRow {
  accountCode: string;
  accountName: string;
  accountType: string;
  amount: number;
}

export type AgingBucket = "not_due" | "days_1_30" | "days_31_60" | "days_61_90" | "over_90";

export interface AgingDocumentRow {
  id: string;
  nature: "receivable" | "payable";
  documentNumber: string;
  description: string;
  partyName: string;
  unitCode: string;
  unitName: string;
  issueDate: string;
  competenceDate: string;
  dueDate: string;
  status: string;
  functionalAmount: number;
  settledAmount: number;
  openAmount: number;
  daysOverdue: number;
  bucket: AgingBucket;
  externalReference: string;
}

export interface AgingSummary {
  notDue: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  over90: number;
  total: number;
}

export interface CashMovementRow {
  settlementId: string;
  documentNumber: string;
  description: string;
  partyName: string;
  unitCode: string;
  settlementDate: string;
  nature: "receivable" | "payable";
  amount: number;
  bankFee: number;
}

export interface ReportSnapshot {
  filters: ReportFilters;
  generatedAt: string;
  dashboard: DashboardData;
  dreRows: DreReportRow[];
  receivableRows: AgingDocumentRow[];
  payableRows: AgingDocumentRow[];
  receivableAging: AgingSummary;
  payableAging: AgingSummary;
  cashMovements: CashMovementRow[];
  unitEconomics: UnitEconomicSnapshot;
}
