import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    Deno.env.get("APP_ORIGIN") ??
    "https://lander-solutions-git-dev-lander-sistemas-projects.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const referenceTypes = new Set([
  "bank_account",
  "payment_method",
  "tax_document",
  "identity_document",
  "other",
]);
const referenceStatuses = new Set(["active", "inactive", "revoked"]);
const allowedDocumentMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function json(body: unknown, status = 200): Response {
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
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function requiredText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length >= min && normalized.length <= max ? normalized : null;
}

function optionalText(value: unknown, max: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length <= max ? normalized : null;
}

function safeFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 180);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json({ error: "Autenticação obrigatória." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Configuração interna incompleta." }, 500);
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Corpo JSON inválido." }, 400);
  }

  const action = typeof payload.action === "string" ? payload.action : "";
  const token = authorization.slice("Bearer ".length);
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser(token);
  if (callerError || !caller) return json({ error: "Sessão inválida ou expirada." }, 401);

  async function unitCodeByParty(partyId: string): Promise<string | null> {
    const { data: party, error } = await adminClient
      .from("parties")
      .select("primary_business_unit_id")
      .eq("id", partyId)
      .maybeSingle();
    if (error || !party) throw new Error("Parte não encontrada.");
    if (!party.primary_business_unit_id) return null;
    const { data: unit } = await adminClient
      .from("business_units")
      .select("code")
      .eq("id", party.primary_business_unit_id)
      .maybeSingle();
    return unit?.code ?? null;
  }

  async function unitCodeByLead(leadId: string): Promise<string | null> {
    const { data: lead, error } = await adminClient
      .from("crm_leads")
      .select("business_unit_id")
      .eq("id", leadId)
      .maybeSingle();
    if (error || !lead) throw new Error("Lead de origem não encontrado.");
    return unitCodeById(lead.business_unit_id);
  }

  async function unitCodeById(unitId: unknown): Promise<string | null> {
    if (!isUuid(unitId)) return null;
    const { data: unit } = await adminClient
      .from("business_units")
      .select("code")
      .eq("id", unitId)
      .maybeSingle();
    return unit?.code ?? null;
  }

  async function authorized(permissionCode: string, unitCode: string | null, requireAal2 = false) {
    const { data: allowed, error: permissionError } = await callerClient.rpc("has_permission", {
      p_permission_code: permissionCode,
      p_unit_code: unitCode,
    });
    if (permissionError || !allowed) return false;
    if (!requireAal2) return true;
    const { data: aal2, error: aalError } = await callerClient.rpc("has_aal2");
    return !aalError && Boolean(aal2);
  }

  async function requireAuthorization(
    permissionCode: string,
    unitCode: string | null,
    requireAal2 = false,
  ): Promise<Response | null> {
    if (await authorized(permissionCode, unitCode, requireAal2)) return null;
    return json(
      {
        error: requireAal2
          ? "A operação exige permissão adequada e MFA aal2."
          : "Permissão insuficiente.",
      },
      403,
    );
  }

  if (action === "get-contact") {
    const partyId = payload.partyId;
    if (!isUuid(partyId)) return json({ error: "Contato inválido." }, 422);
    let unitCode: string | null;
    try {
      unitCode = await unitCodeByParty(partyId);
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Contato não encontrado." },
        404,
      );
    }
    const denied = await requireAuthorization("parties.read", unitCode);
    if (denied) return denied;
    const { data, error } = await adminClient.rpc("admin_get_contact_form", {
      p_party_id: partyId,
    });
    if (error) return json({ error: error.message }, 500);
    if (!data) return json({ error: "Contato não encontrado." }, 404);
    const canReadSensitive = await authorized("parties.sensitive.read", unitCode);
    const result = data as Record<string, unknown>;
    if (!canReadSensitive) {
      result.bankAccounts = [];
      result.documents = [];
    }
    return json({ contact: result, canReadSensitive });
  }

  if (action === "save-contact") {
    const form = payload.form;
    if (!form || typeof form !== "object" || Array.isArray(form)) {
      return json({ error: "Formulário de contato inválido." }, 422);
    }
    const formRecord = form as Record<string, unknown>;
    let unitCode: string | null = null;
    if (isUuid(formRecord.id)) {
      try {
        unitCode = await unitCodeByParty(formRecord.id);
      } catch {
        return json({ error: "Contato não encontrado." }, 404);
      }
    } else {
      unitCode = await unitCodeById(formRecord.businessUnitId);
    }
    const denied = await requireAuthorization("parties.manage", unitCode, true);
    if (denied) return denied;
    const bankAccounts = Array.isArray(formRecord.bankAccounts) ? formRecord.bankAccounts : [];
    const canManageSensitive = await authorized("parties.sensitive.manage", unitCode, true);
    if (bankAccounts.length > 0 && !canManageSensitive) {
      return json({ error: "Permissão insuficiente para alterar dados bancários." }, 403);
    }
    if (!canManageSensitive) {
      delete formRecord.bankAccounts;
    }
    if (isUuid(formRecord.sourceLeadId)) {
      let leadUnitCode: string | null;
      try {
        leadUnitCode = await unitCodeByLead(formRecord.sourceLeadId);
      } catch {
        return json({ error: "Lead de origem não encontrado." }, 404);
      }
      const convertDenied = await requireAuthorization("crm.convert", leadUnitCode, true);
      if (convertDenied) return convertDenied;
    }
    const { data, error } = await adminClient.rpc("admin_save_contact_form", {
      p_payload: formRecord,
      p_actor_user_id: caller.id,
    });
    if (error) return json({ error: error.message }, 409);
    return json({ partyId: data }, isUuid(formRecord.id) ? 200 : 201);
  }

  if (
    action === "create-document-upload" ||
    action === "register-document" ||
    action === "delete-document" ||
    action === "document-download"
  ) {
    let partyId = payload.partyId;
    let document: Record<string, unknown> | null = null;
    if (action === "delete-document" || action === "document-download") {
      const documentId = payload.documentId;
      if (!isUuid(documentId)) return json({ error: "Documento inválido." }, 422);
      const { data } = await adminClient
        .from("party_documents")
        .select("*")
        .eq("id", documentId)
        .maybeSingle();
      if (!data) return json({ error: "Documento não encontrado." }, 404);
      document = data as Record<string, unknown>;
      partyId = document.party_id;
    }
    if (!isUuid(partyId)) return json({ error: "Contato inválido." }, 422);
    const unitCode = await unitCodeByParty(partyId);
    const permission =
      action === "document-download" ? "parties.sensitive.read" : "parties.sensitive.manage";
    const denied = await requireAuthorization(permission, unitCode, action !== "document-download");
    if (denied) return denied;

    if (action === "create-document-upload") {
      const fileName = requiredText(payload.fileName, 1, 255);
      const mimeType = requiredText(payload.mimeType, 3, 160);
      const fileSize = Number(payload.fileSize);
      if (!fileName || !mimeType || !allowedDocumentMimeTypes.has(mimeType)) {
        return json({ error: "Tipo de arquivo não permitido." }, 422);
      }
      if (!Number.isInteger(fileSize) || fileSize < 1 || fileSize > 52_428_800) {
        return json({ error: "Arquivo inválido ou maior que 50 MB." }, 422);
      }
      const objectKey = `${partyId}/${crypto.randomUUID()}-${safeFileName(fileName)}`;
      const { data, error } = await adminClient.storage
        .from("party-documents")
        .createSignedUploadUrl(objectKey);
      if (error) return json({ error: error.message }, 500);
      return json({ bucket: "party-documents", objectKey, token: data.token });
    }

    if (action === "register-document") {
      const documentType = requiredText(payload.documentType, 2, 80);
      const fileName = requiredText(payload.fileName, 1, 255);
      const mimeType = requiredText(payload.mimeType, 3, 160);
      const objectKey = requiredText(payload.objectKey, 3, 1024);
      const fileSize = Number(payload.fileSize);
      if (
        !documentType ||
        !fileName ||
        !mimeType ||
        !objectKey ||
        !objectKey.startsWith(`${partyId}/`) ||
        !allowedDocumentMimeTypes.has(mimeType) ||
        !Number.isInteger(fileSize) ||
        fileSize < 1 ||
        fileSize > 52_428_800
      ) {
        return json({ error: "Metadados do documento inválidos." }, 422);
      }
      const { data, error } = await adminClient
        .from("party_documents")
        .insert({
          party_id: partyId,
          document_type: documentType,
          label: fileName,
          storage_provider: "supabase",
          storage_bucket: "party-documents",
          storage_object_key: objectKey,
          status: "uploaded",
          file_name: fileName,
          mime_type: mimeType,
          file_size_bytes: fileSize,
          uploaded_by: caller.id,
          uploaded_at: new Date().toISOString(),
          linked_entity_type: "party",
          linked_entity_id: partyId,
        })
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 409);
      return json({ document: data }, 201);
    }

    if (action === "delete-document" && document) {
      const bucket = "party-documents";
      const objectKey = String(document.storage_object_key ?? "");
      if (!objectKey.startsWith(`${partyId}/`))
        return json({ error: "Caminho de documento inválido." }, 422);
      if (objectKey) await adminClient.storage.from(bucket).remove([objectKey]);
      const { error } = await adminClient
        .from("party_documents")
        .update({ status: "inactive" })
        .eq("id", document.id);
      if (error) return json({ error: error.message }, 409);
      return json({ deleted: true });
    }

    if (action === "document-download" && document) {
      const bucket = "party-documents";
      const objectKey = String(document.storage_object_key ?? "");
      if (!objectKey.startsWith(`${partyId}/`))
        return json({ error: "Caminho de documento inválido." }, 422);
      if (!objectKey) return json({ error: "Documento sem arquivo associado." }, 422);
      const { data, error } = await adminClient.storage
        .from(bucket)
        .createSignedUrl(objectKey, 300);
      if (error) return json({ error: error.message }, 500);
      return json({ signedUrl: data.signedUrl });
    }
  }

  if (["list-restricted", "create-restricted"].includes(action)) {
    const partyId = payload.partyId;
    if (!isUuid(partyId)) return json({ error: "Identificador da parte inválido." }, 422);
    const unitCode = await unitCodeByParty(partyId);
    const permissionCode =
      action === "list-restricted" ? "parties.sensitive.read" : "parties.sensitive.manage";
    const denied = await requireAuthorization(
      permissionCode,
      unitCode,
      action !== "list-restricted",
    );
    if (denied) return denied;

    if (action === "list-restricted") {
      const { data, error } = await adminClient.rpc("admin_list_party_restricted_references", {
        p_party_id: partyId,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ references: Array.isArray(data) ? data : [] });
    }

    const referenceType = payload.referenceType;
    const label = requiredText(payload.label, 2, 120);
    const maskedValue = optionalText(payload.maskedValue, 120);
    const vaultReference = requiredText(payload.vaultReference, 3, 255);
    if (typeof referenceType !== "string" || !referenceTypes.has(referenceType)) {
      return json({ error: "Tipo de referência inválido." }, 422);
    }
    if (!label || !vaultReference || !/^[A-Za-z0-9/_:.-]+$/.test(vaultReference)) {
      return json({ error: "Rótulo ou referência de cofre inválida." }, 422);
    }
    const { data, error } = await adminClient.rpc("admin_create_party_restricted_reference", {
      p_party_id: partyId,
      p_reference_type: referenceType,
      p_label: label,
      p_masked_value: maskedValue ?? "",
      p_vault_reference: vaultReference,
      p_actor_user_id: caller.id,
    });
    if (error) return json({ error: error.message }, 409);
    return json({ reference: data }, 201);
  }

  if (["update-restricted", "delete-restricted"].includes(action)) {
    const id = payload.id;
    const expectedVersion = payload.expectedVersion;
    if (!isUuid(id)) return json({ error: "Identificador da referência inválido." }, 422);
    if (!Number.isInteger(expectedVersion) || Number(expectedVersion) < 1) {
      return json({ error: "Versão esperada inválida." }, 422);
    }
    const { data: current } = await adminClient.rpc("admin_get_party_restricted_reference", {
      p_id: id,
    });
    if (!current || typeof current !== "object" || !("party_id" in current)) {
      return json({ error: "Referência restrita não encontrada." }, 404);
    }
    const partyId = String((current as { party_id: unknown }).party_id);
    const unitCode = await unitCodeByParty(partyId);
    const denied = await requireAuthorization("parties.sensitive.manage", unitCode, true);
    if (denied) return denied;

    if (action === "update-restricted") {
      const referenceType = payload.referenceType;
      const label = requiredText(payload.label, 2, 120);
      const maskedValue = optionalText(payload.maskedValue, 120);
      const vaultReference = requiredText(payload.vaultReference, 3, 255);
      const status = payload.status;
      if (typeof referenceType !== "string" || !referenceTypes.has(referenceType)) {
        return json({ error: "Tipo de referência inválido." }, 422);
      }
      if (typeof status !== "string" || !referenceStatuses.has(status)) {
        return json({ error: "Status inválido." }, 422);
      }
      if (!label || !vaultReference || !/^[A-Za-z0-9/_:.-]+$/.test(vaultReference)) {
        return json({ error: "Dados da referência inválidos." }, 422);
      }
      const { data, error } = await adminClient.rpc("admin_update_party_restricted_reference", {
        p_id: id,
        p_expected_version: Number(expectedVersion),
        p_reference_type: referenceType,
        p_label: label,
        p_masked_value: maskedValue ?? "",
        p_vault_reference: vaultReference,
        p_status: status,
        p_actor_user_id: caller.id,
      });
      if (error) return json({ error: error.message }, 409);
      if (!data) return json({ error: "A referência foi alterada por outro usuário." }, 409);
      return json({ reference: data });
    }

    const { data, error } = await adminClient.rpc("admin_delete_party_restricted_reference", {
      p_id: id,
      p_expected_version: Number(expectedVersion),
      p_actor_user_id: caller.id,
    });
    if (error) return json({ error: error.message }, 409);
    if (!data) return json({ error: "A referência foi alterada por outro usuário." }, 409);
    return json(data);
  }

  return json({ error: "Ação administrativa desconhecida." }, 400);
});
