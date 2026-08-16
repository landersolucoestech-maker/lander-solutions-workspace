import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { IntegrationConnection, IntegrationDirectory, IntegrationFormInput } from "./types";

async function invokeAdminIntegrations(body: Record<string, unknown>): Promise<unknown> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.functions.invoke("admin-integrations", { body });

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data?.result;
}

export async function listIntegrationDirectory(): Promise<IntegrationDirectory> {
  const client = getSupabaseBrowserClient();
  const [connectionsResult, unitsResult, profilesResult, permissionResult] = await Promise.all([
    client
      .from("integration_connections")
      .select(
        "id,business_unit_id,source_system,information_type,endpoint_url,environment,status,last_sync_at,last_failure_at,last_failure_message,technical_owner_user_id,secret_reference,summary_log,version,created_at,updated_at",
      )
      .order("source_system"),
    client
      .from("business_units")
      .select("id,code,name,status")
      .eq("status", "active")
      .order("name"),
    client
      .from("profiles")
      .select("id,display_name,email,status")
      .eq("status", "active")
      .order("display_name"),
    client.rpc("has_permission", {
      p_permission_code: "settings.integrations.manage",
      p_unit_code: null,
    }),
  ]);

  if (connectionsResult.error) throw connectionsResult.error;
  if (unitsResult.error) throw unitsResult.error;

  return {
    connections: (connectionsResult.data ?? []) as IntegrationConnection[],
    businessUnits: (unitsResult.data ?? []).map((row) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
    })),
    technicalOwners: profilesResult.error
      ? []
      : (profilesResult.data ?? []).map((row) => ({
          id: String(row.id),
          name: String(row.display_name || row.email || row.id),
        })),
    canManage: permissionResult.error ? false : permissionResult.data === true,
  };
}

export async function createIntegration(input: IntegrationFormInput): Promise<void> {
  await invokeAdminIntegrations({ action: "create", ...input });
}

export async function updateIntegration(
  id: string,
  expectedVersion: number,
  input: IntegrationFormInput,
): Promise<void> {
  await invokeAdminIntegrations({ action: "update", id, expectedVersion, ...input });
}

export async function deleteIntegration(id: string, expectedVersion: number): Promise<void> {
  await invokeAdminIntegrations({ action: "delete", id, expectedVersion });
}

export async function recordIntegrationSync(input: {
  id: string;
  expectedVersion: number;
  succeeded: boolean;
  failureMessage?: string;
  summaryLog?: string;
}): Promise<void> {
  await invokeAdminIntegrations({ action: "record-sync", ...input });
}
