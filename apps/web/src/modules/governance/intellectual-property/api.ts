import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  IntellectualPropertyAsset,
  IntellectualPropertyEvent,
  IntellectualPropertyWorkspace,
  IpNamedOption,
  IpPartyOption,
  IpProfileOption,
} from "./types";

function requireData<T>(data: T | null, message: string): T {
  if (data === null) throw new Error(message);
  return data;
}

export async function listIntellectualPropertyWorkspace(): Promise<IntellectualPropertyWorkspace> {
  const client = getSupabaseBrowserClient();
  const [assets, events, legalEntities, businessUnits, products, serviceLines, parties, profiles] =
    await Promise.all([
      client
        .from("intellectual_property_assets")
        .select("*")
        .order("updated_at", { ascending: false }),
      client
        .from("intellectual_property_events")
        .select("*")
        .order("sequence_no", { ascending: false }),
      client
        .from("legal_entities")
        .select("id,code,legal_name,trade_name,status")
        .order("legal_name"),
      client.from("business_units").select("id,code,name,legal_entity_id,status").order("name"),
      client.from("products").select("id,code,name,business_unit_id,status").order("name"),
      client.from("service_lines").select("id,code,name,business_unit_id,status").order("name"),
      client.from("parties").select("id,legal_name,trade_name,status").order("legal_name"),
      client.from("profiles").select("id,display_name,email,status").order("display_name"),
    ]);
  const results = [
    assets,
    events,
    legalEntities,
    businessUnits,
    products,
    serviceLines,
    parties,
    profiles,
  ];
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;

  return {
    assets: (assets.data ?? []) as IntellectualPropertyAsset[],
    events: (events.data ?? []) as IntellectualPropertyEvent[],
    legalEntities: (legalEntities.data ?? []).map((item) => ({
      id: String(item.id),
      code: String(item.code),
      name: String(item.trade_name || item.legal_name),
      status: String(item.status),
    })),
    businessUnits: (businessUnits.data ?? []) as IpNamedOption[],
    products: (products.data ?? []) as IpNamedOption[],
    serviceLines: (serviceLines.data ?? []) as IpNamedOption[],
    parties: (parties.data ?? []) as IpPartyOption[],
    profiles: (profiles.data ?? []) as IpProfileOption[],
  };
}

export async function createIntellectualPropertyAsset(
  values: Record<string, unknown>,
): Promise<IntellectualPropertyAsset> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("intellectual_property_assets")
    .insert(values)
    .select("*")
    .single();
  if (error) throw error;
  return data as IntellectualPropertyAsset;
}

export async function updateIntellectualPropertyAsset(
  id: string,
  expectedVersion: number,
  values: Record<string, unknown>,
): Promise<IntellectualPropertyAsset> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("intellectual_property_assets")
    .update(values)
    .eq("id", id)
    .eq("version", expectedVersion)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return requireData(
    data as IntellectualPropertyAsset | null,
    "O ativo foi alterado por outro usuário. Atualize a tela.",
  );
}

export async function deleteIntellectualPropertyAsset(id: string): Promise<void> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("intellectual_property_assets")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  requireData(data, "O ativo não foi excluído ou não está mais disponível.");
}

export async function createIntellectualPropertyEvent(
  values: Record<string, unknown>,
): Promise<IntellectualPropertyEvent> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("intellectual_property_events")
    .insert(values)
    .select("*")
    .single();
  if (error) throw error;
  return data as IntellectualPropertyEvent;
}

export async function updateIntellectualPropertyEvent(
  id: string,
  expectedVersion: number,
  values: Record<string, unknown>,
): Promise<IntellectualPropertyEvent> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("intellectual_property_events")
    .update(values)
    .eq("id", id)
    .eq("version", expectedVersion)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return requireData(
    data as IntellectualPropertyEvent | null,
    "O evento foi alterado por outro usuário. Atualize a tela.",
  );
}

export async function deleteIntellectualPropertyEvent(id: string): Promise<void> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("intellectual_property_events")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  requireData(data, "O evento não foi excluído ou não está mais disponível.");
}

export async function decideIntellectualPropertyEvent(
  eventId: string,
  expectedVersion: number,
  approve: boolean,
  reason?: string,
): Promise<void> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.functions.invoke("admin-intellectual-property", {
    body: {
      action: approve ? "approve-ip-event" : "reject-ip-event",
      eventId,
      expectedVersion,
      reason,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
}
