import { AUTHENTICATION_ENABLED } from "@/config/authentication";
import { clientEnv } from "@/lib/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  EmployeeAccess,
  EmployeeDirectoryRow,
  EmployeeDocument,
  EmployeePayment,
  EmployeeSensitiveDetail,
  EmploymentContract,
  Equipment,
  EquipmentAssignment,
  HrDashboardSummary,
  HrDirectory,
  HrOption,
  HrPermissions,
  HrSetting,
  LeaveRequest,
  OffboardingProcess,
  OnboardingProcess,
  ProcessTask,
} from "./types";

const emptySummary: HrDashboardSummary = {
  activeEmployees: 0,
  awayEmployees: 0,
  terminatedEmployees: 0,
  employeesByUnit: [],
  expiringContracts: 0,
  expiringDocuments: 0,
  upcomingLeaves: 0,
  pendingOnboardings: 0,
  activeOffboardings: 0,
  pendingEquipmentReturns: 0,
  pendingPayments: 0,
  birthdaysThisMonth: 0,
};

const authenticationDisabledInDevelopment =
  clientEnv.VITE_APP_ENV === "development" && !AUTHENTICATION_ENABLED;

function isDevelopmentPermissionDenial(error: { code?: string } | null): boolean {
  return authenticationDisabledInDevelopment && error?.code === "42501";
}

async function invokeAdminHr<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.functions.invoke("admin-hr", { body });

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data?.result as T;
}

async function hasAnyPermission(permissionCode: string, unitCodes: string[]): Promise<boolean> {
  const client = getSupabaseBrowserClient();
  const scopes: Array<string | null> = [null, ...unitCodes];
  const results = await Promise.all(
    scopes.map((unitCode) =>
      client.rpc("has_permission", {
        p_permission_code: permissionCode,
        p_unit_code: unitCode,
      }),
    ),
  );
  return results.some((result) => !result.error && result.data === true);
}

function toHrCondition(value: unknown): string {
  switch (String(value ?? "unknown")) {
    case "new":
      return "NOVO";
    case "good":
      return "BOM";
    case "fair":
      return "REGULAR";
    case "damaged":
      return "DANIFICADO";
    default:
      return "REGULAR";
  }
}

function toHrAssetStatus(value: unknown, assigned: boolean): string {
  if (assigned) return "ATRIBUIDO";
  switch (String(value ?? "active")) {
    case "maintenance":
      return "EM_MANUTENCAO";
    case "disposed":
      return "BAIXADO";
    case "inactive":
    case "lost":
    case "cancelled":
      return "BAIXADO";
    default:
      return "DISPONIVEL";
  }
}

