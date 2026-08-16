import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { assertAssetClassification } from "./asset-classification";
import type { AssetEvent, AssetReferenceOption, AssetsWorkspace, CorporateAsset } from "./types";

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

const assetColumns =
  "id,legal_entity_id,business_unit_id,product_id,service_line_id,project_id,supplier_party_id,contract_id,acquisition_document_id,custodian_user_id,code,name,description,asset_category,asset_type,asset_tag,serial_number,quantity,currency_code,acquisition_cost,current_value,depreciation_method,useful_life_months,acquired_on,in_service_on,warranty_until,renewal_date,expires_on,status,storage_location,external_reference,storage_provider,storage_bucket,storage_object_key,checksum_sha256,notes,version";
const eventColumns =
  "id,asset_id,event_type,occurred_on,from_business_unit_id,to_business_unit_id,from_custodian_user_id,to_custodian_user_id,from_location,to_location,financial_document_id,currency_code,amount,reason,evidence_reference,status,requested_by,approved_by,decision_reason,applied_by,version";

export async function listAssetsWorkspace(): Promise<AssetsWorkspace> {
  const [
    assets,
    assetEvents,
    legalEntities,
    businessUnits,
    products,
    serviceLines,
    projects,
    parties,
    contracts,
    financialDocuments,
    profiles,
    currencies,
  ] = await Promise.all([
    rows("corporate_assets", assetColumns, "code"),
    rows("asset_events", eventColumns, "occurred_on"),
    rows("legal_entities", "id,code,legal_name,status", "code"),
    rows("business_units", "id,code,name,status,legal_entity_id", "code"),
    rows("products", "id,code,name,status,business_unit_id", "code"),
    rows("service_lines", "id,code,name,status,business_unit_id", "code"),
    rows("projects", "id,code,name,status,business_unit_id", "code"),
    rows(
      "parties",
      "id,legal_name,trade_name,status,party_type,primary_business_unit_id",
      "legal_name",
    ),
    rows("contracts", "id,code,title,status,business_unit_id", "code"),
    rows(
      "financial_documents",
      "id,document_number,description,status,business_unit_id",
      "document_number",
    ),
    rows("profiles", "id,display_name,email,status", "display_name"),
    rows("currencies", "code,name,is_active", "code"),
  ]);

  return {
    assets: assets as unknown as CorporateAsset[],
    assetEvents: assetEvents as unknown as AssetEvent[],
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
    products: products.map(mapUnitReference),
    serviceLines: serviceLines.map(mapUnitReference),
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
    financialDocuments: financialDocuments.map((row) => ({
      id: String(row.id),
      code: String(row.document_number),
      name: `${String(row.document_number)} — ${String(row.description)}`,
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

function mapUnitReference(row: Record<string, unknown>): AssetReferenceOption {
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

export const createAsset = (values: Record<string, unknown>) => {
  assertAssetClassification(values);
  return insertOne<CorporateAsset>("corporate_assets", values);
};
export const updateAsset = (id: string, version: number, values: Record<string, unknown>) => {
  assertAssetClassification(values);
  return updateOne<CorporateAsset>(
    "corporate_assets",
    id,
    version,
    values,
    "O ativo foi alterado por outro usuário.",
  );
};
export const deleteAsset = (id: string) =>
  deleteOne("corporate_assets", id, "O ativo não foi excluído.");
export const createAssetEvent = (values: Record<string, unknown>) =>
  insertOne<AssetEvent>("asset_events", values);
export const updateAssetEvent = (id: string, version: number, values: Record<string, unknown>) =>
  updateOne<AssetEvent>(
    "asset_events",
    id,
    version,
    values,
    "O evento do ativo foi alterado por outro usuário.",
  );
export const deleteAssetEvent = (id: string) =>
  deleteOne("asset_events", id, "O evento do ativo não foi excluído.");

async function invokeAssetWorkflow(body: Record<string, unknown>) {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.functions.invoke("admin-assets", { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data?.result;
}

export const submitAssetEvent = (eventId: string, expectedVersion: number) =>
  invokeAssetWorkflow({ action: "submit-asset-event", eventId, expectedVersion });
export const decideAssetEvent = (
  eventId: string,
  expectedVersion: number,
  approve: boolean,
  reason?: string,
) =>
  invokeAssetWorkflow({
    action: approve ? "approve-asset-event" : "reject-asset-event",
    eventId,
    expectedVersion,
    reason,
  });
export const applyAssetEvent = (eventId: string, expectedVersion: number) =>
  invokeAssetWorkflow({ action: "apply-asset-event", eventId, expectedVersion });
