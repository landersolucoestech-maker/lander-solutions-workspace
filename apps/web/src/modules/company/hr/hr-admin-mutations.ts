import { getSupabaseBrowserClient } from "@/lib/supabase/client";

async function invokeAdminHr<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.functions.invoke("admin-hr", { body });

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data?.result as T;
}

export async function updateEmployee(input: Record<string, unknown>): Promise<void> {
  await invokeAdminHr({ action: "update-employee", ...input });
}

export async function updateContract(input: Record<string, unknown>): Promise<void> {
  await invokeAdminHr({ action: "update-contract", ...input });
}

export async function closeContract(input: {
  contractId: string;
  endDate: string;
  expectedVersion: number;
}): Promise<void> {
  await invokeAdminHr({ action: "close-contract", ...input });
}

export async function deleteEmployeeDocument(input: {
  documentId: string;
  expectedVersion: number;
}): Promise<void> {
  await invokeAdminHr({ action: "delete-document", ...input });
}

export async function updateLeave(input: Record<string, unknown>): Promise<void> {
  await invokeAdminHr({ action: "update-leave", ...input });
}

export async function updatePayment(input: Record<string, unknown>): Promise<void> {
  await invokeAdminHr({ action: "update-payment", ...input });
}

export async function updatePosition(input: Record<string, unknown>): Promise<void> {
  await invokeAdminHr({ action: "update-position", ...input });
}
