import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  CapitalContribution,
  CapitalStructure,
  CorporateOwnershipWorkspace,
  CorporateResolution,
  CurrencyOption,
  GovernanceDocument,
  LegalEntityOption,
  OwnershipChange,
  OwnershipChangeLine,
  OwnershipPosition,
  OwnershipRole,
  PartyOption,
  ProfileOption,
  ShareClass,
} from "./types";

function requireData<T>(data: T | null, message: string): T {
  if (data === null) throw new Error(message);
  return data;
}

function requireNoError(error: { message: string } | null) {
  if (error) throw error;
}

export async function listCorporateOwnershipWorkspace(): Promise<CorporateOwnershipWorkspace> {
  const client = getSupabaseBrowserClient();
  const [
    legalEntities,
    parties,
    profiles,
    currencies,
    capitalStructures,
    shareClasses,
    positions,
    roles,
    documents,
    resolutions,
    contributions,
    changes,
    changeLines,
  ] = await Promise.all([
    client
      .from("legal_entities")
      .select("id,code,legal_name,trade_name,functional_currency_code,status")
      .order("legal_name"),
    client
      .from("parties")
      .select("id,party_type,legal_name,trade_name,tax_id,status")
      .order("legal_name"),
    client.from("profiles").select("id,display_name,email,status").order("display_name"),
    client.from("currencies").select("code,name,symbol").eq("is_active", true).order("code"),
    client
      .from("corporate_capital_structures")
      .select("*")
      .order("effective_from", { ascending: false })
      .order("version_no", { ascending: false }),
    client.from("corporate_share_classes").select("*").order("code"),
    client
      .from("corporate_ownership_positions")
      .select("*")
      .order("effective_from", { ascending: false }),
    client
      .from("corporate_ownership_roles")
      .select("*")
      .order("effective_from", { ascending: false }),
    client.from("governance_documents").select("*").order("created_at", { ascending: false }),
    client.from("corporate_resolutions").select("*").order("held_on", { ascending: false }),
    client
      .from("corporate_capital_contributions")
      .select("*")
      .order("contributed_on", { ascending: false }),
    client
      .from("corporate_ownership_changes")
      .select("*")
      .order("created_at", { ascending: false }),
    client.from("corporate_ownership_change_lines").select("*").order("sequence_no"),
  ]);

  const results = [
    legalEntities,
    parties,
    profiles,
    currencies,
    capitalStructures,
    shareClasses,
    positions,
    roles,
    documents,
    resolutions,
    contributions,
    changes,
    changeLines,
  ];
  const failed = results.find((result) => result.error);
  requireNoError(failed?.error ?? null);

  return {
    legalEntities: (legalEntities.data ?? []) as LegalEntityOption[],
    parties: (parties.data ?? []) as PartyOption[],
    profiles: (profiles.data ?? []) as ProfileOption[],
    currencies: (currencies.data ?? []) as CurrencyOption[],
    capitalStructures: (capitalStructures.data ?? []) as CapitalStructure[],
    shareClasses: (shareClasses.data ?? []) as ShareClass[],
    positions: (positions.data ?? []) as OwnershipPosition[],
    roles: (roles.data ?? []) as OwnershipRole[],
    documents: (documents.data ?? []) as GovernanceDocument[],
    resolutions: (resolutions.data ?? []) as CorporateResolution[],
    contributions: (contributions.data ?? []) as CapitalContribution[],
    changes: (changes.data ?? []) as OwnershipChange[],
    changeLines: (changeLines.data ?? []) as OwnershipChangeLine[],
  };
}

export async function createCapitalStructure(
  values: Record<string, unknown>,
): Promise<CapitalStructure> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("corporate_capital_structures")
    .insert(values)
    .select("*")
    .single();
  if (error) throw error;
  return data as CapitalStructure;
}

export async function updateCapitalStructure(
  id: string,
  expectedVersion: number,
  values: Record<string, unknown>,
): Promise<CapitalStructure> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("corporate_capital_structures")
    .update(values)
    .eq("id", id)
    .eq("version", expectedVersion)
    .eq("status", "draft")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return requireData(
    data as CapitalStructure | null,
    "A estrutura foi alterada por outro usuário.",
  );
}

export async function deleteCapitalStructure(id: string, expectedVersion: number) {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("corporate_capital_structures")
    .delete()
    .eq("id", id)
    .eq("version", expectedVersion)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return requireData(data, "A estrutura não pode mais ser excluída.");
}

export async function createShareClass(values: Record<string, unknown>): Promise<ShareClass> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("corporate_share_classes")
    .insert(values)
    .select("*")
    .single();
  if (error) throw error;
  return data as ShareClass;
}

