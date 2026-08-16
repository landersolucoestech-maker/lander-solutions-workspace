import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AUTHENTICATION_ENABLED } from "@/config/authentication";
import { summarizeUnitLedger } from "./unit-economic-calculations";

export interface UnitEconomicResult {
  id: string;
  code: string;
  name: string;
  status: string;
  unitType: string;
  currencyCode: string;
  description: string | null;
  legalEntityName: string | null;
  hasFinancialData: boolean;
  hasParticipationData: boolean;
  hasPayoutData: boolean;
  revenue: number;
  deductions: number;
  taxes: number;
  directExpenses: number;
  allocatedExpenses: number;
  participationExpenses: number;
  totalCost: number;
  result: number;
  resultBeforeParticipations: number;
  payoutDue: number;
  payoutPaid: number;
  payoutPending: number;
  landerRetained: number;
  marginPercent: number | null;
  contractCount: number;
}

export interface UnitAllocationItem {
  id: string;
  runId: string;
  description: string;
  ruleName: string;
  competenceDate: string;
  percentage: number;
  amount: number;
  status: string;
}

export interface UnitPayoutItem {
  id: string;
  calculationId: string;
  contractId: string;
  contractLabel: string;
  beneficiary: string;
  amount: number;
  paid: number;
  pending: number;
  dueDate: string;
  status: string;
}

export interface UnitParticipationItem {
  id: string;
  calculationId: string;
  beneficiary: string;
  contractLabel: string;
  percentage: number;
  calculationBase: number;
  amount: number;
  period: string;
  status: string;
}

export interface UnitFinancialMovement {
  id: string;
  date: string;
  description: string;
  nature: "Receita" | "Dedução" | "Despesa";
  category: string;
  account: string;
  status: string;
  amount: number;
}

export interface UnitContractItem {
  id: string;
  code: string;
  title: string;
  status: string;
  startsOn: string;
  endsOn: string | null;
  contractType: string;
  counterparty: string | null;
  currencyCode: string;
  baseAmount: number | null;
}

export interface UnitHistoryItem {
  id: number;
  occurredAt: string;
  action: string;
  entityTable: string;
  entityId: string | null;
}

export interface UnitEconomicSnapshot {
  period: string;
  generatedAt: string;
  units: UnitEconomicResult[];
  consolidated: Omit<
    UnitEconomicResult,
    | "id"
    | "code"
    | "name"
    | "status"
    | "unitType"
    | "currencyCode"
    | "description"
    | "legalEntityName"
    | "contractCount"
  > & { contractCount: number };
}

export interface UnitDetailSnapshot {
  unit: UnitEconomicResult;
  financialMovements: UnitFinancialMovement[];
  allocations: UnitAllocationItem[];
  allocationsAvailable: boolean;
  participations: UnitParticipationItem[];
  payouts: UnitPayoutItem[];
  contracts: UnitContractItem[];
  contractsAvailable: boolean;
  history: UnitHistoryItem[];
  historyAvailable: boolean;
}

interface BusinessUnitRow {
  id: string;
  code: string;
  name: string;
  status: string;
  unit_type: string;
  primary_currency_code: string;
  description: string | null;
  legal_entity_id: string | null;
}

interface AccountRow {
  id: string;
  code: string;
  name: string;
  account_type: string;
  reporting_group: string | null;
}

interface LedgerRow {
  journal_line_id: string;
  journal_entry_id: string;
  competence_date: string;
  managerial_account_id: string;
  business_unit_id: string | null;
  signed_amount: number | string;
}

interface JournalEntryRow {
  id: string;
  source_type: string;
  competence_date: string;
  status: string;
  source_id: string | null;
  description: string;
}

interface JournalLineRow {
  id: string;
  journal_entry_id: string;
  managerial_account_id: string;
  business_unit_id: string | null;
  debit_amount: number | string;
  credit_amount: number | string;
}

interface ParticipationCalculationRow {
  id: string;
  business_unit_id: string;
  competence_start: string;
  competence_end: string;
  status: string;
  contract_id: string;
  distributable_base: number | string | null;
}

