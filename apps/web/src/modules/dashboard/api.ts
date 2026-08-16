import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AUTHENTICATION_ENABLED } from "@/config/authentication";
import { summarizePayoutObligations } from "@/modules/finance/payouts/payout-summary";
import type { PayoutObligation } from "@/modules/finance/payouts/types";
import { buildExecutiveResult } from "./dashboard-economics";
import type {
  DashboardData,
  DashboardFilters,
  DashboardMonthResult,
  DashboardRenewal,
  DashboardUnitResult,
} from "./types";

interface BusinessUnitRow {
  id: string;
  code: string;
  name: string;
  status: string;
}

type ExpenseReportingGroup =
  | "direct_cost"
  | "exclusive_expense"
  | "shared_expense"
  | "participation_expense"
  | "tax_expense"
  | "fee_expense";

interface AccountRow {
  id: string;
  code: string;
  account_type: string;
  normal_balance: "debit" | "credit";
  reporting_group: ExpenseReportingGroup | null;
}

interface JournalEntryRow {
  id: string;
  competence_date: string;
  status: string;
  source_type: string;
}

interface JournalLineRow {
  journal_entry_id: string;
  managerial_account_id: string;
  business_unit_id: string | null;
  debit_amount: number | string;
  credit_amount: number | string;
}

interface FinancialDocumentRow {
  id: string;
  business_unit_id: string | null;
  document_nature: "receivable" | "payable";
  competence_date: string;
  due_date: string;
  functional_amount: number | string;
  status: string;
}

interface SettlementRow {
  id: string;
  financial_document_id: string;
  settlement_date: string;
  functional_amount: number | string;
  status: string;
}

interface ContractRow {
  id: string;
  business_unit_id: string | null;
  code: string;
  title: string;
  currency_code: string;
  billing_frequency: string;
  base_amount: number | string;
  starts_on: string;
  ends_on: string | null;
  status: string;
}

interface UnitAccumulator {
  id: string;
  code: string;
  name: string;
  revenue: number;
  deductions: number;
  taxes: number;
  directExpenses: number;
  allocations: number;
  participations: number;
}

interface SummaryAccumulator {
  revenue: number;
  deductions: number;
  directCost: number;
  exclusiveExpense: number;
  sharedExpense: number;
  participationExpense: number;
  taxExpense: number;
  feeExpense: number;
}

async function selectRows<T>(table: string): Promise<T[]> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.from(table).select("*");
  if (error) {
    if (!AUTHENTICATION_ENABLED && error.code === "42501") return [];
    throw error;
  }
  return (data ?? []) as unknown as T[];
}

async function selectProtectedRows<T>(table: string): Promise<{ rows: T[]; available: boolean }> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.from(table).select("*");
  if (error) {
    if (!AUTHENTICATION_ENABLED && error.code === "42501") return { rows: [], available: false };
    throw error;
  }
  return { rows: (data ?? []) as unknown as T[], available: true };
}

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function monthKey(value: string) {
  return value.slice(0, 7);
}

function monthLabel(key: string) {
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(
    new Date(`${key}-01T12:00:00`),
  );
}