export async function listHrDirectory(): Promise<HrDirectory> {
  const client = getSupabaseBrowserClient();
  const [summaryResult, employeesResult, unitsResult] = await Promise.all([
    client.rpc("hr_dashboard_summary", { p_unit_code: null }),
    client.rpc("hr_employee_directory", { p_unit_code: null }),
    client
      .from("business_units")
      .select("id,code,name,status")
      .eq("status", "active")
      .order("name"),
  ]);

  if (summaryResult.error && !isDevelopmentPermissionDenial(summaryResult.error)) {
    throw summaryResult.error;
  }
  if (employeesResult.error && !isDevelopmentPermissionDenial(employeesResult.error)) {
    throw employeesResult.error;
  }
  if (unitsResult.error) throw unitsResult.error;

  const businessUnits: HrOption[] = (unitsResult.data ?? []).map((row) => ({
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
  }));
  const unitCodes = businessUnits
    .map((unit) => unit.code)
    .filter((code): code is string => Boolean(code));

  const [
    departmentsResult,
    positionsResult,
    entitiesResult,
    usersResult,
    documentTypesResult,
    leaveTypesResult,
    contractsResult,
    documentsResult,
    leavesResult,
    paymentsResult,
    onboardingsResult,
    onboardingTasksResult,
    offboardingsResult,
    offboardingTasksResult,
    equipmentResult,
    assignmentsResult,
    accessesResult,
    settingsResult,
    manageEmployees,
    manageContracts,
    manageDocuments,
    manageLeave,
    approveLeave,
    managePayments,
    manageOnboarding,
    manageOffboarding,
    manageAccesses,
    manageSettings,
  ] = await Promise.all([
    client.from("departments").select("id,name,business_unit_id").order("name"),
    client
      .from("positions")
      .select("id,code,name,business_unit_id,department_id,status")
      .eq("status", "active")
      .order("name"),
    client
      .from("legal_entities")
      .select("id,code,legal_name,trade_name,status")
      .eq("status", "active"),
    client.from("profiles").select("id,display_name,email,status").eq("status", "active"),
    client
      .from("document_types")
      .select("id,code,name,status")
      .eq("status", "active")
      .order("name"),
    client.from("leave_types").select("id,code,name,status").eq("status", "active").order("name"),
    client
      .from("employment_contracts")
      .select(
        "id,employee_id,legal_entity_id,business_unit_id,position_id,contract_type,start_date,end_date,amount,payment_frequency,payment_method,work_schedule,work_mode,status,file_path,notes,is_primary,version",
      )
      .order("start_date", { ascending: false }),
    client
      .from("employee_documents")
      .select(
        "id,employee_id,document_type_id,name,original_file_name,mime_type,size_bytes,issued_at,expires_at,visibility,status,version,uploaded_at",
      )
      .order("uploaded_at", { ascending: false }),
    client
      .from("leave_requests")
      .select(
        "id,employee_id,leave_type_id,start_date,end_date,duration_days,reason,status,manager_employee_id,decision_at,rejection_reason,version",
      )
      .order("start_date", { ascending: false }),
    client
      .from("employee_payments")
      .select(
        "id,employee_id,contract_id,competence,description,base_amount,additions,informational_deductions,final_amount,expected_date,payment_date,payment_method,status,version",
      )
      .order("competence", { ascending: false }),
    client
      .from("onboarding_processes")
      .select(
        "id,employee_id,expected_start_date,responsible_user_id,status,completion_percentage,notes,version",
      )
      .order("expected_start_date", { ascending: false }),
    client
      .from("onboarding_tasks")
      .select(
        "id,onboarding_process_id,title,responsible_user_id,due_date,required,status,notes,sort_order,version",
      )
      .order("sort_order"),
    client
      .from("offboarding_processes")
      .select(
        "id,employee_id,last_working_day,effective_termination_date,reason,responsible_user_id,status,financial_pending,document_pending,equipment_pending,access_pending,version",
      )
      .order("last_working_day", { ascending: false }),
    client
      .from("offboarding_tasks")
      .select(
        "id,offboarding_process_id,title,responsible_user_id,due_date,required,status,notes,sort_order,version",
      )
      .order("sort_order"),
    client
      .from("corporate_assets")
      .select(
        "id,business_unit_id,asset_type,equipment_type,name,manufacturer,model,serial_number,asset_tag,operational_condition,status,notes,version",
      )
      .eq("asset_category", "equipment")
      .order("name"),
    client
      .from("asset_assignments")
      .select(
        "id,asset_id,employee_id,delivered_at,expected_return_date,returned_at,delivery_condition,return_condition,status,notes,version",
      )
      .order("delivered_at", { ascending: false }),
    client
      .from("employee_accesses")
      .select(
        "id,employee_id,platform,account_identifier,access_type,granted_at,status,revoked_at,notes,version",
      )
      .order("platform"),
    client
      .from("hr_settings")
      .select("id,business_unit_id,contract_expiry_alert_days,document_expiry_alert_days,version"),
    hasAnyPermission("hr.employees.manage", unitCodes),
    hasAnyPermission("hr.contracts.manage", unitCodes),
    hasAnyPermission("hr.documents.manage", unitCodes),
    hasAnyPermission("hr.leave.manage", unitCodes),
    hasAnyPermission("hr.leave.approve", unitCodes),
    hasAnyPermission("hr.payments.manage", unitCodes),
    hasAnyPermission("hr.onboarding.manage", unitCodes),
    hasAnyPermission("hr.offboarding.manage", unitCodes),
    hasAnyPermission("hr.accesses.manage", unitCodes),
    hasAnyPermission("hr.settings.manage", unitCodes),
  ]);

  const requiredResults = [
    departmentsResult,
    positionsResult,
    entitiesResult,
    documentTypesResult,
    leaveTypesResult,
    contractsResult,
    documentsResult,
    leavesResult,
    paymentsResult,
    onboardingsResult,
    onboardingTasksResult,
    offboardingsResult,
    offboardingTasksResult,
    equipmentResult,
    assignmentsResult,
    accessesResult,
    settingsResult,
  ];
  const failedResult = requiredResults.find((result) => result.error);
  if (failedResult?.error) throw failedResult.error;

  const assignments: EquipmentAssignment[] = (assignmentsResult.data ?? []).map((row) => ({
    id: String(row.id),
    equipment_id: String(row.asset_id),
    employee_id: String(row.employee_id),
    delivered_at: String(row.delivered_at),
    expected_return_date: row.expected_return_date ? String(row.expected_return_date) : null,
    returned_at: row.returned_at ? String(row.returned_at) : null,
    delivery_condition: toHrCondition(row.delivery_condition),
    return_condition: row.return_condition ? toHrCondition(row.return_condition) : null,
    status: row.status === "active" ? "ATIVO" : "DEVOLVIDO",
    notes: row.notes ? String(row.notes) : null,
    version: Number(row.version),
  }));
  const assignedAssetIds = new Set(
    assignments
      .filter((assignment) => assignment.status === "ATIVO")
      .map((assignment) => assignment.equipment_id),
  );
  const equipment: Equipment[] = (equipmentResult.data ?? []).map((row) => ({
    id: String(row.id),
    business_unit_id: row.business_unit_id ? String(row.business_unit_id) : null,
    equipment_type: String(row.equipment_type || row.asset_type || "OUTRO").toUpperCase(),
    name: String(row.name),
    manufacturer: row.manufacturer ? String(row.manufacturer) : null,
    model: row.model ? String(row.model) : null,
    serial_number: row.serial_number ? String(row.serial_number) : null,
    asset_number: row.asset_tag ? String(row.asset_tag) : null,
    condition: toHrCondition(row.operational_condition),
    status: toHrAssetStatus(row.status, assignedAssetIds.has(String(row.id))),
    notes: row.notes ? String(row.notes) : null,
    version: Number(row.version),
  }));

  const permissions: HrPermissions = {
    manageEmployees,
    manageContracts,
    manageDocuments,
    manageLeave,
    approveLeave,
    managePayments,
    manageOnboarding,
    manageOffboarding,
    manageAccesses,
    manageSettings,
  };

  return {
    summary: (summaryResult.error
      ? emptySummary
      : (summaryResult.data ?? emptySummary)) as HrDashboardSummary,
    employees: (employeesResult.error
      ? []
      : (employeesResult.data ?? [])) as EmployeeDirectoryRow[],
    businessUnits,
    departments: (departmentsResult.data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      businessUnitId: row.business_unit_id ? String(row.business_unit_id) : null,
    })),
    positions: (positionsResult.data ?? []).map((row) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      businessUnitId: row.business_unit_id ? String(row.business_unit_id) : null,
    })),
    legalEntities: (entitiesResult.data ?? []).map((row) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.trade_name || row.legal_name),
    })),
    users: usersResult.error
      ? []
      : (usersResult.data ?? []).map((row) => ({
          id: String(row.id),
          name: String(row.display_name || row.email || row.id),
        })),
    documentTypes: (documentTypesResult.data ?? []).map((row) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
    })),
    leaveTypes: (leaveTypesResult.data ?? []).map((row) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
    })),
    contracts: (contractsResult.data ?? []) as EmploymentContract[],
    documents: (documentsResult.data ?? []) as EmployeeDocument[],
    leaves: (leavesResult.data ?? []) as LeaveRequest[],
    payments: (paymentsResult.data ?? []) as EmployeePayment[],
    onboardings: (onboardingsResult.data ?? []) as OnboardingProcess[],
    onboardingTasks: (onboardingTasksResult.data ?? []) as ProcessTask[],
    offboardings: (offboardingsResult.data ?? []) as OffboardingProcess[],
    offboardingTasks: (offboardingTasksResult.data ?? []) as ProcessTask[],
    equipment,
    assignments,
    accesses: (accessesResult.data ?? []) as EmployeeAccess[],
    settings: (settingsResult.data ?? []) as HrSetting[],
    permissions,
  };
}

