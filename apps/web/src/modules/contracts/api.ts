import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  CONTRACT_TEMPLATE_ASSET_BUCKET,
  buildContractTemplateAssetPath,
  validateContractTemplateImage,
  type ContractTemplateImageSlot,
} from "@/modules/contracts/contract-template-assets";
import type {
  Contract,
  ContractApproval,
  ContractAuditEvent,
  ContractDirectory,
  ContractDocument,
  ContractFormulaComponent,
  ContractObligation,
  ContractParticipant,
  ContractParty,
  ContractVersion,
  ContractTemplate,
  PartyOption,
  ProfileOption,
} from "@/modules/contracts/types";

export type ContractTable =
  | "contracts"
  | "contract_parties"
  | "contract_versions"
  | "contract_formula_components"
  | "contract_version_participants"
  | "contract_obligations"
  | "contract_documents";

function requireData<T>(data: T | null, message: string): T {
  if (data === null) throw new Error(message);
  return data;
}

export async function listContractDirectory(): Promise<ContractDirectory> {
  const client = getSupabaseBrowserClient();
  const [
    contracts,
    parties,
    versions,
    components,
    participants,
    obligations,
    documents,
    approvals,
    partyOptions,
    profiles,
  ] = await Promise.all([
    client.from("contracts").select("*").order("created_at", { ascending: false }),
    client.from("contract_parties").select("*").order("created_at"),
    client.from("contract_versions").select("*").order("version_number", { ascending: false }),
    client.from("contract_formula_components").select("*").order("sequence_no"),
    client.from("contract_version_participants").select("*").order("priority"),
    client.from("contract_obligations").select("*").order("created_at"),
    client.from("contract_documents").select("*").order("created_at", { ascending: false }),
    client.from("contract_approvals").select("*").order("created_at", { ascending: false }),
    client
      .from("parties")
      .select("id,legal_name,trade_name,tax_id,party_type,status")
      .order("legal_name"),
    client.from("profiles").select("id,display_name,email").order("display_name"),
  ]);

  const results = [
    contracts,
    parties,
    versions,
    components,
    participants,
    obligations,
    documents,
    approvals,
    partyOptions,
    profiles,
  ];
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;

  return {
    contracts: (contracts.data ?? []) as Contract[],
    parties: (parties.data ?? []) as ContractParty[],
    versions: (versions.data ?? []) as ContractVersion[],
    components: (components.data ?? []) as ContractFormulaComponent[],
    participants: (participants.data ?? []) as ContractParticipant[],
    obligations: (obligations.data ?? []) as ContractObligation[],
    documents: (documents.data ?? []) as ContractDocument[],
    approvals: (approvals.data ?? []) as ContractApproval[],
    partyOptions: (partyOptions.data ?? []) as PartyOption[],
    profiles: (profiles.data ?? []) as ProfileOption[],
  };
}

export async function listContractTemplates(): Promise<ContractTemplate[]> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.from("contract_templates").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as ContractTemplate[];
}

export async function listContractAuditEvents(
  contractId: string,
  versionIds: string[],
): Promise<ContractAuditEvent[]> {
  const client = getSupabaseBrowserClient();
  const entityIds = [contractId, ...versionIds];
  const { data, error } = await client
    .from("audit_events")
    .select("id,occurred_at,actor_user_id,action,entity_table,entity_id,metadata")
    .in("entity_table", ["contracts", "contract_versions"])
    .in("entity_id", entityIds)
    .order("occurred_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as ContractAuditEvent[];
}

export async function createContractTemplate(
  values: Record<string, unknown>,
): Promise<ContractTemplate> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("contract_templates")
    .insert(values)
    .select("*")
    .single();
  if (error) throw error;
  return data as ContractTemplate;
}

export async function updateContractTemplate(
  id: string,
  expectedVersion: number,
  values: Record<string, unknown>,
): Promise<ContractTemplate> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("contract_templates")
    .update(values)
    .eq("id", id)
    .eq("version", expectedVersion)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return requireData(data as ContractTemplate | null, "O template foi alterado por outro usuário.");
}

export async function deleteContractTemplate(id: string): Promise<void> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("contract_templates")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  requireData(data, "O template não foi excluído.");
}

export async function uploadContractTemplateImage(
  templateId: string,
  slot: ContractTemplateImageSlot,
  file: File,
) {
  await validateContractTemplateImage(file);
  const path = buildContractTemplateAssetPath(
    templateId,
    slot,
    file.type as "image/png" | "image/jpeg" | "image/webp",
  );
  const client = getSupabaseBrowserClient();
  const { error } = await client.storage.from(CONTRACT_TEMPLATE_ASSET_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function removeContractTemplateImages(paths: Array<string | null | undefined>) {
  const uniquePaths = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  if (uniquePaths.length === 0) return;
  const client = getSupabaseBrowserClient();
  const { error } = await client.storage.from(CONTRACT_TEMPLATE_ASSET_BUCKET).remove(uniquePaths);
  if (error) throw error;
}

export async function createContractTemplateImageUrl(path: string | null | undefined) {
  if (!path) return null;
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.storage
    .from(CONTRACT_TEMPLATE_ASSET_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function createContractRecord<T>(
  table: ContractTable,
  values: Record<string, unknown>,
): Promise<T> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.from(table).insert(values).select("*").single();
  if (error) throw error;
  return data as T;
}

export async function updateContractRecord<T>(
  table: ContractTable,
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

export async function deleteContractRecord(table: ContractTable, id: string): Promise<void> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.from(table).delete().eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  requireData(data, "O registro não foi excluído ou não está mais disponível.");
}

async function invokeAdminContracts(
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.functions.invoke("admin-contracts", { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return (data ?? {}) as Record<string, unknown>;
}

export async function approveContractVersion(input: {
  versionId: string;
  expectedVersion: number;
}): Promise<void> {
  await invokeAdminContracts({ action: "approve-version", ...input });
}

export async function activateContract(input: {
  contractId: string;
  expectedVersion: number;
}): Promise<void> {
  await invokeAdminContracts({ action: "activate-contract", ...input });
}

export async function terminateContract(input: {
  contractId: string;
  expectedVersion: number;
  reason: string;
}): Promise<void> {
  await invokeAdminContracts({ action: "terminate-contract", ...input });
}