interface ParticipationLineRow {
  id: string;
  participation_calculation_id: string;
  party_id: string;
  percentage: number | string;
  calculation_base: number | string;
  net_payable: number | string;
  status: string;
}

interface PayoutObligationRow {
  id: string;
  participation_calculation_id: string;
  business_unit_id: string;
  contract_id: string;
  party_id: string;
  amount: number | string;
  paid_amount: number | string;
  due_date: string;
  status: string;
}

interface ContractRow {
  id: string;
  business_unit_id: string | null;
  code: string;
  title: string;
  status: string;
  starts_on: string;
  ends_on: string | null;
  contract_type: string;
  currency_code: string;
  base_amount: number | string | null;
}

interface ContractPartyRow {
  contract_id: string;
  party_id: string;
  party_role: string;
  is_primary: boolean;
  status: string;
}

interface LegalEntityRow {
  id: string;
  legal_name: string;
  trade_name: string | null;
}

interface SettlementRow {
  id: string;
  cash_account_id: string;
}

interface CashAccountRow {
  id: string;
  name: string;
}

interface PartyRow {
  id: string;
  legal_name: string;
  trade_name: string | null;
}

interface AllocationRunRow {
  id: string;
  allocation_rule_version_id: string;
  competence_date: string;
  description: string;
  status: string;
}

interface AllocationDistributionRow {
  id: string;
  allocation_run_id: string;
  business_unit_id: string;
  allocation_percentage: number | string;
  allocated_amount: number | string;
}

interface AllocationVersionRow {
  id: string;
  allocation_rule_id: string;
}

interface AllocationRuleRow {
  id: string;
  name: string;
}

interface AuditRow {
  id: number;
  occurred_at: string;
  action: string;
  entity_table: string;
  entity_id: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
}

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function selectRows<T>(table: string, columns: string): Promise<T[]> {
  const client = getSupabaseBrowserClient();
  const query = client.from(table).select(columns);
  const timeout = new Promise<never>((_, reject) =>
    globalThis.setTimeout(() => reject(new Error(`Timeout reading ${table}`)), 6000),
  );
  const { data, error } = await Promise.race([query, timeout]);
  if (error) throw error;
  return (data ?? []) as unknown as T[];
}

async function selectOptionalRows<T>(table: string, columns: string): Promise<T[]> {
  try {
    return await selectRows<T>(table, columns);
  } catch {
    // Contextual history must not prevent the unit's economic and operational data from loading.
    return [];
  }
}

function selectAuthorizedRows<T>(table: string, columns: string): Promise<T[]> {
  return AUTHENTICATION_ENABLED ? selectOptionalRows<T>(table, columns) : Promise.resolve([]);
}

function includesPeriod(start: string, end: string, period: string) {
  const periodStart = `${period}-01`;
  const [year, month] = period.split("-").map(Number);
  const periodEnd = new Date(year, month, 0).toISOString().slice(0, 10);
  return start <= periodEnd && end >= periodStart;
}

