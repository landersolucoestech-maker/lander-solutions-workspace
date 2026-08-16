import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { BusinessUnit } from "./types";

export interface BusinessUnitDirectory {
  units: BusinessUnit[];
  legalEntities: Array<{ id: string; name: string }>;
  profiles: Array<{ id: string; name: string }>;
}

export async function listBusinessUnits(): Promise<BusinessUnit[]> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.from("business_units").select("*").order("code");

  if (error) throw error;
  return (data ?? []) as BusinessUnit[];
}

export async function listBusinessUnitDirectory(): Promise<BusinessUnitDirectory> {
  const client = getSupabaseBrowserClient();
  const [units, legalEntities, profiles] = await Promise.all([
    client.from("business_units").select("*").order("name"),
    client.from("legal_entities").select("id,legal_name,trade_name,status").order("legal_name"),
    client
      .from("profiles")
      .select("id,display_name,email,status")
      .eq("status", "active")
      .order("display_name"),
  ]);
  const failed = [units, legalEntities, profiles].find((result) => result.error);
  if (failed?.error) throw failed.error;

  return {
    units: (units.data ?? []) as BusinessUnit[],
    legalEntities: (legalEntities.data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.trade_name || row.legal_name),
    })),
    profiles: (profiles.data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.display_name || row.email),
    })),
  };
}

export async function saveBusinessUnit(
  id: string | null,
  version: number | null,
  values: Record<string, unknown>,
): Promise<BusinessUnit> {
  const client = getSupabaseBrowserClient();
  if (!id) {
    const { data, error } = await client.from("business_units").insert(values).select("*").single();
    if (error) throw error;
    return data as BusinessUnit;
  }

  const { data, error } = await client
    .from("business_units")
    .update(values)
    .eq("id", id)
    .eq("version", version)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new Error("A unidade foi alterada por outro usuário. Atualize e tente novamente.");
  return data as BusinessUnit;
}
