import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  AllocationApproval,
  AllocationDistribution,
  AllocationDriverValue,
  AllocationRule,
  AllocationRuleVersion,
  AllocationRun,
  AllocationRunSource,
  AllocationSourceCandidate,
  AllocationTarget,
  AllocationWorkspace,
  FinancialPeriodOption,
  NamedOption,
} from "./types";

export type AllocationWritableTable =
  | "allocation_rules"
  | "allocation_rule_versions"
  | "allocation_rule_targets"
  | "allocation_driver_values"
  | "allocation_runs"
  | "allocation_run_sources";

function requireData<T>(data: T | null, message: string): T {
  if (data === null) throw new Error(message);
  return data;
}

export async function listAllocationWorkspace(): Promise<AllocationWorkspace> {
  const client = getSupabaseBrowserClient();
  const [
    rules,
    versions,
    targets,
    driverValues,
    runs,
    sources,
    distributions,
    approvals,
    sourceCandidates,
    legalEntities,
    businessUnits,
    financialPeriods,
    products,
    serviceLines,
    projects,
    costCenters,
    managerialAccounts,
    categories,
  ] = await Promise.all([
    client.from("allocation_rules").select("*").order("updated_at", { ascending: false }),
    client.from("allocation_rule_versions").select("*").order("version_no", { ascending: false }),
    client.from("allocation_rule_targets").select("*").order("sequence_no"),
    client.from("allocation_driver_values").select("*").order("updated_at", { ascending: false }),
    client.from("allocation_runs").select("*").order("created_at", { ascending: false }),
    client.from("allocation_run_sources").select("*").order("created_at"),
    client.from("allocation_run_distributions").select("*").order("created_at"),
    client.from("allocation_approvals").select("*").order("requested_at", { ascending: false }),
    client
      .from("allocation_source_candidates")
      .select("*")
      .gt("available_amount", 0)
      .order("competence_date", { ascending: false })
      .limit(300),
    client
      .from("legal_entities")
      .select("id,code,legal_name,trade_name,status")
      .order("legal_name"),
    client.from("business_units").select("id,code,name,legal_entity_id,status").order("name"),
    client
      .from("financial_periods")
      .select("id,legal_entity_id,period_start,period_end,status")
      .order("period_start", { ascending: false }),
    client.from("products").select("id,code,name,business_unit_id,status").order("name"),
    client.from("service_lines").select("id,code,name,business_unit_id,status").order("name"),
    client.from("projects").select("id,code,name,business_unit_id,status").order("name"),
    client.from("cost_centers").select("id,code,name,business_unit_id,status").order("name"),
    client.from("managerial_accounts").select("id,code,name,status").order("code"),
    client.from("financial_categories").select("id,code,name,status").order("code"),
  ]);

  const results = [
    rules,
    versions,
    targets,
    driverValues,
    runs,
    sources,
    distributions,
    approvals,
    sourceCandidates,
    legalEntities,
    businessUnits,
    financialPeriods,
    products,
    serviceLines,
    projects,
    costCenters,
    managerialAccounts,
    categories,
  ];
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;

  return {
    rules: (rules.data ?? []) as AllocationRule[],
    versions: (versions.data ?? []) as AllocationRuleVersion[],
    targets: (targets.data ?? []) as AllocationTarget[],
    driverValues: (driverValues.data ?? []) as AllocationDriverValue[],
    runs: (runs.data ?? []) as AllocationRun[],
    sources: (sources.data ?? []) as AllocationRunSource[],
    distributions: (distributions.data ?? []) as AllocationDistribution[],
    approvals: (approvals.data ?? []) as AllocationApproval[],
    sourceCandidates: (sourceCandidates.data ?? []) as AllocationSourceCandidate[],
    legalEntities: (legalEntities.data ?? []).map((item) => ({
      id: String(item.id),
      code: String(item.code),
      name: String(item.trade_name || item.legal_name),
      status: String(item.status),
    })),
    businessUnits: (businessUnits.data ?? []) as NamedOption[],
    financialPeriods: (financialPeriods.data ?? []) as FinancialPeriodOption[],
    products: (products.data ?? []) as NamedOption[],
    serviceLines: (serviceLines.data ?? []) as NamedOption[],
    projects: (projects.data ?? []) as NamedOption[],
    costCenters: (costCenters.data ?? []) as NamedOption[],
    managerialAccounts: (managerialAccounts.data ?? []) as NamedOption[],
    categories: (categories.data ?? []) as NamedOption[],
  };
}

export async function createAllocationRecord<T>(
  table: AllocationWritableTable,
  values: Record<string, unknown>,
): Promise<T> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.from(table).insert(values).select("*").single();
  if (error) throw error;
  return data as T;
}

export async function updateAllocationRecord<T>(
  table: AllocationWritableTable,
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

export async function deleteAllocationRecord(
  table: AllocationWritableTable,
  id: string,
): Promise<void> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.from(table).delete().eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  requireData(data, "O registro não foi excluído ou não está mais disponível.");
}

async function invokeAllocationAction<T>(body: Record<string, unknown>): Promise<T> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.functions.invoke("admin-allocations", { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export function submitAllocationVersion(versionId: string, expectedVersion: number) {
  return invokeAllocationAction<{ version: AllocationRuleVersion }>({
    action: "submit-rule-version",
    versionId,
    expectedVersion,
  });
}

export function decideAllocationVersion(input: {
  versionId: string;
  expectedVersion: number;
  approve: boolean;
  reason?: string;
}) {
  return invokeAllocationAction<{ version: AllocationRuleVersion }>({
    action: input.approve ? "approve-rule-version" : "reject-rule-version",
    versionId: input.versionId,
    expectedVersion: input.expectedVersion,
    reason: input.reason,
  });
}

export function runAllocationAction(input: {
  runId: string;
  expectedVersion: number;
  action: "simulate-run" | "submit-run" | "approve-run" | "reject-run" | "post-run";
  reason?: string;
}) {
  return invokeAllocationAction<{ run: AllocationRun }>({ ...input });
}

export function reverseAllocationRun(input: {
  runId: string;
  expectedVersion: number;
  reversalDate: string;
  reason: string;
}) {
  return invokeAllocationAction<{ run: AllocationRun }>({
    action: "reverse-run",
    ...input,
  });
}