export async function loadUnitEconomicSnapshot(period: string): Promise<UnitEconomicSnapshot> {
  const [
    units,
    accounts,
    ledger,
    journalEntries,
    journalLines,
    calculations,
    obligations,
    contracts,
    legalEntities,
  ] = await Promise.all([
    selectAuthorizedRows<BusinessUnitRow>(
      "business_units",
      "id,code,name,status,unit_type,primary_currency_code,description,legal_entity_id",
    ),
    selectOptionalRows<AccountRow>(
      "managerial_accounts",
      "id,code,name,account_type,reporting_group",
    ),
    selectOptionalRows<LedgerRow>(
      "reporting_posted_ledger_lines",
      "journal_line_id,journal_entry_id,competence_date,managerial_account_id,business_unit_id,signed_amount",
    ),
    selectOptionalRows<JournalEntryRow>(
      "journal_entries",
      "id,source_type,source_id,competence_date,description,status",
    ),
    selectOptionalRows<JournalLineRow>(
      "journal_lines",
      "id,journal_entry_id,managerial_account_id,business_unit_id,debit_amount,credit_amount",
    ),
    selectAuthorizedRows<ParticipationCalculationRow>(
      "participation_calculations",
      "id,business_unit_id,contract_id,competence_start,competence_end,distributable_base,status",
    ),
    selectAuthorizedRows<PayoutObligationRow>(
      "payout_obligations",
      "id,participation_calculation_id,business_unit_id,contract_id,party_id,amount,paid_amount,due_date,status",
    ),
    selectAuthorizedRows<ContractRow>(
      "contracts",
      "id,business_unit_id,code,title,contract_type,currency_code,base_amount,status,starts_on,ends_on",
    ),
    selectAuthorizedRows<LegalEntityRow>("legal_entities", "id,legal_name,trade_name"),
  ]);

  const accountMap = new Map(accounts.map((row) => [row.id, row]));
  const postedEntryMap = new Map(
    journalEntries.filter((row) => row.status === "posted").map((row) => [row.id, row]),
  );
  const resolvedLedger: LedgerRow[] =
    ledger.length > 0
      ? ledger
      : journalLines.flatMap((line) => {
          const entry = postedEntryMap.get(line.journal_entry_id);
          const account = accountMap.get(line.managerial_account_id);
          if (!entry || !account) return [];
          const debit = numeric(line.debit_amount);
          const credit = numeric(line.credit_amount);
          const signedAmount = account.account_type === "revenue" ? credit - debit : debit - credit;
          return [
            {
              journal_line_id: line.id,
              journal_entry_id: line.journal_entry_id,
              competence_date: entry.competence_date,
              managerial_account_id: line.managerial_account_id,
              business_unit_id: line.business_unit_id,
              signed_amount: signedAmount,
            },
          ];
        });
  const fallbackUnitIds = new Set(
    [
      ...resolvedLedger.map((row) => row.business_unit_id),
      ...contracts.map((row) => row.business_unit_id),
    ].filter((id): id is string => Boolean(id)),
  );
  const resolvedUnits: BusinessUnitRow[] =
    units.length > 0
      ? units
      : [...fallbackUnitIds].map((id) => ({
          id,
          code: "Detalhes protegidos",
          name: "Unidade vinculada",
          status: "unavailable",
          unit_type: "unavailable",
          primary_currency_code: "BRL",
          description: null,
          legal_entity_id: null,
        }));
  const calculationsInPeriod = new Set(
    calculations
      .filter(
        (row) =>
          !["cancelled", "reversed"].includes(row.status) &&
          includesPeriod(row.competence_start, row.competence_end, period),
      )
      .map((row) => row.id),
  );

  const hasParticipationData = AUTHENTICATION_ENABLED;
  const hasPayoutData = AUTHENTICATION_ENABLED;
  const legalEntityMap = new Map(
    legalEntities.map((row) => [row.id, row.trade_name || row.legal_name]),
  );
  const results = resolvedUnits.map<UnitEconomicResult>((unit) => {
    const unitLedger = resolvedLedger.filter(
      (row) => row.business_unit_id === unit.id && row.competence_date.slice(0, 7) === period,
    );
    const composition = summarizeUnitLedger(unitLedger, accounts, journalEntries);
    const {
      revenue,
      deductions,
      taxes,
      directExpenses,
      allocatedExpenses,
      participationExpenses,
      totalCost,
      result,
    } = composition;

    const unitObligations = obligations.filter(
      (row) =>
        row.business_unit_id === unit.id &&
        calculationsInPeriod.has(row.participation_calculation_id) &&
        !["cancelled", "reversed"].includes(row.status),
    );
    const payoutDue = unitObligations.reduce((total, row) => total + numeric(row.amount), 0);
    const payoutPaid = unitObligations.reduce((total, row) => total + numeric(row.paid_amount), 0);
    const payoutPending = Math.max(0, payoutDue - payoutPaid);
    const netRevenue = revenue - deductions;

    return {
      id: unit.id,
      code: unit.code,
      name: unit.name,
      status: unit.status,
      unitType: unit.unit_type,
      currencyCode: unit.primary_currency_code,
      description: unit.description,
      legalEntityName: unit.legal_entity_id
        ? (legalEntityMap.get(unit.legal_entity_id) ?? null)
        : null,
      hasFinancialData: unitLedger.length > 0 || unitObligations.length > 0,
      hasParticipationData,
      hasPayoutData,
      revenue,
      deductions,
      taxes,
      directExpenses,
      allocatedExpenses,
      participationExpenses,
      totalCost,
      result,
      resultBeforeParticipations: result,
      payoutDue,
      payoutPaid,
      payoutPending,
      landerRetained: result - (hasPayoutData ? payoutDue : participationExpenses),
      marginPercent:
        netRevenue === 0
          ? null
          : ((result - (hasPayoutData ? payoutDue : participationExpenses)) / netRevenue) * 100,
      contractCount: contracts.filter(
        (contract) => contract.business_unit_id === unit.id && contract.status !== "cancelled",
      ).length,
    };
  });

  const totals = results.reduce(
    (total, unit) => ({
      hasFinancialData: total.hasFinancialData || unit.hasFinancialData,
      hasParticipationData: total.hasParticipationData || unit.hasParticipationData,
      hasPayoutData: total.hasPayoutData || unit.hasPayoutData,
      revenue: total.revenue + unit.revenue,
      deductions: total.deductions + unit.deductions,
      taxes: total.taxes + unit.taxes,
      directExpenses: total.directExpenses + unit.directExpenses,
      allocatedExpenses: total.allocatedExpenses + unit.allocatedExpenses,
      participationExpenses: total.participationExpenses + unit.participationExpenses,
      totalCost: total.totalCost + unit.totalCost,
      result: total.result + unit.result,
      resultBeforeParticipations:
        total.resultBeforeParticipations + unit.resultBeforeParticipations,
      payoutDue: total.payoutDue + unit.payoutDue,
      payoutPaid: total.payoutPaid + unit.payoutPaid,
      payoutPending: total.payoutPending + unit.payoutPending,
      landerRetained: total.landerRetained + unit.landerRetained,
      contractCount: total.contractCount + unit.contractCount,
    }),
    {
      hasFinancialData: false,
      hasParticipationData: false,
      hasPayoutData: false,
      revenue: 0,
      deductions: 0,
      taxes: 0,
      directExpenses: 0,
      allocatedExpenses: 0,
      participationExpenses: 0,
      totalCost: 0,
      result: 0,
      resultBeforeParticipations: 0,
      payoutDue: 0,
      payoutPaid: 0,
      payoutPending: 0,
      landerRetained: 0,
      contractCount: 0,
    },
  );
  const consolidatedNetRevenue = totals.revenue - totals.deductions;

  return {
    period,
    generatedAt: new Date().toISOString(),
    units: results.sort((a, b) => a.name.localeCompare(b.name)),
    consolidated: {
      ...totals,
      marginPercent:
        consolidatedNetRevenue === 0
          ? null
          : (totals.landerRetained / consolidatedNetRevenue) * 100,
    },
  };
}

