import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { listPartyLookups } from "@/modules/parties";
import { listFinancialDocuments } from "./financial-documents-api";
import type {
  CashAccount,
  ContractOption,
  ExchangeRate,
  FinancialApproval,
  FinancialDirectory,
  FinancialDocumentLine,
  FinancialSettlement,
  JournalEntry,
  JournalLine,
  ManagerialAccount,
} from "./types";

export type FinanceTable =
  | "managerial_accounts"
  | "cash_accounts"
  | "exchange_rates"
  | "financial_documents"
  | "financial_document_lines"
  | "financial_settlements"
  | "journal_entries"
  | "journal_lines";

function requireData<T>(data: T | null, message: string): T {
  if (data === null) throw new Error(message);
  return data;
}

export async function listFinancialDirectory(): Promise<FinancialDirectory> {
  const client = getSupabaseBrowserClient();
  const [
    accounts,
    cashAccounts,
    exchangeRates,
    documents,
    documentLines,
    settlements,
    journalEntries,
    journalLines,
    approvals,
    parties,
    contracts,
  ] = await Promise.all([
    client.from("managerial_accounts").select("*").order("code"),
    client.from("cash_accounts").select("*").order("code"),
    client.from("exchange_rates").select("*").order("rate_date", { ascending: false }),
    listFinancialDocuments(),
    client.from("financial_document_lines").select("*").order("sequence_no"),
    client.from("financial_settlements").select("*").order("settlement_date", { ascending: false }),
    client.from("journal_entries").select("*").order("entry_number", { ascending: false }),
    client.from("journal_lines").select("*").order("line_no"),
    client.from("financial_approvals").select("*").order("created_at", { ascending: false }),
    listPartyLookups(),
    client.from("contracts").select("id,code,title,business_unit_id,status").order("code"),
  ]);

  const results = [
    accounts,
    cashAccounts,
    exchangeRates,
    documentLines,
    settlements,
    journalEntries,
    journalLines,
    approvals,
    contracts,
  ];
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;

  return {
    accounts: (accounts.data ?? []) as ManagerialAccount[],
    cashAccounts: (cashAccounts.data ?? []) as CashAccount[],
    exchangeRates: (exchangeRates.data ?? []) as ExchangeRate[],
    documents,
    documentLines: (documentLines.data ?? []) as FinancialDocumentLine[],
    settlements: (settlements.data ?? []) as FinancialSettlement[],
    journalEntries: (journalEntries.data ?? []) as JournalEntry[],
    journalLines: (journalLines.data ?? []) as JournalLine[],
    approvals: (approvals.data ?? []) as FinancialApproval[],
    parties,
    contracts: (contracts.data ?? []) as ContractOption[],
  };
}

export async function createFinanceRecord<T>(
  table: FinanceTable,
  values: Record<string, unknown>,
): Promise<T> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.from(table).insert(values).select("*").single();
  if (error) throw error;
  return data as T;
}

export async function updateFinanceRecord<T>(
  table: FinanceTable,
  id: string,
  expectedVersion: number,
  values: Record<string, unknown>,
): Promise<T> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from(table)
    .update(values)
    .eq("id", id)
    .eq("version", expectedVersion)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return requireData(
    data as T | null,
    "O registro foi alterado por outro usuário. Atualize a tela e tente novamente.",
  );
}

export async function updateJournalLine(
  id: string,
  values: Record<string, unknown>,
): Promise<JournalLine> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("journal_lines")
    .update(values)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return requireData(data as JournalLine | null, "A partida não foi atualizada.");
}

export async function deleteFinanceRecord(table: FinanceTable, id: string): Promise<void> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.from(table).delete().eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  requireData(data, "O registro não foi excluído ou não está mais disponível.");
}

async function invokeAdminFinance(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.functions.invoke("admin-finance", { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return (data ?? {}) as Record<string, unknown>;
}

export async function submitFinancialDocument(input: {
  documentId: string;
  expectedVersion: number;
}): Promise<void> {
  await invokeAdminFinance({ action: "submit-document", ...input });
}

export async function approveFinancialDocument(input: {
  documentId: string;
  expectedVersion: number;
}): Promise<void> {
  await invokeAdminFinance({ action: "approve-document", ...input });
}

export async function submitFinancialSettlement(input: {
  settlementId: string;
  expectedVersion: number;
}): Promise<void> {
  await invokeAdminFinance({ action: "submit-settlement", ...input });
}

export async function postFinancialSettlement(input: {
  settlementId: string;
  expectedVersion: number;
}): Promise<void> {
  await invokeAdminFinance({ action: "post-settlement", ...input });
}

export async function submitManualJournal(input: {
  entryId: string;
  expectedVersion: number;
}): Promise<void> {
  await invokeAdminFinance({ action: "submit-journal", ...input });
}

export async function postManualJournal(input: {
  entryId: string;
  expectedVersion: number;
}): Promise<void> {
  await invokeAdminFinance({ action: "post-journal", ...input });
}

export async function reverseJournalEntry(input: {
  entryId: string;
  expectedVersion: number;
  reversalDate: string;
  reason: string;
}): Promise<void> {
  await invokeAdminFinance({ action: "reverse-journal", ...input });
}
