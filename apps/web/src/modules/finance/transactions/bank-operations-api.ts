import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  BankOperationsDirectory,
  BankStatementImport,
  BankStatementLine,
} from "./bank-operations-types";

async function selectRows(table: string, orderColumn?: string) {
  const client = getSupabaseBrowserClient();
  let query = client.from(table).select("*");
  if (orderColumn) query = query.order(orderColumn);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function insertOne<T>(table: string, values: Record<string, unknown>): Promise<T> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.from(table).insert(values).select("*").single();
  if (error) throw error;
  return data as T;
}

async function updateOne<T>(
  table: string,
  id: string,
  version: number,
  values: Record<string, unknown>,
  conflictMessage: string,
): Promise<T> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from(table)
    .update(values)
    .eq("id", id)
    .eq("version", version)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(conflictMessage);
  return data as T;
}

async function deleteOne(table: string, id: string, message: string) {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.from(table).delete().eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(message);
}

export async function listBankOperations(): Promise<BankOperationsDirectory> {
  const statementImports = await selectRows("bank_statement_imports", "period_end");
  const statementLines = await selectRows("bank_statement_lines", "sequence_no");

  return {
    statementImports: statementImports as BankOperationsDirectory["statementImports"],
    statementLines: statementLines as BankOperationsDirectory["statementLines"],
  };
}

export const createStatementImport = (values: Record<string, unknown>) =>
  insertOne<BankStatementImport>("bank_statement_imports", values);

export const updateStatementImport = (
  id: string,
  version: number,
  values: Record<string, unknown>,
) =>
  updateOne<BankStatementImport>(
    "bank_statement_imports",
    id,
    version,
    values,
    "O extrato foi alterado por outro usuário.",
  );

export const deleteStatementImport = (id: string) =>
  deleteOne("bank_statement_imports", id, "O extrato não foi excluído.");

export const createStatementLine = (values: Record<string, unknown>) =>
  insertOne<BankStatementLine>("bank_statement_lines", values);

export const updateBankStatementLine = (
  id: string,
  version: number,
  values: Record<string, unknown>,
) =>
  updateOne<BankStatementLine>(
    "bank_statement_lines",
    id,
    version,
    values,
    "A linha do extrato foi alterada por outro usuário.",
  );
