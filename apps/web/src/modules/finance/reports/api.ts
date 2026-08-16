import { loadDashboardData } from "@/modules/dashboard/api";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  AgingBucket,
  AgingDocumentRow,
  AgingSummary,
  CashMovementRow,
  ReportFilters,
  ReportSnapshot,
} from "./types";
import { loadUnitEconomicSnapshot } from "./unit-economics-queries";
import {
  buildDreRows,
  type ReportAccountRow,
  type ReportBusinessUnitRow,
  type ReportJournalEntryRow,
  type ReportJournalLineRow,
} from "./dre-builder";

interface ReportingCashRow {
  settlement_id: string;
  financial_document_id: string;
  settlement_date: string;
  functional_amount: number | string;
  bank_fee_functional: number | string;
  document_nature: "receivable" | "payable";
  document_number: string;
  description: string;
  business_unit_code: string | null;
  business_unit_name: string | null;
  party_legal_name: string | null;
  party_trade_name: string | null;
}

interface ReportingDocumentRow {
  id: string;
  document_nature: "receivable" | "payable";
  document_number: string;
  description: string;
  issue_date: string;
  competence_date: string;
  due_date: string;
  functional_amount: number | string;
  status: string;
  business_unit_code: string | null;
  business_unit_name: string | null;
  party_legal_name: string | null;
  party_trade_name: string | null;
  external_reference: string | null;
}

interface BaseFinancialDocumentRow {
  id: string;
  document_nature: "receivable" | "payable";
  document_number: string;
  description: string;
  issue_date: string;
  competence_date: string;
  due_date: string;
  functional_amount: number | string;
  status: string;
  business_unit_id: string | null;
  party_id: string | null;
  external_reference: string | null;
}

interface BaseSettlementRow {
  id: string;
  financial_document_id: string;
  settlement_date: string;
  functional_amount: number | string;
  bank_fee_functional: number | string;
  status: string;
}

interface ReportPartyRow {
  id: string;
  legal_name: string;
  trade_name: string | null;
}