function periodEnd(period: string) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(year, month, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function recentMonths(period: string) {
  const [year, month] = period.split("-").map(Number);
  const base = new Date(year, month - 1, 1);
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(base.getFullYear(), base.getMonth() - (5 - index), 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}

function monthlyContractAmount(frequency: string, amount: number) {
  const normalized = frequency.toLowerCase();
  if (normalized === "monthly") return amount;
  if (normalized === "quarterly") return amount / 3;
  if (normalized === "semiannual" || normalized === "semi_annual") return amount / 6;
  if (normalized === "annual" || normalized === "yearly") return amount / 12;
  if (normalized === "weekly") return (amount * 52) / 12;
  return 0;
}

function isRecurringFrequency(frequency: string) {
  return monthlyContractAmount(frequency, 1) > 0;
}

export async function loadDashboardData(filters: DashboardFilters): Promise<DashboardData> {
  const [
    businessUnits,
    accounts,
    journalEntries,
    journalLines,
    financialDocuments,
    settlements,
    contracts,
    payoutObligations,
  ] = await Promise.all([
    selectRows<BusinessUnitRow>("business_units"),
    selectRows<AccountRow>("managerial_accounts"),
    selectRows<JournalEntryRow>("journal_entries"),
    selectRows<JournalLineRow>("journal_lines"),
    selectRows<FinancialDocumentRow>("financial_documents"),
    selectRows<SettlementRow>("financial_settlements"),
    selectRows<ContractRow>("contracts"),
    selectProtectedRows<PayoutObligation>("payout_obligations"),
  ]);

  const selectedPeriod = filters.period;
  const selectedPeriodStart = `${selectedPeriod}-01`;
  const selectedPeriodEnd = periodEnd(selectedPeriod);
  const activeUnits = businessUnits.filter((unit) => unit.status === "active");
  const selectedUnit = activeUnits.find((unit) => unit.code === filters.unitCode);
  const unitNames = new Map(activeUnits.map((unit) => [unit.id, unit.name]));
  const isCorporateFilter = filters.unitCode === "CORPORATIVO";
  const matchesScope = (businessUnitId: string | null) =>
    filters.unitCode === "TODAS" ||
    businessUnitId === selectedUnit?.id ||
    (isCorporateFilter && businessUnitId === null);

  const relevantUnits =
    filters.unitCode === "TODAS"
      ? activeUnits
      : activeUnits.filter((unit) => unit.id === selectedUnit?.id);
  const units = new Map<string, UnitAccumulator>();
  for (const unit of relevantUnits) {
    units.set(unit.id, {
      id: unit.id,
      code: unit.code,
      name: unit.name,
      revenue: 0,
      deductions: 0,
      taxes: 0,
      directExpenses: 0,
      allocations: 0,
      participations: 0,
    });
  }

  const corporateKey = "corporate-unassigned";
  const ensureUnit = (unitId: string | null) => {
    const key = unitId ?? corporateKey;
    const existing = units.get(key);
    if (existing) return existing;
    const created: UnitAccumulator = {
      id: key,
      code: unitId ? "DETALHES PROTEGIDOS" : "CORPORATIVO",
      name: unitId
        ? (unitNames.get(unitId) ?? "Unidade vinculada — detalhes protegidos")
        : "Corporativo geral",
      revenue: 0,
      deductions: 0,
      taxes: 0,
      directExpenses: 0,
      allocations: 0,
      participations: 0,
    };
    units.set(key, created);
    return created;
  };

  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const postedEntries = journalEntries.filter((entry) => entry.status === "posted");
  const postedEntryMap = new Map(postedEntries.map((entry) => [entry.id, entry]));
  const scopedPostedEntries = new Set<string>();
  const summary: SummaryAccumulator = {
    revenue: 0,
    deductions: 0,
    directCost: 0,
    exclusiveExpense: 0,
    sharedExpense: 0,
    participationExpense: 0,
    taxExpense: 0,
    feeExpense: 0,
  };

  const monthMap = new Map<string, DashboardMonthResult>();
  for (const key of recentMonths(selectedPeriod)) {
    monthMap.set(key, {
      month: monthLabel(key),
      monthKey: key,
      revenue: 0,
      expenses: 0,
      result: 0,
      cashIn: 0,
      cashOut: 0,
    });
  }

  for (const line of journalLines) {
    const entry = postedEntryMap.get(line.journal_entry_id);
    const account = accountMap.get(line.managerial_account_id);
    if (!entry || !account || !matchesScope(line.business_unit_id)) continue;

    const entryMonth = monthKey(entry.competence_date);
    const isSelectedPeriod = entryMonth === selectedPeriod;
    const debit = numeric(line.debit_amount);
    const credit = numeric(line.credit_amount);
    const amount = account.normal_balance === "credit" ? credit - debit : debit - credit;
    const month = monthMap.get(entryMonth);

    if (isSelectedPeriod) scopedPostedEntries.add(entry.id);

    if (account.account_type === "revenue") {
      if (isSelectedPeriod) {
        summary.revenue += amount;
        ensureUnit(line.business_unit_id).revenue += amount;
      }
      if (month) month.revenue += amount;
      continue;
    }

    if (account.account_type === "deduction") {
      if (isSelectedPeriod) {
        summary.deductions += amount;
        ensureUnit(line.business_unit_id).deductions += amount;
      }
      if (month) month.expenses += amount;
      continue;
    }

    if (account.account_type !== "expense") continue;

    if (isSelectedPeriod) {
      const expenseClass = account.reporting_group;
      if (!expenseClass) {
        throw new Error(`Conta de despesa ${account.code} sem grupo gerencial configurado.`);
      }
      const unit = ensureUnit(line.business_unit_id);
      const isAllocationPosting = entry.source_type === "allocation" && amount > 0;
      if (isAllocationPosting) unit.allocations += amount;
      else if (expenseClass === "tax_expense") unit.taxes += amount;
      else if (expenseClass === "participation_expense") unit.participations += amount;
      else unit.directExpenses += amount;
      if (expenseClass === "direct_cost") summary.directCost += amount;
      if (expenseClass === "shared_expense") summary.sharedExpense += amount;
      if (expenseClass === "participation_expense") summary.participationExpense += amount;
      if (expenseClass === "tax_expense") summary.taxExpense += amount;
      if (expenseClass === "fee_expense") summary.feeExpense += amount;
      if (expenseClass === "exclusive_expense") summary.exclusiveExpense += amount;
    }
    if (month) month.expenses += amount;
  }

  const scopedDocuments = financialDocuments.filter(
    (document) =>
      matchesScope(document.business_unit_id) && document.competence_date <= selectedPeriodEnd,
  );
  const documentMap = new Map(scopedDocuments.map((document) => [document.id, document]));
  const postedSettlements = settlements.filter(
    (settlement) =>
      settlement.status === "posted" &&
      settlement.settlement_date <= selectedPeriodEnd &&
      documentMap.has(settlement.financial_document_id),
  );
  const settledByDocument = new Map<string, number>();
  const scopedPostedSettlements = new Set<string>();
  for (const settlement of postedSettlements) {
    const amount = numeric(settlement.functional_amount);
    settledByDocument.set(
      settlement.financial_document_id,
      (settledByDocument.get(settlement.financial_document_id) ?? 0) + amount,
    );
    const document = documentMap.get(settlement.financial_document_id);
    const settlementMonth = monthKey(settlement.settlement_date);
    const month = monthMap.get(settlementMonth);
    if (settlementMonth === selectedPeriod) scopedPostedSettlements.add(settlement.id);
    if (!document || !month) continue;
    if (document.document_nature === "receivable") month.cashIn += amount;
    if (document.document_nature === "payable") month.cashOut += amount;
  }

  const receivables = { open: 0, overdue: 0, pendingApproval: 0 };
  const payables = { open: 0, overdue: 0, pendingApproval: 0 };
  const excludedDocumentStatuses = new Set(["draft", "rejected", "cancelled", "reversed"]);
  for (const document of scopedDocuments) {
    const target = document.document_nature === "receivable" ? receivables : payables;
    const amount = numeric(document.functional_amount);
    if (document.status === "pending_approval") target.pendingApproval += amount;
    if (excludedDocumentStatuses.has(document.status)) continue;
    const open = Math.max(0, amount - (settledByDocument.get(document.id) ?? 0));
    target.open += open;
    if (open > 0 && document.due_date < selectedPeriodEnd) target.overdue += open;
  }

  const activeContracts = contracts.filter(
    (contract) =>
      contract.status === "active" &&
      matchesScope(contract.business_unit_id) &&
      contract.starts_on <= selectedPeriodEnd &&
      (!contract.ends_on || contract.ends_on >= selectedPeriodStart),
  );
  const recurringContracts = activeContracts.filter((contract) =>
    isRecurringFrequency(contract.billing_frequency),
  );
  const recurring = {
    monthlyBrl: recurringContracts
      .filter((contract) => contract.currency_code === "BRL")
      .reduce(
        (total, contract) =>
          total + monthlyContractAmount(contract.billing_frequency, numeric(contract.base_amount)),
        0,
      ),
    activeContracts: recurringContracts.length,
    nonBrlContracts: recurringContracts.filter((contract) => contract.currency_code !== "BRL")
      .length,
  };

  const renewalLimit = new Date(`${selectedPeriodEnd}T12:00:00`);
  renewalLimit.setDate(renewalLimit.getDate() + 90);
  const renewalLimitKey = renewalLimit.toISOString().slice(0, 10);
  const renewals: DashboardRenewal[] = activeContracts
    .filter(
      (contract) =>
        contract.ends_on &&
        contract.ends_on >= selectedPeriodEnd &&
        contract.ends_on <= renewalLimitKey,
    )
    .sort((a, b) => String(a.ends_on).localeCompare(String(b.ends_on)))
    .slice(0, 10)
    .map((contract) => ({
      id: contract.id,
      code: contract.code,
      title: contract.title,
      endsOn: contract.ends_on ?? selectedPeriodEnd,
      status: contract.status,
      businessUnitName: contract.business_unit_id
        ? (unitNames.get(contract.business_unit_id) ?? "Unidade não identificada")
        : "Corporativo geral",
    }));

  const totalExpense =
    summary.directCost +
    summary.exclusiveExpense +
    summary.sharedExpense +
    summary.participationExpense +
    summary.taxExpense +
    summary.feeExpense;
  const operatingResult = summary.revenue - summary.deductions - totalExpense;
  const netRevenue = summary.revenue - summary.deductions;

  const unitResults: DashboardUnitResult[] = [...units.values()]
    .map((unit) => {
      const result = buildExecutiveResult({
        revenue: unit.revenue,
        deductions: unit.deductions,
        taxes: unit.taxes,
        directExpenses: unit.directExpenses,
        allocations: unit.allocations,
        participations: unit.participations,
      });
      const netUnitRevenue = unit.revenue - unit.deductions;
      return {
        ...unit,
        expenses: unit.taxes + unit.directExpenses + unit.allocations + unit.participations,
        result: result.finalResult,
        resultBeforeParticipations: result.resultBeforeParticipations,
        finalResult: result.finalResult,
        marginPercent: netUnitRevenue === 0 ? 0 : (result.finalResult / netUnitRevenue) * 100,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  const months = [...monthMap.values()].map((month) => ({
    ...month,
    result: month.revenue - month.expenses,
  }));

  const directOperatingExpense = summary.directCost + summary.exclusiveExpense + summary.feeExpense;
  const allocatedExpense = summary.sharedExpense;
  const executiveResult = buildExecutiveResult({
    revenue: summary.revenue,
    deductions: summary.deductions,
    taxes: summary.taxExpense,
    directExpenses: directOperatingExpense,
    allocations: allocatedExpense,
    participations: summary.participationExpense,
  });
  const payoutSummary = summarizePayoutObligations(
    payoutObligations.rows,
    new Date().toISOString().slice(0, 10),
  );
  const inScopeContracts = contracts.filter((contract) => matchesScope(contract.business_unit_id));
  const actionStatuses = new Set(["renewal", "pending", "pending_approval", "draft"]);

  return {
    summary: {
      ...summary,
      totalExpense,
      operatingResult,
      marginPercent: netRevenue === 0 ? 0 : (operatingResult / netRevenue) * 100,
      directOperatingExpense,
      allocatedExpense,
      resultBeforeParticipations: executiveResult.resultBeforeParticipations,
      finalResult: executiveResult.finalResult,
    },
    receivables,
    payables,
    recurring,
    units: unitResults,
    months,
    renewals,
    contracts: {
      active: inScopeContracts.filter((contract) => contract.status === "active").length,
      awaitingAction: inScopeContracts.filter((contract) => actionStatuses.has(contract.status))
        .length,
      endingSoon: renewals.length,
    },
    payouts: {
      available: AUTHENTICATION_ENABLED && payoutObligations.available,
      ...payoutSummary,
    },
    postedEntries: scopedPostedEntries.size,
    postedSettlements: scopedPostedSettlements.size,
  };
}
