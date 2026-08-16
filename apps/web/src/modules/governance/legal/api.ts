import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  IntellectualPropertyReference,
  LegalMatter,
  LegalMatterEvent,
  LegalMatterIntellectualPropertyLink,
  LegalReferenceOption,
  LegalWorkspace,
} from "./types";

function requireData<T>(data: T | null, message: string): T {
  if (data === null) throw new Error(message);
  return data;
}

async function rows(table: string, columns: string, orderColumn: string) {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.from(table).select(columns).order(orderColumn);
  if (error) throw error;
  return (data ?? []) as unknown as Record<string, unknown>[];
}

const matterColumns =
  "id,legal_entity_id,business_unit_id,product_id,service_line_id,project_id,contract_id,counterparty_id,external_counsel_party_id,responsible_user_id,code,title,description,matter_type,jurisdiction,authority,case_number,status,risk_level,probability,exposure_currency_code,exposure_amount,opened_on,due_date,closed_on,outcome,storage_provider,storage_bucket,storage_object_key,notes,version";
const eventColumns =
  "id,legal_matter_id,sequence_no,event_type,title,description,occurred_at,due_at,status,responsible_user_id,evidence_reference,outcome,version";

export async function listLegalWorkspace(): Promise<LegalWorkspace> {
  const [
    legalMatters,
    legalEvents,
    intellectualPropertyLinks,
    intellectualPropertyReferences,
    legalEntities,
    businessUnits,
    projects,
    parties,
    contracts,
    profiles,
    currencies,
  ] = await Promise.all([
    rows("legal_matters", matterColumns, "code"),
    rows("legal_matter_events", eventColumns, "sequence_no"),
    rows(
      "legal_matter_intellectual_property_assets",
      "legal_matter_id,intellectual_property_asset_id,relationship_type,notes,created_by,created_at",
      "created_at",
    ),
    rows("intellectual_property_assets", "id,code,title,status", "code"),
    rows("legal_entities", "id,code,legal_name,status", "code"),
    rows("business_units", "id,code,name,status,legal_entity_id", "code"),
    rows("projects", "id,code,name,status,business_unit_id", "code"),
    rows(
      "parties",
      "id,legal_name,trade_name,status,party_type,primary_business_unit_id",
      "legal_name",
    ),
    rows("contracts", "id,code,title,status,business_unit_id", "code"),
    rows("profiles", "id,display_name,email,status", "display_name"),
    rows("currencies", "code,name,is_active", "code"),
  ]);

  return {
    legalMatters: legalMatters as unknown as LegalMatter[],
    legalEvents: legalEvents as unknown as LegalMatterEvent[],
    intellectualPropertyLinks:
      intellectualPropertyLinks as unknown as LegalMatterIntellectualPropertyLink[],
    intellectualPropertyReferences:
      intellectualPropertyReferences as unknown as IntellectualPropertyReference[],
    legalEntities: legalEntities.map((row) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.legal_name),
      status: String(row.status),
    })),
    businessUnits: businessUnits.map((row) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      status: String(row.status),
      legal_entity_id: String(row.legal_entity_id),
    })),
    projects: projects.map(mapUnitReference),
    parties: parties.map((row) => ({
      id: String(row.id),
      name: String(row.trade_name || row.legal_name),
      status: String(row.status),
      type: String(row.party_type),
      business_unit_id: row.primary_business_unit_id ? String(row.primary_business_unit_id) : null,
    })),
    contracts: contracts.map((row) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.title),
      status: String(row.status),
      business_unit_id: String(row.business_unit_id),
    })),
    profiles: profiles.map((row) => ({
      id: String(row.id),
      name: String(row.display_name || row.email),
      status: String(row.status),
    })),
    currencies: currencies.map((row) => ({
      id: String(row.code),
      code: String(row.code),
      name: `${String(row.code)} — ${String(row.name)}`,
      status: row.is_active ? "active" : "inactive",
    })),
  };
}

function mapUnitReference(row: Record<string, unknown>): LegalReferenceOption {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    status: String(row.status),
    business_unit_id: String(row.business_unit_id),
  };
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
  message: string,
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
  return requireData(data as T | null, message);
}

async function deleteOne(table: string, id: string, message: string) {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.from(table).delete().eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  requireData(data, message);
}

export const createLegalMatter = (values: Record<string, unknown>) =>
  insertOne<LegalMatter>("legal_matters", values);
export const updateLegalMatter = (id: string, version: number, values: Record<string, unknown>) =>
  updateOne<LegalMatter>(
    "legal_matters",
    id,
    version,
    values,
    "O assunto jurídico foi alterado por outro usuário.",
  );
export const deleteLegalMatter = (id: string) =>
  deleteOne("legal_matters", id, "O assunto jurídico não foi excluído.");

export const createLegalEvent = (values: Record<string, unknown>) =>
  insertOne<LegalMatterEvent>("legal_matter_events", values);
export const updateLegalEvent = (id: string, version: number, values: Record<string, unknown>) =>
  updateOne<LegalMatterEvent>(
    "legal_matter_events",
    id,
    version,
    values,
    "O evento jurídico foi alterado por outro usuário.",
  );
export const deleteLegalEvent = (id: string) =>
  deleteOne("legal_matter_events", id, "O evento jurídico não foi excluído.");

export const linkLegalMatterToIntellectualProperty = (values: {
  legal_matter_id: string;
  intellectual_property_asset_id: string;
  relationship_type: string;
  notes?: string | null;
}) =>
  insertOne<LegalMatterIntellectualPropertyLink>(
    "legal_matter_intellectual_property_assets",
    values,
  );

export async function unlinkLegalMatterFromIntellectualProperty(
  legalMatterId: string,
  intellectualPropertyAssetId: string,
) {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("legal_matter_intellectual_property_assets")
    .delete()
    .eq("legal_matter_id", legalMatterId)
    .eq("intellectual_property_asset_id", intellectualPropertyAssetId)
    .select("legal_matter_id")
    .maybeSingle();
  if (error) throw error;
  requireData(data, "O vínculo entre o assunto jurídico e a PI não foi removido.");
}

export async function closeLegalMatter(
  matterId: string,
  expectedVersion: number,
  outcome: string,
): Promise<void> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.functions.invoke("admin-legal", {
    body: { action: "close-legal-matter", matterId, expectedVersion, outcome },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
}