async function selectRows<T>(table: string): Promise<T[]> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.from(table).select("*");
  if (error) throw error;
  return (data ?? []) as unknown as T[];
}

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function periodEnd(period: string) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(year, month, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function matchesScope(unitCode: string | null, filterCode: string) {
  if (filterCode === "TODAS") return true;
  if (filterCode === "CORPORATIVO") return unitCode === null || unitCode === "CORPORATIVO";
  return unitCode === filterCode;
}

function daysBetween(from: string, to: string) {
  const start = new Date(`${from}T12:00:00`).getTime();
  const end = new Date(`${to}T12:00:00`).getTime();
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

function agingBucket(dueDate: string, referenceDate: string): AgingBucket {
  if (dueDate >= referenceDate) return "not_due";
  const days = daysBetween(dueDate, referenceDate);
  if (days <= 30) return "days_1_30";
  if (days <= 60) return "days_31_60";
  if (days <= 90) return "days_61_90";
  return "over_90";
}

function summarizeAging(rows: AgingDocumentRow[]): AgingSummary {
  const summary: AgingSummary = {
    notDue: 0,
    days1To30: 0,
    days31To60: 0,
    days61To90: 0,
    over90: 0,
    total: 0,
  };

  for (const row of rows) {
    summary.total += row.openAmount;
    if (row.bucket === "not_due") summary.notDue += row.openAmount;
    if (row.bucket === "days_1_30") summary.days1To30 += row.openAmount;
    if (row.bucket === "days_31_60") summary.days31To60 += row.openAmount;
    if (row.bucket === "days_61_90") summary.days61To90 += row.openAmount;
    if (row.bucket === "over_90") summary.over90 += row.openAmount;
  }

  return summary;
}

export async function loadReportSnapshot(filters: ReportFilters): Promise<ReportSnapshot> {
  const [
    dashboard,
    businessUnits,
    accounts,
    journalEntries,
    journalLines,
    cashRows,
    documentRows,
    baseDocuments,
    baseSettlements,
    parties,
    unitEconomics,
  ] = await Promise.all([
    loadDashboardData(filters),
    selectRows<ReportBusinessUnitRow>("business_units"),
    selectRows<ReportAccountRow>("managerial_accounts"),
    selectRows<ReportJournalEntryRow>("journal_entries"),
    selectRows<ReportJournalLineRow>("journal_lines"),
    selectRows<ReportingCashRow>("reporting_posted_cash_movements"),
    selectRows<ReportingDocumentRow>("reporting_financial_documents"),
    selectRows<BaseFinancialDocumentRow>("financial_documents"),
    selectRows<BaseSettlementRow>("financial_settlements"),
    selectRows<ReportPartyRow>("parties"),
    loadUnitEconomicSnapshot(filters.period),
  ]);

  const unitMap = new Map(businessUnits.map((row) => [row.id, row]));
  const partyMap = new Map(parties.map((row) => [row.id, row]));
  const fallbackDocumentRows: ReportingDocumentRow[] = baseDocuments.map((row) => {
    const businessUnit = row.business_unit_id ? unitMap.get(row.business_unit_id) : undefined;
    const party = row.party_id ? partyMap.get(row.party_id) : undefined;
    return {
      id: row.id,
      document_nature: row.document_nature,
      document_number: row.document_number,
      description: row.description,
      issue_date: row.issue_date,
      competence_date: row.competence_date,
      due_date: row.due_date,
      functional_amount: row.functional_amount,
      status: row.status,
      business_unit_code: businessUnit?.code ?? null,
      business_unit_name: businessUnit?.name ?? null,
      party_legal_name: party?.legal_name ?? null,
      party_trade_name: party?.trade_name ?? null,
      external_reference: row.external_reference,
    };
  });
  const resolvedDocumentRows = documentRows.length > 0 ? documentRows : fallbackDocumentRows;
  const documentMap = new Map(resolvedDocumentRows.map((row) => [row.id, row]));
  const fallbackCashRows: ReportingCashRow[] = baseSettlements.flatMap((settlement) => {
    if (settlement.status !== "posted") return [];
    const document = documentMap.get(settlement.financial_document_id);
    if (!document) return [];
    return [
      {
        settlement_id: settlement.id,
        financial_document_id: settlement.financial_document_id,
        settlement_date: settlement.settlement_date,
        functional_amount: settlement.functional_amount,
        bank_fee_functional: settlement.bank_fee_functional,
        document_nature: document.document_nature,
        document_number: document.document_number,
        description: document.description,
        business_unit_code: document.business_unit_code,
        business_unit_name: document.business_unit_name,
        party_legal_name: document.party_legal_name,
        party_trade_name: document.party_trade_name,
      },
    ];
  });
  const resolvedCashRows = cashRows.length > 0 ? cashRows : fallbackCashRows;

  const selectedPeriod = filters.period;
  const selectedEnd = periodEnd(selectedPeriod);
  const dreRows = buildDreRows({
    filters,
    businessUnits,
    accounts,
    journalEntries,
    journalLines,
  });

  const scopedCashRows = resolvedCashRows.filter(
    (row) =>
      row.settlement_date <= selectedEnd && matchesScope(row.business_unit_code, filters.unitCode),
  );
  const settledByDocument = new Map<string, number>();
  for (const row of scopedCashRows) {
    settledByDocument.set(
      row.financial_document_id,
      (settledByDocument.get(row.financial_document_id) ?? 0) + numeric(row.functional_amount),
    );
  }

  const excludedStatuses = new Set(["draft", "rejected", "cancelled", "reversed"]);
  const openDocuments: AgingDocumentRow[] = [];
  for (const row of resolvedDocumentRows) {
    if (row.competence_date > selectedEnd) continue;
    if (!matchesScope(row.business_unit_code, filters.unitCode)) continue;
    if (excludedStatuses.has(row.status)) continue;

    const functionalAmount = numeric(row.functional_amount);
    const settledAmount = settledByDocument.get(row.id) ?? 0;
    const openAmount = Math.max(0, functionalAmount - settledAmount);
    if (openAmount <= 0) continue;

    const bucket = agingBucket(row.due_date, selectedEnd);
    openDocuments.push({
      id: row.id,
      nature: row.document_nature,
      documentNumber: row.document_number,
      description: row.description,
      partyName: row.party_trade_name || row.party_legal_name || "Sem contraparte identificada",
      unitCode: row.business_unit_code ?? "CORPORATIVO",
      unitName: row.business_unit_name ?? "Corporativo geral",
      issueDate: row.issue_date,
      competenceDate: row.competence_date,
      dueDate: row.due_date,
      status: row.status,
      functionalAmount,
      settledAmount,
      openAmount,
      daysOverdue: bucket === "not_due" ? 0 : daysBetween(row.due_date, selectedEnd),
      bucket,
      externalReference: row.external_reference ?? "",
    });
  }

  openDocuments.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const receivableRows = openDocuments.filter((row) => row.nature === "receivable");
  const payableRows = openDocuments.filter((row) => row.nature === "payable");

  const cashMovements: CashMovementRow[] = resolvedCashRows
    .filter(
      (row) =>
        row.settlement_date.slice(0, 7) === selectedPeriod &&
        matchesScope(row.business_unit_code, filters.unitCode),
    )
    .map((row) => ({
      settlementId: row.settlement_id,
      documentNumber: row.document_number,
      description: row.description,
      partyName: row.party_trade_name || row.party_legal_name || "Sem contraparte identificada",
      unitCode: row.business_unit_code ?? "CORPORATIVO",
      settlementDate: row.settlement_date,
      nature: row.document_nature,
      amount: numeric(row.functional_amount),
      bankFee: numeric(row.bank_fee_functional),
    }))
    .sort((a, b) => a.settlementDate.localeCompare(b.settlementDate));

  return {
    filters,
    generatedAt: new Date().toISOString(),
    dashboard,
    dreRows,
    receivableRows,
    payableRows,
    receivableAging: summarizeAging(receivableRows),
    payableAging: summarizeAging(payableRows),
    cashMovements,
    unitEconomics,
  };
}
