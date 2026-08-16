import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface WorkspaceUnitOption {
  id: string;
  code: string;
  name: string;
}

export interface WorkspacePeriodOption {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: string;
}

export interface WorkspaceOptions {
  units: WorkspaceUnitOption[];
  periods: WorkspacePeriodOption[];
}

export async function listWorkspaceOptions(): Promise<WorkspaceOptions> {
  const client = getSupabaseBrowserClient();
  const [unitsResult, periodsResult] = await Promise.all([
    client
      .from("business_units")
      .select("id,code,name,status")
      .eq("status", "active")
      .order("code"),
    client
      .from("financial_periods")
      .select("id,period_start,period_end,status")
      .order("period_start", { ascending: false })
      .limit(36),
  ]);

  if (unitsResult.error) throw unitsResult.error;
  if (periodsResult.error) throw periodsResult.error;

  return {
    units: (unitsResult.data ?? []).map((row) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
    })),
    periods: (periodsResult.data ?? []).map((row) => ({
      id: String(row.id),
      periodStart: String(row.period_start),
      periodEnd: String(row.period_end),
      status: String(row.status),
    })),
  };
}
