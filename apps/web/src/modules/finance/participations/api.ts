import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  ContractOption,
  ContractVersionOption,
  NamedOption,
  ParticipationApproval,
  ParticipationCalculation,
  ParticipationLine,
  PartyOption,
  PeriodOption,
} from "./types";

export interface ParticipationCalculationWorkspace {
  calculations: ParticipationCalculation[];
  lines: ParticipationLine[];
  approvals: ParticipationApproval[];
  contracts: ContractOption[];
  contractVersions: ContractVersionOption[];
  parties: PartyOption[];
  businessUnits: NamedOption[];
  products: NamedOption[];
  serviceLines: NamedOption[];
  periods: PeriodOption[];
  currencies: Array<{ code: string; name: string; symbol: string }>;
}

export async function listParticipationWorkspace(): Promise<ParticipationCalculationWorkspace> {
  const client = getSupabaseBrowserClient();
  const [
    calculations,
    lines,
    approvals,
    contracts,
    contractVersions,
    parties,
    businessUnits,
    products,
    serviceLines,
    periods,
    currencies,
  ] = await Promise.all([
    client.from("participation_calculations").select("*").order("created_at", { ascending: false }),
    client.from("participation_calculation_lines").select("*").order("sequence_no"),
    client.from("participation_approvals").select("*").order("requested_at", { ascending: false }),
    client
      .from("contracts")
      .select(
        "id,legal_entity_id,business_unit_id,product_id,service_line_id,code,title,currency_code,status",
      )
      .order("code"),
    client
      .from("contract_versions")
      .select("id,contract_id,version_number,effective_from,effective_to,payment_term_days,status")
      .order("version_number", { ascending: false }),
    client.from("parties").select("id,legal_name,trade_name,status").order("legal_name"),
    client.from("business_units").select("id,code,name,legal_entity_id,status").order("name"),
    client.from("products").select("id,code,name,business_unit_id,status").order("name"),
    client.from("service_lines").select("id,code,name,business_unit_id,status").order("name"),
    client
      .from("financial_periods")
      .select("id,legal_entity_id,period_start,period_end,status")
      .order("period_start", { ascending: false }),
    client.from("currencies").select("code,name,symbol").eq("is_active", true).order("code"),
  ]);

  const failed = [
    calculations,
    lines,
    approvals,
    contracts,
    contractVersions,
    parties,
    businessUnits,
    products,
    serviceLines,
    periods,
    currencies,
  ].find((result) => result.error);
  if (failed?.error) throw failed.error;

  return {
    calculations: (calculations.data ?? []) as ParticipationCalculation[],
    lines: (lines.data ?? []) as ParticipationLine[],
    approvals: (approvals.data ?? []) as ParticipationApproval[],
    contracts: (contracts.data ?? []) as ContractOption[],
    contractVersions: (contractVersions.data ?? []) as ContractVersionOption[],
    parties: (parties.data ?? []) as PartyOption[],
    businessUnits: (businessUnits.data ?? []) as NamedOption[],
    products: (products.data ?? []) as NamedOption[],
    serviceLines: (serviceLines.data ?? []) as NamedOption[],
    periods: (periods.data ?? []) as PeriodOption[],
    currencies: (currencies.data ?? []) as Array<{ code: string; name: string; symbol: string }>,
  };
}

export async function createParticipationCalculation(
  values: Record<string, unknown>,
): Promise<ParticipationCalculation> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("participation_calculations")
    .insert(values)
    .select("*")
    .single();
  if (error) throw error;
  return data as ParticipationCalculation;
}

export async function updateParticipationCalculation(
  id: string,
  expectedVersion: number,
  values: Record<string, unknown>,
): Promise<ParticipationCalculation> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("participation_calculations")
    .update(values)
    .eq("id", id)
    .eq("version", expectedVersion)
    .eq("status", "draft")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("A apuração foi alterada por outro usuário.");
  return data as ParticipationCalculation;
}

async function invokeParticipation<T>(body: Record<string, unknown>): Promise<T> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.functions.invoke("admin-participations", { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export function runParticipationAction(input: {
  calculationId: string;
  expectedVersion: number;
  action: "calculate" | "submit" | "approve" | "reject" | "post";
  reason?: string;
}) {
  return invokeParticipation<{ result: ParticipationCalculation }>({ ...input });
}