export async function getEmployeeSensitiveDetail(
  employeeId: string,
): Promise<EmployeeSensitiveDetail> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.rpc("hr_employee_sensitive_detail", {
    p_employee_id: employeeId,
  });
  if (error) throw error;
  if (!data) throw new Error("Dados do colaborador não encontrados.");
  return data as EmployeeSensitiveDetail;
}

export async function createEmployee(input: Record<string, unknown>): Promise<void> {
  await invokeAdminHr({ action: "create-employee", ...input });
}

export async function createContract(input: Record<string, unknown>): Promise<void> {
  await invokeAdminHr({ action: "create-contract", ...input });
}

export async function createLeave(input: Record<string, unknown>): Promise<void> {
  await invokeAdminHr({ action: "create-leave", ...input });
}

export async function decideLeave(input: {
  requestId: string;
  decision: "APROVADO" | "RECUSADO";
  rejectionReason?: string;
  expectedVersion: number;
}): Promise<void> {
  await invokeAdminHr({ action: "decide-leave", ...input });
}

export async function createPayment(input: Record<string, unknown>): Promise<void> {
  await invokeAdminHr({ action: "create-payment", ...input });
}

export async function markPaymentPaid(input: Record<string, unknown>): Promise<void> {
  await invokeAdminHr({ action: "mark-payment-paid", ...input });
}

