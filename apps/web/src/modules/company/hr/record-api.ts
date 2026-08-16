import { clientEnv } from "@/lib/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const DEVELOPMENT_PROJECT_REF = "jodzhcktrlwinywqgbab";

function requireDevelopmentRuntime() {
  if (clientEnv.VITE_EXPECTED_SUPABASE_REF !== DEVELOPMENT_PROJECT_REF) {
    throw new Error(
      "Esta operação temporária está disponível somente no ambiente de desenvolvimento.",
    );
  }
}

async function invokeDevRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  requireDevelopmentRuntime();
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  if (data === null) throw new Error("A operação não retornou o registro atualizado.");
  return data as T;
}

export async function updateHrEmployeeRecord(payload: Record<string, unknown>) {
  return invokeDevRpc<Record<string, unknown>>("dev_update_hr_employee", { p_payload: payload });
}

export async function updateHrPaymentRecord(payload: Record<string, unknown>) {
  return invokeDevRpc<Record<string, unknown>>("dev_update_hr_payment", { p_payload: payload });
}

export async function updateHrLeaveRecord(payload: Record<string, unknown>) {
  return invokeDevRpc<Record<string, unknown>>("dev_update_hr_leave", { p_payload: payload });
}

export async function updateHrDocumentRecord(payload: Record<string, unknown>) {
  return invokeDevRpc<Record<string, unknown>>("dev_update_hr_document", { p_payload: payload });
}

export async function deleteHrRecord(
  entity: "employee" | "payment" | "leave" | "document",
  id: string,
  expectedVersion: number,
) {
  return invokeDevRpc<Record<string, unknown>>("dev_delete_hr_record", {
    p_entity: entity,
    p_id: id,
    p_expected_version: expectedVersion,
  });
}
