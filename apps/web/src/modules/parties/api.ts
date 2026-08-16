import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PartyLookup } from "./types";

export async function listPartyLookups(): Promise<PartyLookup[]> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("parties")
    .select("id,legal_name,trade_name,status")
    .order("legal_name");

  if (error) throw error;
  return (data ?? []) as PartyLookup[];
}