export async function createOnboarding(input: Record<string, unknown>): Promise<void> {
  await invokeAdminHr({ action: "create-onboarding", ...input });
}

export async function updateOnboardingTask(input: Record<string, unknown>): Promise<void> {
  await invokeAdminHr({ action: "update-onboarding-task", ...input });
}

export async function createOffboarding(input: Record<string, unknown>): Promise<void> {
  await invokeAdminHr({ action: "create-offboarding", ...input });
}

export async function updateOffboardingTask(input: Record<string, unknown>): Promise<void> {
  await invokeAdminHr({ action: "update-offboarding-task", ...input });
}

export async function completeOffboarding(input: Record<string, unknown>): Promise<void> {
  await invokeAdminHr({ action: "complete-offboarding", ...input });
}

export async function createAccess(input: Record<string, unknown>): Promise<void> {
  await invokeAdminHr({ action: "create-access", ...input });
}

export async function revokeAccess(input: Record<string, unknown>): Promise<void> {
  await invokeAdminHr({ action: "revoke-access", ...input });
}

export async function upsertHrSettings(input: Record<string, unknown>): Promise<void> {
  await invokeAdminHr({ action: "upsert-settings", ...input });
}

export async function uploadEmployeeDocument(input: {
  employeeId: string;
  documentTypeId: string;
  name: string;
  visibility: string;
  issuedAt?: string;
  expiresAt?: string;
  notes?: string;
  file: File;
}): Promise<void> {
  const upload = await invokeAdminHr<{
    path: string;
    token: string;
    storagePath: string;
  }>({
    action: "create-document-upload",
    employeeId: input.employeeId,
    mimeType: input.file.type,
    sizeBytes: input.file.size,
  });

  const client = getSupabaseBrowserClient();
  const { error: uploadError } = await client.storage
    .from("hr-documents")
    .uploadToSignedUrl(upload.path, upload.token, input.file, {
      contentType: input.file.type,
      upsert: false,
    });
  if (uploadError) throw uploadError;

  await invokeAdminHr({
    action: "register-document",
    employeeId: input.employeeId,
    documentTypeId: input.documentTypeId,
    name: input.name,
    storagePath: upload.storagePath,
    originalFileName: input.file.name,
    mimeType: input.file.type,
    sizeBytes: input.file.size,
    visibility: input.visibility,
    issuedAt: input.issuedAt || null,
    expiresAt: input.expiresAt || null,
    notes: input.notes || null,
  });
}

export async function downloadEmployeeDocument(documentId: string): Promise<void> {
  const result = await invokeAdminHr<{ signedUrl: string }>({
    action: "download-document",
    documentId,
  });
  window.open(result.signedUrl, "_blank", "noopener,noreferrer");
}
