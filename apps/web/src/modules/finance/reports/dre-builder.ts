import type { DreReportRow, ReportFilters } from "./types";

export interface ReportBusinessUnitRow {
  id: string;
  code: string;
  name?: string;
}

export interface ReportAccountRow {
  id: string;
  code: string;
  name: string;
  account_type: string | null;
  normal_balance: "debit" | "credit";
}

export interface ReportJournalEntryRow {
  id: string;
  competence_date: string;
  status: string;
}

export interface ReportJournalLineRow {
  journal_entry_id: string;
  managerial_account_id: string;
  business_unit_id: string | null;
  debit_amount: number | string;
  credit_amount: number | string;
}

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function matchesScope(unitCode: string | null, filterCode: string) {
  if (filterCode === "TODAS") return true;
  if (filterCode === "CORPORATIVO") return unitCode === null || unitCode === "CORPORATIVO";
  return unitCode === filterCode;
}

export function buildDreRows({
  filters,
  businessUnits,
  accounts,
  journalEntries,
  journalLines,
}: {
  filters: ReportFilters;
  businessUnits: ReportBusinessUnitRow[];
  accounts: ReportAccountRow[];
  journalEntries: ReportJournalEntryRow[];
  journalLines: ReportJournalLineRow[];
}): DreReportRow[] {
  const unitCodeById = new Map(businessUnits.map((unit) => [unit.id, unit.code]));
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const postedEntryIds = new Set(
    journalEntries
      .filter(
        (entry) =>
          entry.status === "posted" && entry.competence_date.slice(0, 7) === filters.period,
      )
      .map((entry) => entry.id),
  );
  const totals = new Map<string, DreReportRow>();

  for (const line of journalLines) {
    if (!postedEntryIds.has(line.journal_entry_id)) continue;
    const account = accountById.get(line.managerial_account_id);
    if (!account) continue;
    const accountType = account.account_type?.trim().toLowerCase() ?? "";
    if (["asset", "liability", "equity"].includes(accountType)) continue;
    const dreAccountType = ["revenue", "deduction", "expense"].includes(accountType)
      ? accountType
      : "unclassified";
    const unitCode = line.business_unit_id
      ? (unitCodeById.get(line.business_unit_id) ?? null)
      : null;
    if (!matchesScope(unitCode, filters.unitCode)) continue;

    const amount =
      account.normal_balance === "credit"
        ? numeric(line.credit_amount) - numeric(line.debit_amount)
        : numeric(line.debit_amount) - numeric(line.credit_amount);
    const existing = totals.get(account.id) ?? {
      accountCode: account.code,
      accountName: account.name,
      accountType: dreAccountType,
      amount: 0,
    };
    existing.amount += amount;
    totals.set(account.id, existing);
  }

  return [...totals.values()].sort((a, b) => a.accountCode.localeCompare(b.accountCode));
}
