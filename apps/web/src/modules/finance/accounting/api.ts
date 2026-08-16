import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { FinancialCategory } from "./types";

export async function listFinancialCategories(): Promise<FinancialCategory[]> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.from("financial_categories").select("*").order("code");

  if (error) throw error;
  return (data ?? []) as FinancialCategory[];
}