export async function loadUnitDetail(unitId: string, period: string): Promise<UnitDetailSnapshot> {
  const economic = await loadUnitEconomicSnapshot(period);
  const unit = economic.units.find((row) => row.id === unitId);
  if (!unit) throw new Error("Unidade de negócio não encontrada ou fora do seu escopo.");

  const [
    runs,
    distributions,
    versions,
    rules,
    calculations,
    participationLines,
    obligations,
    parties,
    contracts,
    contractParties,
    accounts,
    journalEntries,
    journalLines,
    settlements,
    cashAccounts,
    audit,
  ] = await Promise.all([
    selectAuthorizedRows<AllocationRunRow>(
      "allocation_runs",
      "id,allocation_rule_version_id,competence_date,description,status",
    ),
    selectAuthorizedRows<AllocationDistributionRow>(
      "allocation_run_distributions",
      "id,allocation_run_id,business_unit_id,allocation_percentage,allocated_amount",
    ),
    selectAuthorizedRows<AllocationVersionRow>("allocation_rule_versions", "id,allocation_rule_id"),
    selectAuthorizedRows<AllocationRuleRow>("allocation_rules", "id,name"),
    selectAuthorizedRows<ParticipationCalculationRow>(
      "participation_calculations",
      "id,business_unit_id,contract_id,competence_start,competence_end,distributable_base,status",
    ),
    selectAuthorizedRows<ParticipationLineRow>(
      "participation_calculation_lines",
      "id,participation_calculation_id,party_id,percentage,calculation_base,net_payable,status",
    ),
    selectAuthorizedRows<PayoutObligationRow>(
      "payout_obligations",
      "id,participation_calculation_id,business_unit_id,contract_id,party_id,amount,paid_amount,due_date,status",
    ),
    selectAuthorizedRows<PartyRow>("parties", "id,legal_name,trade_name"),
    selectAuthorizedRows<ContractRow>(
      "contracts",
      "id,business_unit_id,code,title,contract_type,currency_code,base_amount,status,starts_on,ends_on",
    ),
    selectAuthorizedRows<ContractPartyRow>(
      "contract_parties",
      "contract_id,party_id,party_role,is_primary,status",
    ),
    selectOptionalRows<AccountRow>("managerial_accounts", "id,code,name,account_type,reporting_group"),
    selectOptionalRows<JournalEntryRow>(
      "journal_entries",
      "id,source_type,source_id,competence_date,description,status",
    ),
    selectOptionalRows<JournalLineRow>(
      "journal_lines",
      "id,journal_entry_id,managerial_account_id,business_unit_id,debit_amount,credit_amount",
    ),
    selectAuthorizedRows<SettlementRow>("financial_settlements", "id,cash_account_id"),
    selectAuthorizedRows<CashAccountRow>("cash_accounts", "id,name"),
    selectAuthorizedRows<AuditRow>(
      "audit_events",
      "id,occurred_at,action,entity_table,entity_id,before_data,after_data",
    ),
  ]);

  const runMap = new Map(runs.map((row) => [row.id, row]));
  const versionMap = new Map(versions.map((row) => [row.id, row]));
  const ruleMap = new Map(rules.map((row) => [row.id, row]));
  const allocationItems = distributions
    .filter((row) => {
      const run = runMap.get(row.allocation_run_id);
      return (
        row.business_unit_id === unitId &&
        run?.competence_date.slice(0, 7) === period &&
        !["cancelled", "reversed"].includes(run.status)
      );
    })
    .map<UnitAllocationItem>((row) => {
      const run = runMap.get(row.allocation_run_id)!;
      const version = versionMap.get(run.allocation_rule_version_id);
      const rule = version ? ruleMap.get(version.allocation_rule_id) : undefined;
      return {
        id: row.id,
        runId: run.id,
        description: run.description,
        ruleName: rule?.name ?? "Regra não identificada",
        competenceDate: run.competence_date,
        percentage: numeric(row.allocation_percentage),
        amount: numeric(row.allocated_amount),
        status: run.status,
      };
    });

  const calculationsInPeriod = new Set(
    calculations
      .filter(
        (row) =>
          row.business_unit_id === unitId &&
          includesPeriod(row.competence_start, row.competence_end, period),
      )
      .map((row) => row.id),
  );
  const partyMap = new Map(parties.map((row) => [row.id, row]));
  const contractMap = new Map(contracts.map((row) => [row.id, row]));
  const accountMap = new Map(accounts.map((row) => [row.id, row]));
  const settlementMap = new Map(settlements.map((row) => [row.id, row]));
  const cashAccountMap = new Map(cashAccounts.map((row) => [row.id, row.name]));
  const sourceLabels: Record<string, string> = {
    direct_cost: "Custo direto",
    exclusive_expense: "Despesa exclusiva",
    shared_expense: "Despesa compartilhada",
    participation_expense: "Participação contratual",
    tax_expense: "Imposto",
    fee_expense: "Taxa financeira",
  };
  const movementItems = journalLines
    .flatMap<UnitFinancialMovement>((line) => {
      const entry = journalEntries.find((row) => row.id === line.journal_entry_id);
      const account = accountMap.get(line.managerial_account_id);
      if (
        line.business_unit_id !== unitId ||
        !entry ||
        entry.status !== "posted" ||
        entry.competence_date.slice(0, 7) !== period ||
        !account
      ) {
        return [];
      }
      const debit = numeric(line.debit_amount);
      const credit = numeric(line.credit_amount);
      const amount = account.account_type === "revenue" ? credit - debit : debit - credit;
      const settlement =
        entry.source_type === "settlement" && entry.source_id
          ? settlementMap.get(entry.source_id)
          : undefined;
      const cashAccount = settlement ? cashAccountMap.get(settlement.cash_account_id) : null;
      return [
        {
          id: line.id,
          date: entry.competence_date,
          description: entry.description,
          nature:
            account.account_type === "revenue"
              ? "Receita"
              : account.account_type === "deduction"
                ? "Dedução"
                : "Despesa",
          category: account.reporting_group
            ? (sourceLabels[account.reporting_group] ?? account.name)
            : account.name,
          account: cashAccount ?? `${account.code} · ${account.name}`,
          status: entry.status,
          amount,
        },
      ];
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const participationItems = participationLines
    .filter((row) => calculationsInPeriod.has(row.participation_calculation_id))
    .map<UnitParticipationItem>((row) => {
      const calculation = calculations.find((item) => item.id === row.participation_calculation_id);
      const party = partyMap.get(row.party_id);
      const contract = calculation ? contractMap.get(calculation.contract_id) : undefined;
      return {
        id: row.id,
        calculationId: row.participation_calculation_id,
        beneficiary: party?.trade_name || party?.legal_name || "Beneficiário não identificado",
        contractLabel: contract
          ? `${contract.code} — ${contract.title}`
          : "Contrato não identificado",
        percentage: numeric(row.percentage),
        calculationBase: numeric(row.calculation_base),
        amount: numeric(row.net_payable),
        period: calculation
          ? `${calculation.competence_start} — ${calculation.competence_end}`
          : period,
        status: row.status,
      };
    });
  const payoutItems = obligations
    .filter(
      (row) =>
        row.business_unit_id === unitId &&
        calculationsInPeriod.has(row.participation_calculation_id),
    )
    .map<UnitPayoutItem>((row) => {
      const party = partyMap.get(row.party_id);
      const contract = contractMap.get(row.contract_id);
      const amount = numeric(row.amount);
      const paid = numeric(row.paid_amount);
      return {
        id: row.id,
        calculationId: row.participation_calculation_id,
        contractId: row.contract_id,
        contractLabel: contract
          ? `${contract.code} — ${contract.title}`
          : "Contrato não identificado",
        beneficiary: party?.trade_name || party?.legal_name || "Beneficiário não identificado",
        amount,
        paid,
        pending: Math.max(0, amount - paid),
        dueDate: row.due_date,
        status: row.status,
      };
    });

  return {
    unit,
    financialMovements: movementItems,
    allocations: allocationItems.sort((a, b) => b.competenceDate.localeCompare(a.competenceDate)),
    allocationsAvailable: AUTHENTICATION_ENABLED,
    participations: participationItems,
    payouts: payoutItems.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    contracts: contracts
      .filter((row) => row.business_unit_id === unitId)
      .map((row) => ({
        id: row.id,
        code: row.code,
        title: row.title,
        status: row.status,
        startsOn: row.starts_on,
        endsOn: row.ends_on,
        contractType: row.contract_type,
        counterparty: (() => {
          const party = contractParties.find(
            (item) =>
              item.contract_id === row.id &&
              item.status === "active" &&
              (item.is_primary || item.party_role === "counterparty"),
          );
          const record = party ? partyMap.get(party.party_id) : undefined;
          return record?.trade_name || record?.legal_name || null;
        })(),
        currencyCode: row.currency_code,
        baseAmount: row.base_amount === null ? null : numeric(row.base_amount),
      })),
    contractsAvailable: AUTHENTICATION_ENABLED,
    history: audit
      .filter(
        (row) =>
          (row.entity_table === "business_units" && row.entity_id === unitId) ||
          row.before_data?.business_unit_id === unitId ||
          row.after_data?.business_unit_id === unitId,
      )
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
      .slice(0, 50)
      .map((row) => ({
        id: row.id,
        occurredAt: row.occurred_at,
        action: row.action,
        entityTable: row.entity_table,
        entityId: row.entity_id,
      })),
    historyAvailable: AUTHENTICATION_ENABLED,
  };
}
