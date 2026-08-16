import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  ComplianceDirectory,
  ComplianceObligation,
  ComplianceOccurrence,
  CorporatePolicy,
  CorporatePolicyVersion,
  DirectoryOption,
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

function option(row: Record<string, unknown>, name: string, code?: string): DirectoryOption {
  return {
    id: String(row.id),
    name,
    code,
    status: row.status ? String(row.status) : undefined,
    business_unit_id: row.business_unit_id ? String(row.business_unit_id) : null,
    legal_entity_id: row.legal_entity_id ? String(row.legal_entity_id) : null,
  };
}

export async function listComplianceDirectory(): Promise<ComplianceDirectory> {
  const [
    obligations,
    occurrences,
    policies,
    policyVersions,
    legalEntities,
    businessUnits,
    products,
    projects,
    profiles,
    intellectualPropertyAssets,
  ] = await Promise.all([
    rows("compliance_obligations", "*", "code"),
    rows("compliance_occurrences", "*", "due_date"),
    rows("corporate_policies", "*", "code"),
    rows("corporate_policy_versions", "*", "version_number"),
    rows("legal_entities", "id,code,legal_name,status", "code"),
    rows("business_units", "id,code,name,status,legal_entity_id", "code"),
    rows("products", "id,code,name,status,business_unit_id", "code"),
    rows("projects", "id,code,name,status,business_unit_id", "code"),
    rows("profiles", "id,display_name,email,status", "display_name"),
    rows("intellectual_property_assets", "id,code,title,status", "code"),
  ]);

  return {
    obligations: obligations as unknown as ComplianceObligation[],
    occurrences: occurrences as unknown as ComplianceOccurrence[],
    policies: policies as unknown as CorporatePolicy[],
    policyVersions: policyVersions as unknown as CorporatePolicyVersion[],
    legalEntities: legalEntities.map((row) =>
      option(row, String(row.legal_name), String(row.code)),
    ),
    businessUnits: businessUnits.map((row) => option(row, String(row.name), String(row.code))),
    products: products.map((row) => option(row, String(row.name), String(row.code))),
    projects: projects.map((row) => option(row, String(row.name), String(row.code))),
    profiles: profiles.map((row) => option(row, String(row.display_name || row.email || row.id))),
    intellectualPropertyAssets: intellectualPropertyAssets.map((row) =>
      option(row, `${String(row.code)} — ${String(row.title)}`, String(row.code)),
    ),
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

async function deleteOne(table: string, id: string, message: string): Promise<void> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.from(table).delete().eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  requireData(data, message);
}

async function invoke(body: Record<string, unknown>): Promise<unknown> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.functions.invoke("admin-compliance", { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data?.result;
}

export const createComplianceObligation = (values: Record<string, unknown>) =>
  insertOne<ComplianceObligation>("compliance_obligations", values);
export const updateComplianceObligation = (
  id: string,
  version: number,
  values: Record<string, unknown>,
) =>
  updateOne<ComplianceObligation>(
    "compliance_obligations",
    id,
    version,
    values,
    "A obrigação foi alterada por outro usuário.",
  );
export const deleteComplianceObligation = (id: string) =>
  deleteOne("compliance_obligations", id, "A obrigação não foi excluída.");

export const createComplianceOccurrence = (values: Record<string, unknown>) =>
  insertOne<ComplianceOccurrence>("compliance_occurrences", values);
export const updateComplianceOccurrence = (
  id: string,
  version: number,
  values: Record<string, unknown>,
) =>
  updateOne<ComplianceOccurrence>(
    "compliance_occurrences",
    id,
    version,
    values,
    "A ocorrência foi alterada por outro usuário.",
  );
export const deleteComplianceOccurrence = (id: string) =>
  deleteOne("compliance_occurrences", id, "A ocorrência não foi excluída.");

export const createPolicy = (values: Record<string, unknown>) =>
  insertOne<CorporatePolicy>("corporate_policies", values);
export const updatePolicy = (id: string, version: number, values: Record<string, unknown>) =>
  updateOne<CorporatePolicy>(
    "corporate_policies",
    id,
    version,
    values,
    "A política foi alterada por outro usuário.",
  );
export const deletePolicy = (id: string) =>
  deleteOne("corporate_policies", id, "A política não foi excluída.");

export const createPolicyVersion = (values: Record<string, unknown>) =>
  insertOne<CorporatePolicyVersion>("corporate_policy_versions", values);
export const updatePolicyVersion = (id: string, version: number, values: Record<string, unknown>) =>
  updateOne<CorporatePolicyVersion>(
    "corporate_policy_versions",
    id,
    version,
    values,
    "A versão da política foi alterada por outro usuário.",
  );
export const deletePolicyVersion = (id: string) =>
  deleteOne("corporate_policy_versions", id, "A versão da política não foi excluída.");

export const completeComplianceOccurrence = (
  occurrenceId: string,
  expectedVersion: number,
  evidenceReference?: string,
  notes?: string,
) =>
  invoke({
    action: "complete-occurrence",
    occurrenceId,
    expectedVersion,
    evidenceReference,
    notes,
  });

export const waiveComplianceOccurrence = (
  occurrenceId: string,
  expectedVersion: number,
  reason: string,
) => invoke({ action: "waive-occurrence", occurrenceId, expectedVersion, reason });

export const submitPolicyVersion = (versionId: string, expectedVersion: number) =>
  invoke({ action: "submit-policy-version", versionId, expectedVersion });

export const decidePolicyVersion = (
  versionId: string,
  expectedVersion: number,
  approve: boolean,
  reason?: string,
) =>
  invoke({
    action: approve ? "approve-policy-version" : "reject-policy-version",
    versionId,
    expectedVersion,
    reason,
  });

export const publishPolicyVersion = (versionId: string, expectedVersion: number) =>
  invoke({ action: "publish-policy-version", versionId, expectedVersion });
