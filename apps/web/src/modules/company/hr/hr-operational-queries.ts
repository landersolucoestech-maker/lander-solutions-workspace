import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { EmployeePayment, LeaveRequest } from "./types";

export async function getLeaveRequestDetail(requestId: string): Promise<LeaveRequest> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("leave_requests")
    .select(
      "id,employee_id,leave_type_id,start_date,end_date,duration_days,reason,document_storage_path,status,manager_employee_id,decision_at,rejection_reason,notes,version",
    )
    .eq("id", requestId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Solicitação de ausência não encontrada ou sem acesso.");
  return data as LeaveRequest;
}

export async function getEmployeePaymentDetail(paymentId: string): Promise<EmployeePayment> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("employee_payments")
    .select(
      "id,employee_id,contract_id,competence,description,base_amount,additions,informational_deductions,final_amount,expected_date,payment_date,payment_method,status,proof_storage_path,notes,version",
    )
    .eq("id", paymentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Pagamento não encontrado ou sem acesso.");
  return data as EmployeePayment;
}
