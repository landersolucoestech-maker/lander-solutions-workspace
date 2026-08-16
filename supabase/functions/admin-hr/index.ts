import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "https://lander-solutions-git-dev-lander-sistemas-projects.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonRecord = Record<string, unknown>;
type AdminClient = SupabaseClient;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_MIME_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function requiredString(value: unknown, field: string, maxLength = 500): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} é obrigatório.`);
  }
  const result = value.trim();
  if (result.length > maxLength) throw new Error(`${field} excede o limite permitido.`);
  return result;
}

function optionalString(value: unknown, maxLength = 5000): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("Valor textual inválido.");
  const result = value.trim();
  if (result.length > maxLength) throw new Error("Valor textual excede o limite permitido.");
  return result || null;
}

function requiredDate(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} inválida.`);
  }
  return value;
}

function optionalDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return requiredDate(value, "Data");
}

function requiredNumber(value: unknown, field: string, minimum = 0): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum) throw new Error(`${field} inválido.`);
  return number;
}

function requiredVersion(value: unknown): number {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) throw new Error("Versão esperada inválida.");
  return version;
}

function nullableUuid(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (!isUuid(value)) throw new Error(`${field} inválido.`);
  return value;
}

async function unitCodeFromBusinessUnit(admin: AdminClient, businessUnitId: string) {
  const { data, error } = await admin
    .from("business_units")
    .select("code")
    .eq("id", businessUnitId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Unidade de negócio não encontrada.");
  return data.code as string;
}

async function employeeContext(admin: AdminClient, employeeId: string) {
  const { data, error } = await admin
    .from("employees")
    .select("id,user_id,business_unit_id,status,version,person_id")
    .eq("id", employeeId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Colaborador não encontrado.");
  const unitCode = await unitCodeFromBusinessUnit(admin, data.business_unit_id);
  return { ...data, unitCode };
}

async function requirePermission(
  caller: SupabaseClient,
  permission: string,
  unitCode: string | null,
) {
  const { data, error } = await caller.rpc("has_permission", {
    p_permission_code: permission,
    p_unit_code: unitCode,
  });
  if (error || !data) {
    const permissionError = new Error("Permissão insuficiente.");
    permissionError.name = "PermissionError";
    throw permissionError;
  }
}

async function isCurrentEmployee(admin: AdminClient, employeeId: string, userId: string) {
  const { data, error } = await admin
    .from("employees")
    .select("id")
    .eq("id", employeeId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function processEmployeeId(
  admin: AdminClient,
  table: "onboarding_processes" | "offboarding_processes",
  id: string,
) {
  const { data, error } = await admin
    .from(table)
    .select("employee_id,version,status")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Processo não encontrado.");
  return data;
}

async function logDocumentAccess(
  admin: AdminClient,
  actorUserId: string,
  documentId: string,
  employeeId: string,
  unitCode: string,
) {
  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: "download",
    entity_schema: "public",
    entity_table: "employee_documents",
    entity_id: documentId,
    metadata: { module: "hr", employee_id: employeeId, unit_code: unitCode },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer "))
    return json({ error: "Autenticação obrigatória." }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey)
    return json({ error: "Configuração interna incompleta." }, 500);
  let payload: JsonRecord;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Corpo JSON inválido." }, 400);
  }
  const action = typeof payload.action === "string" ? payload.action : "";
  if (!action) return json({ error: "Ação obrigatória." }, 400);
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authorization.slice("Bearer ".length);
  const { data: userData, error: userError } = await callerClient.auth.getUser(token);
  const caller = userData.user;
  if (userError || !caller) return json({ error: "Sessão inválida ou expirada." }, 401);
  const { data: aal2, error: aalError } = await callerClient.rpc("has_aal2");
  if (aalError || !aal2) return json({ error: "A operação exige MFA aal2." }, 403);

  try {
    switch (action) {
      case "create-employee": {
        if (!isUuid(payload.businessUnitId))
          throw new Error("Unidade de negócio inválida.");
        const unitCode = await unitCodeFromBusinessUnit(adminClient, payload.businessUnitId);
        await requirePermission(callerClient, "hr.employees.manage", unitCode);
        const { data, error } = await callerClient.rpc("create_hr_employee", {
          p_legal_name: requiredString(payload.legalName, "Nome completo", 200),
          p_social_name: optionalString(payload.socialName, 200),
          p_cpf: requiredString(payload.cpf, "CPF", 20),
          p_birth_date: requiredDate(payload.birthDate, "Data de nascimento"),
          p_personal_email: optionalString(payload.personalEmail, 320),
          p_phone: optionalString(payload.phone, 40),
          p_address_line: optionalString(payload.addressLine, 500),
          p_city: optionalString(payload.city, 160),
          p_state: optionalString(payload.state, 2),
          p_postal_code: optionalString(payload.postalCode, 20),
          p_emergency_contact_name: optionalString(payload.emergencyContactName, 200),
          p_emergency_contact_phone: optionalString(payload.emergencyContactPhone, 40),
          p_photo_path: optionalString(payload.photoPath, 1000),
          p_user_id: nullableUuid(payload.userId, "Usuário"),
          p_corporate_email: optionalString(payload.corporateEmail, 320),
          p_business_unit_id: payload.businessUnitId,
          p_department_id: nullableUuid(payload.departmentId, "Departamento"),
          p_position_id: nullableUuid(payload.positionId, "Cargo"),
          p_manager_employee_id: nullableUuid(payload.managerEmployeeId, "Gestor"),
          p_hire_date: requiredDate(payload.hireDate, "Data de entrada"),
          p_employment_type: requiredString(
            payload.employmentType,
            "Tipo de contratação",
            30,
          ),
          p_work_schedule: optionalString(payload.workSchedule, 200),
          p_work_mode: requiredString(payload.workMode, "Modalidade", 30),
          p_status: requiredString(payload.status ?? "ATIVO", "Status", 30),
          p_internal_notes: optionalString(payload.internalNotes, 5000),

          });
        if (error) throw error;
        return json({ result: data }, 201);
      }
      case "update-employee": {
        if (!isUuid(payload.employeeId) || !isUuid(payload.businessUnitId))
          throw new Error("Colaborador ou unidade inválida.");
        const current = await employeeContext(adminClient, payload.employeeId);
        await requirePermission(callerClient, "hr.employees.manage", current.unitCode);
        const targetUnit = await unitCodeFromBusinessUnit(adminClient, payload.businessUnitId);
        if (targetUnit !== current.unitCode)
          await requirePermission(callerClient, "hr.employees.manage", targetUnit);
        const { data, error } = await callerClient.rpc("update_hr_employee", {
          p_employee_id: payload.employeeId,
          p_employee_expected_version: requiredVersion(payload.employeeExpectedVersion),
          p_person_expected_version: requiredVersion(payload.personExpectedVersion),
          p_legal_name: requiredString(payload.legalName, "Nome completo", 200),
          p_social_name: optionalString(payload.socialName, 200),
          p_birth_date: requiredDate(payload.birthDate, "Data de nascimento"),
          p_personal_email: optionalString(payload.personalEmail, 320),
          p_phone: optionalString(payload.phone, 40),
          p_address_line: optionalString(payload.addressLine, 500),
          p_city: optionalString(payload.city, 160),
          p_state: optionalString(payload.state, 2),
          p_postal_code: optionalString(payload.postalCode, 20),
          p_emergency_contact_name: optionalString(payload.emergencyContactName, 200),
          p_emergency_contact_phone: optionalString(payload.emergencyContactPhone, 40),
          p_photo_path: optionalString(payload.photoPath, 1000),
          p_user_id: nullableUuid(payload.userId, "Usuário"),
          p_corporate_email: optionalString(payload.corporateEmail, 320),
          p_business_unit_id: payload.businessUnitId,
          p_department_id: nullableUuid(payload.departmentId, "Departamento"),
          p_position_id: nullableUuid(payload.positionId, "Cargo"),
          p_manager_employee_id: nullableUuid(payload.managerEmployeeId, "Gestor"),
          p_hire_date: requiredDate(payload.hireDate, "Data de entrada"),
          p_employment_type: requiredString(
            payload.employmentType,
            "Tipo de contratação",
            30,
          ),
          p_work_schedule: optionalString(payload.workSchedule, 200),
          p_work_mode: requiredString(payload.workMode, "Modalidade", 30),
          p_status: requiredString(payload.status, "Status", 30),
          p_internal_notes: optionalString(payload.internalNotes, 5000),

          });
        if (error) throw error;
        return json({ result: data });
      }
      case "create-contract": {
        if (!isUuid(payload.employeeId) || !isUuid(payload.legalEntityId))
          throw new Error("Colaborador ou empresa contratante inválida.");
        const employee = await employeeContext(adminClient, payload.employeeId);
        await requirePermission(callerClient, "hr.contracts.manage", employee.unitCode);
        const amount =
          payload.amount === null || payload.amount === undefined || payload.amount === ""
            ? null
            : requiredNumber(payload.amount, "Valor");
        const { data, error } = await callerClient.rpc("create_hr_contract", {
          p_employee_id: payload.employeeId,
          p_legal_entity_id: payload.legalEntityId,
          p_position_id: nullableUuid(payload.positionId, "Cargo"),
          p_contract_type: requiredString(
            payload.contractType,
            "Tipo de contratação",
            30,
          ),
          p_start_date: requiredDate(payload.startDate, "Data inicial"),
          p_end_date: optionalDate(payload.endDate),
          p_amount: amount,
          p_payment_frequency: optionalString(payload.paymentFrequency, 30),
          p_payment_method: optionalString(payload.paymentMethod, 120),
          p_work_schedule: optionalString(payload.workSchedule, 200),
          p_work_mode: requiredString(payload.workMode, "Modalidade", 30),
          p_status: requiredString(payload.status ?? "RASCUNHO", "Status", 30),
          p_file_path: optionalString(payload.filePath, 1000),
          p_notes: optionalString(payload.notes, 5000),
          p_is_primary: payload.isPrimary !== false,
        });
        if (error) throw error;
        return json({ result: data }, 201);
      }

      case "update-contract":
      case "close-contract": {
        if (!isUuid(payload.contractId)) throw new Error("Contrato inválido.");
        const { data: contract, error: contractError } = await adminClient
          .from("employment_contracts")
          .select("id,employee_id,version,status")
          .eq("id", payload.contractId)
          .is("deleted_at", null)
          .maybeSingle();
        if (contractError) throw contractError;
        if (!contract) throw new Error("Contrato não encontrado.");
        const employee = await employeeContext(adminClient, contract.employee_id);
        await requirePermission(callerClient, "hr.contracts.manage", employee.unitCode);

        if (action === "close-contract") {
          const { data, error } = await callerClient.rpc("close_hr_contract", {
            p_contract_id: payload.contractId,
            p_end_date: requiredDate(payload.endDate, "Data de encerramento"),
            p_expected_version: requiredVersion(payload.expectedVersion),
          });
          if (error) throw error;
          return json({ result: data });
        }

        const amount =
          payload.amount === null || payload.amount === undefined || payload.amount === ""
            ? null
            : requiredNumber(payload.amount, "Valor");
        const { data, error } = await callerClient.rpc("update_hr_contract", {
          p_contract_id: payload.contractId,
          p_expected_version: requiredVersion(payload.expectedVersion),
          p_position_id: nullableUuid(payload.positionId, "Cargo"),
          p_contract_type: requiredString(
            payload.contractType,
            "Tipo de contratação",
            30,
          ),
          p_start_date: requiredDate(payload.startDate, "Data inicial"),
          p_end_date: optionalDate(payload.endDate),
          p_amount: amount,
          p_payment_frequency: optionalString(payload.paymentFrequency, 30),
          p_payment_method: optionalString(payload.paymentMethod, 120),
          p_work_schedule: optionalString(payload.workSchedule, 200),
          p_work_mode: requiredString(payload.workMode, "Modalidade", 30),
          p_status: requiredString(payload.status, "Status", 30),
          p_file_path: optionalString(payload.filePath, 1000),
          p_notes: optionalString(payload.notes, 5000),
          p_is_primary: payload.isPrimary !== false,
        });
        if (error) throw error;
        return json({ result: data });
      }

      case "create-document-upload": {
        if (!isUuid(payload.employeeId)) throw new Error("Colaborador inválido.");
        const employee = await employeeContext(adminClient, payload.employeeId);
        await requirePermission(callerClient, "hr.documents.manage", employee.unitCode);
        const mimeType = requiredString(payload.mimeType, "Tipo MIME", 200);
        const extension = ALLOWED_MIME_TYPES[mimeType];
        if (!extension) throw new Error("Tipo de arquivo não permitido.");
        const size = requiredNumber(payload.sizeBytes, "Tamanho do arquivo", 1);
        if (size > MAX_FILE_SIZE) throw new Error("O arquivo excede o limite de 50 MB.");
        const storagePath = `${payload.employeeId}/${crypto.randomUUID()}.${extension}`;
        const { data, error } = await adminClient.storage
          .from("hr-documents")
          .createSignedUploadUrl(storagePath);
        if (error) throw error;
        return json({ result: { ...data, storagePath } }, 201);
      }
      case "register-document": {
        if (!isUuid(payload.employeeId) || !isUuid(payload.documentTypeId))
          throw new Error("Colaborador ou tipo de documento inválido.");
        const employee = await employeeContext(adminClient, payload.employeeId);
        await requirePermission(callerClient, "hr.documents.manage", employee.unitCode);
        const storagePath = requiredString(payload.storagePath, "Caminho do arquivo", 1000);
        if (!storagePath.startsWith(`${payload.employeeId}/`))
          throw new Error("Caminho de armazenamento inválido.");
        const mimeType = requiredString(payload.mimeType, "Tipo MIME", 200);
        if (!ALLOWED_MIME_TYPES[mimeType]) throw new Error("Tipo de arquivo não permitido.");
        const size = requiredNumber(payload.sizeBytes, "Tamanho do arquivo", 1);
        if (size > MAX_FILE_SIZE) throw new Error("O arquivo excede o limite de 50 MB.");
        const { data, error } = await callerClient.rpc("register_hr_document", {
          p_employee_id: payload.employeeId,
          p_document_type_id: payload.documentTypeId,
          p_name: requiredString(payload.name, "Nome do documento", 250),
          p_storage_path: storagePath,
          p_original_file_name: requiredString(
            payload.originalFileName,
            "Nome original",
            500,
          ),
          p_mime_type: mimeType,
          p_size_bytes: size,
          p_issued_at: optionalDate(payload.issuedAt),
          p_expires_at: optionalDate(payload.expiresAt),
          p_notes: optionalString(payload.notes, 5000),
          p_visibility: requiredString(
            payload.visibility ?? "RH_ONLY",
            "Visibilidade",
            40,
          ),
        });
        if (error) throw error;
        return json({ result: data }, 201);
      }

      case "download-document": {
        if (!isUuid(payload.documentId)) throw new Error("Documento inválido.");
        const { data: document, error: documentError } = await callerClient
          .from("employee_documents")
          .select("id,employee_id,storage_bucket,storage_path")
          .eq("id", payload.documentId)
          .is("deleted_at", null)
          .maybeSingle();
        if (documentError) throw documentError;
        if (!document) throw new Error("Documento não encontrado ou sem acesso.");
        const employee = await employeeContext(adminClient, document.employee_id);
        const { data, error } = await adminClient.storage
          .from(document.storage_bucket)
          .createSignedUrl(document.storage_path, 120);
        if (error) throw error;
        await logDocumentAccess(
          adminClient,
          caller.id,
          document.id,
          document.employee_id,
          employee.unitCode,
        );
        return json({ result: data });
      }
      case "delete-document": {
        if (!isUuid(payload.documentId)) throw new Error("Documento inválido.");
        const { data, error } = await callerClient.rpc("delete_hr_document", {
          p_document_id: payload.documentId,
          p_expected_version: requiredVersion(payload.expectedVersion),
        });
        if (error) throw error;
        return json({ result: data });
      }

      case "create-leave": {
        if (!isUuid(payload.employeeId) || !isUuid(payload.leaveTypeId))
          throw new Error("Colaborador ou tipo de ausência inválido.");
        const employee = await employeeContext(adminClient, payload.employeeId);
        const own = await isCurrentEmployee(adminClient, payload.employeeId, caller.id);
        if (!own) await requirePermission(callerClient, "hr.leave.manage", employee.unitCode);
        const { data, error } = await adminClient
          .from("leave_requests")
          .insert({
            employee_id: payload.employeeId,
            leave_type_id: payload.leaveTypeId,
            start_date: requiredDate(payload.startDate, "Data inicial"),
            end_date: requiredDate(payload.endDate, "Data final"),
            reason: optionalString(payload.reason, 3000),
            document_storage_path: optionalString(payload.documentStoragePath, 1000),
            status: payload.submit === false ? "RASCUNHO" : "SOLICITADO",
            manager_employee_id: nullableUuid(payload.managerEmployeeId, "Gestor"),
            notes: optionalString(payload.notes, 5000),
            requested_by: caller.id,
            created_by: caller.id,
            updated_by: caller.id,
          })
          .select("id,status,version,duration_days")
          .single();
        if (error) throw error;
        return json({ result: data }, 201);
      }
      case "update-leave": {
        if (!isUuid(payload.requestId)) throw new Error("Solicitação inválida.");
        const { data: request, error: requestError } = await adminClient
          .from("leave_requests")
          .select("id,employee_id,status,version")
          .eq("id", payload.requestId)
          .is("deleted_at", null)
          .maybeSingle();
        if (requestError) throw requestError;
        if (!request) throw new Error("Solicitação não encontrada.");
        if (!["RASCUNHO", "SOLICITADO"].includes(request.status))
          throw new Error("A solicitação não pode mais ser editada.");
        const employee = await employeeContext(adminClient, request.employee_id);
        const own = await isCurrentEmployee(adminClient, request.employee_id, caller.id);
        if (!own) await requirePermission(callerClient, "hr.leave.manage", employee.unitCode);
        const { data, error } = await adminClient
          .from("leave_requests")
          .update({
            leave_type_id: nullableUuid(payload.leaveTypeId, "Tipo de ausência"),
            start_date: requiredDate(payload.startDate, "Data inicial"),
            end_date: requiredDate(payload.endDate, "Data final"),
            reason: optionalString(payload.reason, 3000),
            document_storage_path: optionalString(payload.documentStoragePath, 1000),
            status: payload.submit === false ? "RASCUNHO" : "SOLICITADO",
            manager_employee_id: nullableUuid(payload.managerEmployeeId, "Gestor"),
            notes: optionalString(payload.notes, 5000),
            updated_by: caller.id,
          })
          .eq("id", payload.requestId)
          .eq("version", requiredVersion(payload.expectedVersion))
          .select("id,status,version,duration_days")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("A solicitação foi alterada por outro usuário.");
        return json({ result: data });
      }
      case "decide-leave": {
        if (!isUuid(payload.requestId)) throw new Error("Solicitação inválida.");
        const { data: request, error: requestError } = await adminClient
          .from("leave_requests")
          .select("employee_id")
          .eq("id", payload.requestId)
          .is("deleted_at", null)
          .maybeSingle();
        if (requestError) throw requestError;
        if (!request) throw new Error("Solicitação não encontrada.");
        const employee = await employeeContext(adminClient, request.employee_id);
        await requirePermission(callerClient, "hr.leave.approve", employee.unitCode);
        const { data, error } = await callerClient.rpc("decide_hr_leave", {
          p_request_id: payload.requestId,
          p_decision: requiredString(payload.decision, "Decisão", 20),
          p_rejection_reason: optionalString(payload.rejectionReason, 3000),
          p_expected_version: requiredVersion(payload.expectedVersion),

          });
        if (error) throw error;
        return json({ result: data });
      }
      case "create-payment": {
        if (!isUuid(payload.employeeId)) throw new Error("Colaborador inválido.");
        const employee = await employeeContext(adminClient, payload.employeeId);
        await requirePermission(callerClient, "hr.payments.manage", employee.unitCode);
        const { data, error } = await adminClient
          .from("employee_payments")
          .insert({
            employee_id: payload.employeeId,
            contract_id: nullableUuid(payload.contractId, "Contrato"),
            competence: requiredDate(payload.competence, "Competência"),
            description: requiredString(payload.description, "Descrição", 500),
            base_amount: requiredNumber(payload.baseAmount, "Valor base"),
            additions: requiredNumber(payload.additions ?? 0, "Adicionais"),
            informational_deductions: requiredNumber(
              payload.informationalDeductions ?? 0,
              "Descontos",
            ),
            expected_date: requiredDate(payload.expectedDate, "Data prevista"),
            payment_date: optionalDate(payload.paymentDate),
            payment_method: optionalString(payload.paymentMethod, 120),
            status: requiredString(payload.status ?? "PENDENTE", "Status", 30),
            proof_storage_path: optionalString(payload.proofStoragePath, 1000),
            notes: optionalString(payload.notes, 5000),
            created_by: caller.id,
            updated_by: caller.id,
          })
          .select("id,status,version,final_amount")
          .single();
        if (error) throw error;
        return json({ result: data }, 201);
      }
      case "update-payment": {
        if (!isUuid(payload.paymentId)) throw new Error("Pagamento inválido.");
        const { data: payment, error: paymentError } = await adminClient
          .from("employee_payments")
          .select("employee_id")
          .eq("id", payload.paymentId)
          .is("deleted_at", null)
          .maybeSingle();
        if (paymentError) throw paymentError;
        if (!payment) throw new Error("Pagamento não encontrado.");
        const employee = await employeeContext(adminClient, payment.employee_id);
        await requirePermission(callerClient, "hr.payments.manage", employee.unitCode);
        const { data, error } = await adminClient
          .from("employee_payments")
          .update({
            contract_id: nullableUuid(payload.contractId, "Contrato"),
            competence: requiredDate(payload.competence, "Competência"),
            description: requiredString(payload.description, "Descrição", 500),
            base_amount: requiredNumber(payload.baseAmount, "Valor base"),
            additions: requiredNumber(payload.additions ?? 0, "Adicionais"),
            informational_deductions: requiredNumber(
              payload.informationalDeductions ?? 0,
              "Descontos",
            ),
            expected_date: requiredDate(payload.expectedDate, "Data prevista"),
            payment_date: optionalDate(payload.paymentDate),
            payment_method: optionalString(payload.paymentMethod, 120),
            status: requiredString(payload.status, "Status", 30),
            proof_storage_path: optionalString(payload.proofStoragePath, 1000),
            notes: optionalString(payload.notes, 5000),
            updated_by: caller.id,
          })
          .eq("id", payload.paymentId)
          .eq("version", requiredVersion(payload.expectedVersion))
          .select("id,status,version,final_amount")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("O pagamento foi alterado por outro usuário.");
        return json({ result: data });
      }
      case "mark-payment-paid": {
        if (!isUuid(payload.paymentId)) throw new Error("Pagamento inválido.");
        const { data: payment, error: paymentError } = await adminClient
          .from("employee_payments")
          .select("employee_id")
          .eq("id", payload.paymentId)
          .is("deleted_at", null)
          .maybeSingle();
        if (paymentError) throw paymentError;
        if (!payment) throw new Error("Pagamento não encontrado.");
        const employee = await employeeContext(adminClient, payment.employee_id);
        await requirePermission(callerClient, "hr.payments.manage", employee.unitCode);
        const { data, error } = await callerClient.rpc("mark_hr_payment_paid", {
          p_payment_id: payload.paymentId,
          p_payment_date: requiredDate(payload.paymentDate, "Data de pagamento"),
          p_payment_method: optionalString(payload.paymentMethod, 120),
          p_proof_storage_path: optionalString(payload.proofStoragePath, 1000),
          p_expected_version: requiredVersion(payload.expectedVersion),

          });
        if (error) throw error;
        return json({ result: data });
      }
      case "create-onboarding": {
        if (!isUuid(payload.employeeId)) throw new Error("Colaborador inválido.");
        const employee = await employeeContext(adminClient, payload.employeeId);
        await requirePermission(callerClient, "hr.onboarding.manage", employee.unitCode);
        const { data, error } = await callerClient.rpc("create_hr_onboarding", {
          p_employee_id: payload.employeeId,
          p_expected_start_date: requiredDate(payload.expectedStartDate, "Data prevista"),
          p_responsible_user_id:
            nullableUuid(payload.responsibleUserId, "Responsável") ?? caller.id,
          p_notes: optionalString(payload.notes, 5000),

          });
        if (error) throw error;
        return json({ result: data }, 201);
      }
      case "update-onboarding-task": {
        if (!isUuid(payload.taskId)) throw new Error("Tarefa inválida.");
        const { data: task, error: taskError } = await adminClient
          .from("onboarding_tasks")
          .select("id,onboarding_process_id,version")
          .eq("id", payload.taskId)
          .is("deleted_at", null)
          .maybeSingle();
        if (taskError) throw taskError;
        if (!task) throw new Error("Tarefa não encontrada.");
        const process = await processEmployeeId(
          adminClient,
          "onboarding_processes",
          task.onboarding_process_id,
        );
        const employee = await employeeContext(adminClient, process.employee_id);
        await requirePermission(callerClient, "hr.onboarding.manage", employee.unitCode);
        const status = requiredString(payload.status, "Status", 30);
        const { data, error } = await adminClient
          .from("onboarding_tasks")
          .update({
            status,
            responsible_user_id: nullableUuid(payload.responsibleUserId, "Responsável"),
            due_date: optionalDate(payload.dueDate),
            notes: optionalString(payload.notes, 5000),
            completed_at: status === "CONCLUIDA" ? new Date().toISOString() : null,
            completed_by: status === "CONCLUIDA" ? caller.id : null,
            updated_by: caller.id,
          })
          .eq("id", payload.taskId)
          .eq("version", requiredVersion(payload.expectedVersion))
          .select("id,status,version")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("A tarefa foi alterada por outro usuário.");
        return json({ result: data });
      }
      case "create-offboarding": {
        if (!isUuid(payload.employeeId)) throw new Error("Colaborador inválido.");
        const employee = await employeeContext(adminClient, payload.employeeId);
        await requirePermission(callerClient, "hr.offboarding.manage", employee.unitCode);
        const { data, error } = await callerClient.rpc("create_hr_offboarding", {
          p_employee_id: payload.employeeId,
          p_last_working_day: requiredDate(payload.lastWorkingDay, "Último dia"),
          p_reason: requiredString(payload.reason, "Motivo", 3000),
          p_responsible_user_id:
            nullableUuid(payload.responsibleUserId, "Responsável") ?? caller.id,
          p_notes: optionalString(payload.notes, 5000),

          });
        if (error) throw error;
        return json({ result: data }, 201);
      }
      case "update-offboarding-task": {
        if (!isUuid(payload.taskId)) throw new Error("Tarefa inválida.");
        const { data: task, error: taskError } = await adminClient
          .from("offboarding_tasks")
          .select("id,offboarding_process_id,version")
          .eq("id", payload.taskId)
          .is("deleted_at", null)
          .maybeSingle();
        if (taskError) throw taskError;
        if (!task) throw new Error("Tarefa não encontrada.");
        const process = await processEmployeeId(
          adminClient,
          "offboarding_processes",
          task.offboarding_process_id,
        );
        const employee = await employeeContext(adminClient, process.employee_id);
        await requirePermission(callerClient, "hr.offboarding.manage", employee.unitCode);
        const status = requiredString(payload.status, "Status", 30);
        const { data, error } = await adminClient
          .from("offboarding_tasks")
          .update({
            status,
            responsible_user_id: nullableUuid(payload.responsibleUserId, "Responsável"),
            due_date: optionalDate(payload.dueDate),
            notes: optionalString(payload.notes, 5000),
            completed_at: status === "CONCLUIDA" ? new Date().toISOString() : null,
            completed_by: status === "CONCLUIDA" ? caller.id : null,
            updated_by: caller.id,
          })
          .eq("id", payload.taskId)
          .eq("version", requiredVersion(payload.expectedVersion))
          .select("id,status,version")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("A tarefa foi alterada por outro usuário.");
        return json({ result: data });
      }
      case "complete-offboarding": {
        if (!isUuid(payload.processId)) throw new Error("Desligamento inválido.");
        const process = await processEmployeeId(
          adminClient,
          "offboarding_processes",
          payload.processId,
        );
        const employee = await employeeContext(adminClient, process.employee_id);
        await requirePermission(callerClient, "hr.offboarding.manage", employee.unitCode);
        const { data, error } = await callerClient.rpc("complete_hr_offboarding", {
          p_process_id: payload.processId,
          p_effective_date: requiredDate(payload.effectiveDate, "Data efetiva"),
          p_expected_version: requiredVersion(payload.expectedVersion),

          });
        if (error) throw error;
        return json({ result: data });
      }
      case "create-access": {
        if (!isUuid(payload.employeeId)) throw new Error("Colaborador inválido.");
        const employee = await employeeContext(adminClient, payload.employeeId);
        await requirePermission(callerClient, "hr.accesses.manage", employee.unitCode);
        const status = requiredString(payload.status ?? "PENDENTE", "Status", 30);
        const { data, error } = await adminClient
          .from("employee_accesses")
          .insert({
            employee_id: payload.employeeId,
            platform: requiredString(payload.platform, "Plataforma", 200),
            account_identifier: optionalString(payload.accountIdentifier, 320),
            access_type: optionalString(payload.accessType, 200),
            granted_at:
              status === "ATIVO"
                ? requiredDate(payload.grantedAt, "Data de concessão")
                : null,
            granted_by: status === "ATIVO" ? caller.id : null,
            status,
            notes: optionalString(payload.notes, 5000),
            created_by: caller.id,
            updated_by: caller.id,
          })
          .select("id,status,version")
          .single();
        if (error) throw error;
        return json({ result: data }, 201);
      }
      case "revoke-access": {
        if (!isUuid(payload.accessId)) throw new Error("Acesso inválido.");
        const { data: access, error: accessError } = await adminClient
          .from("employee_accesses")
          .select("employee_id")
          .eq("id", payload.accessId)
          .is("deleted_at", null)
          .maybeSingle();
        if (accessError) throw accessError;
        if (!access) throw new Error("Acesso não encontrado.");
        const employee = await employeeContext(adminClient, access.employee_id);
        await requirePermission(callerClient, "hr.accesses.manage", employee.unitCode);
        const { data, error } = await adminClient
          .from("employee_accesses")
          .update({
            status: "REVOGADO",
            revoked_at: requiredDate(payload.revokedAt, "Data de revogação"),
            revoked_by: caller.id,
            notes: optionalString(payload.notes, 5000),
            updated_by: caller.id,
          })
          .eq("id", payload.accessId)
          .eq("version", requiredVersion(payload.expectedVersion))
          .select("id,status,version")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("O acesso foi alterado por outro usuário.");
        return json({ result: data });
      }
      case "upsert-settings": {
        const businessUnitId = nullableUuid(payload.businessUnitId, "Unidade de negócio");
        if (businessUnitId) {
          const unitCode = await unitCodeFromBusinessUnit(adminClient, businessUnitId);
          await requirePermission(callerClient, "hr.settings.manage", unitCode);
        }
        const expectedVersion =
          payload.expectedVersion === null ||
          payload.expectedVersion === undefined ||
          payload.expectedVersion === ""
            ? null
            : requiredVersion(payload.expectedVersion);
        const { data, error } = await callerClient.rpc("upsert_hr_settings", {
          p_business_unit_id: businessUnitId,
          p_contract_expiry_alert_days: requiredNumber(
            payload.contractExpiryAlertDays,
            "Prazo de contratos",
            1,
          ),
          p_document_expiry_alert_days: requiredNumber(
            payload.documentExpiryAlertDays,
            "Prazo de documentos",
            1,
          ),
          p_expected_version: expectedVersion,
        });
        if (error) throw error;
        return json({ result: data }, expectedVersion === null ? 201 : 200);
      }

      default:
        return json({ error: "Ação administrativa desconhecida." }, 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha inesperada.";
    const status =
      error instanceof Error && error.name === "PermissionError"
        ? 403
        : message.includes("não encontrado") || message.includes("sem acesso")
          ? 404
          : message.includes("alterado por outro usuário")
            ? 409
            : message.includes("obrigatório") ||
                message.includes("inválid") ||
                message.includes("não permitido") ||
                message.includes("limite")
              ? 422
              : 409;
    return json({ error: message }, status);
  }
});
