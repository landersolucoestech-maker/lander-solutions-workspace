export interface EconomicAccountRow {
  id: string;
  account_type: string;
  reporting_group: string | null;
}

export interface EconomicLedgerRow {
  journal_entry_id: string;
  managerial_account_id: string;
  signed_amount: number | string;
}

export interface EconomicJournalEntryRow {
  id: string;
  source_type: string;
}

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function summarizeUnitLedger(
  unitLedger: EconomicLedgerRow[],
  accounts: EconomicAccountRow[],
  journalEntries: EconomicJournalEntryRow[],
) {
  const accountMap = new Map(accounts.map((row) => [row.id, row]));
  const journalSourceMap = new Map(journalEntries.map((row) => [row.id, row.source_type]));
  let revenue = 0;
  let deductions = 0;
  let taxes = 0;
  let directExpenses = 0;
  let allocatedExpenses = 0;
  let participationExpenses = 0;

  for (const line of unitLedger) {
    const account = accountMap.get(line.managerial_account_id);
    if (!account) continue;
    const amount = numeric(line.signed_amount);
    if (account.account_type === "revenue") revenue += amount;
    else if (account.account_type === "deduction") deductions += amount;
    else if (account.account_type === "expense") {
      const isAllocationPosting = journalSourceMap.get(line.journal_entry_id) === "allocation";
      if (isAllocationPosting && amount > 0) allocatedExpenses += amount;
      else if (account.reporting_group === "tax_expense") taxes += amount;
      else if (account.reporting_group === "participation_expense") {
        participationExpenses += amount;
      } else if (account.reporting_group !== "participation_expense") directExpenses += amount;
    }
  }

  const totalCost = deductions + taxes + directExpenses + allocatedExpenses;
  const result = revenue - totalCost;
  return {
    revenue,
    deductions,
    taxes,
    directExpenses,
    allocatedExpenses,
    participationExpenses,
    totalCost,
    result,
    retainedAfterPostedParticipation: result - participationExpenses,
  };
}
