import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  PartiesData,
  Party,
  PartyAddress,
  PartyContact,
  PartyDocument,
  PartyRelationship,
  PartyRole,
  RestrictedReference,
} from "./directory-types";

export type PartyTable =
  | "parties"
  | "party_roles"
  | "party_contacts"
  | "party_addresses"
  | "party_relationships"
  | "party_documents";

function requireData<T>(data: T | null, message: string): T {
  if (data === null) throw new Error(message);
  return data;
}

export async function listPartiesData(canReadSensitive: boolean): Promise<PartiesData> {
  const client = getSupabaseBrowserClient();
  const [parties, roles, contacts, addresses, relationships, documents] = await Promise.all([
    client.from("parties").select("*").order("legal_name"),
    client.from("party_roles").select("*").order("created_at"),
    client.from("party_contacts").select("*").order("is_primary", { ascending: false }),
    client.from("party_addresses").select("*").order("is_primary", { ascending: false }),
    client.from("party_relationships").select("*").order("created_at"),
    canReadSensitive
      ? client.from("party_documents").select("*").order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const results = [parties, roles, contacts, addresses, relationships, documents];
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;

  return {
    parties: (parties.data ?? []) as Party[],
    roles: (roles.data ?? []) as PartyRole[],
    contacts: (contacts.data ?? []) as PartyContact[],
    addresses: (addresses.data ?? []) as PartyAddress[],
    relationships: (relationships.data ?? []) as PartyRelationship[],
    documents: (documents.data ?? []) as PartyDocument[],
  };
}

export async function createPartyRecord<T>(
  table: PartyTable,
  values: Record<string, unknown>,
): Promise<T> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.from(table).insert(values).select("*").single();
  if (error) throw error;
  return data as T;
}

export async function updatePartyRecord<T>(
  table: PartyTable,
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

export async function deletePartyRecord(table: PartyTable, id: string): Promise<void> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.from(table).delete().eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  requireData(data, "O registro não foi excluído ou não está mais disponível.");
}

async function invokeAdminParties(body: Record<string, unknown>): Promise<unknown> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.functions.invoke("admin-parties", { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data;
}

export async function listRestrictedReferences(partyId: string): Promise<RestrictedReference[]> {
  const data = (await invokeAdminParties({ action: "list-restricted", partyId })) as {
    references?: RestrictedReference[];
  };
  return data.references ?? [];
}

export async function createRestrictedReference(input: {
  partyId: string;
  referenceType: RestrictedReference["reference_type"];
  label: string;
  maskedValue: string;
  vaultReference: string;
}): Promise<void> {
  await invokeAdminParties({ action: "create-restricted", ...input });
}

export async function updateRestrictedReference(input: {
  id: string;
  expectedVersion: number;
  referenceType: RestrictedReference["reference_type"];
  label: string;
  maskedValue: string;
  vaultReference: string;
  status: RestrictedReference["status"];
}): Promise<void> {
  await invokeAdminParties({ action: "update-restricted", ...input });
}

export async function deleteRestrictedReference(input: {
  id: string;
  expectedVersion: number;
}): Promise<void> {
  await invokeAdminParties({ action: "delete-restricted", ...input });
}
