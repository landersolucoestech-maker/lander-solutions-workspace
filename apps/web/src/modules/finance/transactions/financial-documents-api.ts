import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { FinancialDocument } from "./types";

export async function listFinancialDocuments(): Promise<FinancialDocument[]> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.from("financial_documents").select("*").order("due_date");

  if (error) throw error;
  return (data ?? []) as FinancialDocument[];
}