export async function updateShareClass(
  id: string,
  expectedVersion: number,
  values: Record<string, unknown>,
): Promise<ShareClass> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("corporate_share_classes")
    .update(values)
    .eq("id", id)
    .eq("version", expectedVersion)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return requireData(data as ShareClass | null, "A classe foi alterada por outro usuário.");
}

export async function deleteShareClass(id: string, expectedVersion: number) {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("corporate_share_classes")
    .delete()
    .eq("id", id)
    .eq("version", expectedVersion)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return requireData(data, "A classe não pode mais ser excluída.");
}

export async function createCorporateResolution(
  values: Record<string, unknown>,
): Promise<CorporateResolution> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("corporate_resolutions")
    .insert(values)
    .select("*")
    .single();
  if (error) throw error;
  return data as CorporateResolution;
}

export async function updateCorporateResolution(
  id: string,
  expectedVersion: number,
  values: Record<string, unknown>,
): Promise<CorporateResolution> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("corporate_resolutions")
    .update(values)
    .eq("id", id)
    .eq("version", expectedVersion)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return requireData(
    data as CorporateResolution | null,
    "A deliberação foi alterada por outro usuário.",
  );
}

export async function deleteCorporateResolution(id: string, expectedVersion: number) {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("corporate_resolutions")
    .delete()
    .eq("id", id)
    .eq("version", expectedVersion)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return requireData(data, "A deliberação não pode mais ser excluída.");
}

export async function createOwnershipChange(
  values: Record<string, unknown>,
): Promise<OwnershipChange> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("corporate_ownership_changes")
    .insert(values)
    .select("*")
    .single();
  if (error) throw error;
  return data as OwnershipChange;
}

export async function updateOwnershipChange(
  id: string,
  expectedVersion: number,
  values: Record<string, unknown>,
): Promise<OwnershipChange> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("corporate_ownership_changes")
    .update(values)
    .eq("id", id)
    .eq("version", expectedVersion)
    .eq("status", "draft")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return requireData(
    data as OwnershipChange | null,
    "A alteração foi modificada por outro usuário.",
  );
}

export async function deleteOwnershipChange(id: string, expectedVersion: number) {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("corporate_ownership_changes")
    .delete()
    .eq("id", id)
    .eq("version", expectedVersion)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return requireData(data, "A alteração não pode mais ser excluída.");
}

export async function createOwnershipChangeLine(
  values: Record<string, unknown>,
): Promise<OwnershipChangeLine> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("corporate_ownership_change_lines")
    .insert(values)
    .select("*")
    .single();
  if (error) throw error;
  return data as OwnershipChangeLine;
}

export async function updateOwnershipChangeLine(
  id: string,
  values: Record<string, unknown>,
): Promise<OwnershipChangeLine> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("corporate_ownership_change_lines")
    .update(values)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return requireData(data as OwnershipChangeLine | null, "A linha não pode mais ser alterada.");
}

export async function deleteOwnershipChangeLine(id: string) {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("corporate_ownership_change_lines")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return requireData(data, "A linha não pode mais ser excluída.");
}

async function invokeOwnershipWorkflow<T>(body: Record<string, unknown>): Promise<T> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.functions.invoke("admin-corporate-ownership", { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export function submitOwnershipChange(changeId: string, expectedVersion: number) {
  return invokeOwnershipWorkflow<{ result: OwnershipChange }>({
    action: "submit-change",
    changeId,
    expectedVersion,
  });
}

export function decideOwnershipChange(input: {
  changeId: string;
  expectedVersion: number;
  approve: boolean;
  reason?: string;
}) {
  return invokeOwnershipWorkflow<{ result: OwnershipChange }>({
    action: input.approve ? "approve-change" : "reject-change",
    changeId: input.changeId,
    expectedVersion: input.expectedVersion,
    reason: input.reason,
  });
}

export function applyOwnershipChange(changeId: string, expectedVersion: number) {
  return invokeOwnershipWorkflow<{ result: OwnershipChange }>({
    action: "apply-change",
    changeId,
    expectedVersion,
  });
}

export async function createCorporateDocument(
  values: Record<string, unknown>,
): Promise<GovernanceDocument> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("governance_documents")
    .insert(values)
    .select("*")
    .single();
  if (error) throw error;
  return data as GovernanceDocument;
}

export async function approveCorporateResolution(
  resolutionId: string,
  expectedVersion: number,
): Promise<CorporateResolution> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.functions.invoke("admin-corporate-ownership", {
    body: { action: "approve-resolution", resolutionId, expectedVersion },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data.result as CorporateResolution;
}
