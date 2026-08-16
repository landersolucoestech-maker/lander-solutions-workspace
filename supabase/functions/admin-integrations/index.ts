import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    Deno.env.get("APP_ORIGIN") ??
    "https://lander-solutions-git-dev-lander-sistemas-projects.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ENVIRONMENTS = new Set(["development", "staging", "production"]);
const STATUSES = new Set(["draft", "active", "inactive", "error"]);

type JsonRecord = Record<string, unknown>;
type Client = SupabaseClient;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function requiredString(value: unknown, field: string, max = 500): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} é obrigatório.`);
  const result = value.trim();
  if (result.length > max) throw new Error(`${field} excede o limite permitido.`);
  return result;
}

function optionalString(value: unknown, max = 5000): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("Valor textual inválido.");
  const result = value.trim();
  if (result.length > max) throw new Error("Valor textual excede o limite permitido.");
  return result || null;
}

function optionalUuid(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new Error(`${field} inválido.`);
  return value;
}

function requiredUuid(value: unknown, field: string): string {
  const parsed = optionalUuid(value, field);
  if (!parsed) throw new Error(`${field} é obrigatório.`);
  return parsed;
}

function requiredVersion(value: unknown): number {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) throw new Error("Versão esperada inválida.");
  return version;
}

function optionalTimestamp(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value)))
    throw new Error(`${field} inválido.`);
  return new Date(value).toISOString();
}

async function unitCodeFromId(
  admin: Client,
  businessUnitId: string | null,
): Promise<string | null> {
  if (!businessUnitId) return null;
  const { data, error } = await admin
    .from("business_units")
    .select("code")
    .eq("id", businessUnitId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Unidade de negócio não encontrada.");
  return String(data.code);
}

async function requirePermission(caller: Client, unitCode: string | null) {
  const { data, error } = await caller.rpc("has_permission", {
    p_permission_code: "settings.integrations.manage",
    p_unit_code: unitCode,
  });
  if (error || data !== true) {
    const permissionError = new Error("Permissão insuficiente.");
    permissionError.name = "PermissionError";
    throw permissionError;
  }
}

function validatedEnvironment(value: unknown): string {
  const environment = requiredString(value, "Ambiente", 30);
  if (!ENVIRONMENTS.has(environment)) throw new Error("Ambiente inválido.");
  return environment;
}

function validatedStatus(value: unknown): string {
  const status = requiredString(value, "Status", 30);
  if (!STATUSES.has(status)) throw new Error("Status inválido.");
  return status;
}

function validatedEndpoint(value: unknown, environment: string): string | null {
  const endpoint = optionalString(value, 2000);
  if (!endpoint) return null;

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("Endpoint inválido.");
  }

  const developmentLocal =
    environment === "development" &&
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(url.hostname);

  if (url.protocol !== "https:" && !developmentLocal) {
    throw new Error("O endpoint deve usar HTTPS.");
  }
  return endpoint;
}

function validateSecretReference(value: unknown): string | null {
  const reference = optionalString(value, 500);
  if (!reference) return null;
  if (/(password|passwd|token|secret|api[_-]?key)\s*[:=]\s*\S+/i.test(reference)) {
    throw new Error("Informe somente a referência do segredo, nunca a credencial.");
  }
  return reference;
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

  let payload: JsonRecord;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Corpo JSON inválido." }, 400);
  }

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
    const action = requiredString(payload.action, "Ação", 50);

    if (action === "create") {
      const businessUnitId = optionalUuid(payload.businessUnitId, "Unidade de negócio");
      const unitCode = await unitCodeFromId(adminClient, businessUnitId);
      await requirePermission(callerClient, unitCode);
      const environment = validatedEnvironment(payload.environment ?? "development");
      const status = validatedStatus(payload.status ?? "draft");

      const { data, error } = await adminClient
        .from("integration_connections")
        .insert({
          business_unit_id: businessUnitId,
          source_system: requiredString(payload.sourceSystem, "Sistema de origem", 200),
          information_type: requiredString(payload.informationType, "Tipo de informação", 300),
          endpoint_url: validatedEndpoint(payload.endpointUrl, environment),
          environment,
          status,
          last_sync_at: optionalTimestamp(payload.lastSyncAt, "Última sincronização"),
          last_failure_at: optionalTimestamp(payload.lastFailureAt, "Última falha"),
          last_failure_message: optionalString(payload.lastFailureMessage, 4000),
          technical_owner_user_id: optionalUuid(
            payload.technicalOwnerUserId,
            "Responsável técnico",
          ),
          secret_reference: validateSecretReference(payload.secretReference),
          summary_log: optionalString(payload.summaryLog, 10000),
          created_by: caller.id,
          updated_by: caller.id,
        })
        .select("*")
        .single();
      if (error) throw error;
      return json({ result: data }, 201);
    }

    if (action === "update") {
      const id = requiredUuid(payload.id, "Integração");
      const { data: current, error: currentError } = await adminClient
        .from("integration_connections")
        .select("business_unit_id")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current) throw new Error("Integração não encontrada.");

      const currentUnitCode = await unitCodeFromId(adminClient, current.business_unit_id);
      await requirePermission(callerClient, currentUnitCode);

      const businessUnitId = optionalUuid(payload.businessUnitId, "Unidade de negócio");
      const targetUnitCode = await unitCodeFromId(adminClient, businessUnitId);
      if (targetUnitCode !== currentUnitCode) {
        await requirePermission(callerClient, targetUnitCode);
      }

      const environment = validatedEnvironment(payload.environment);
      const { data, error } = await adminClient
        .from("integration_connections")
        .update({
          business_unit_id: businessUnitId,
          source_system: requiredString(payload.sourceSystem, "Sistema de origem", 200),
          information_type: requiredString(payload.informationType, "Tipo de informação", 300),
          endpoint_url: validatedEndpoint(payload.endpointUrl, environment),
          environment,
          status: validatedStatus(payload.status),
          last_sync_at: optionalTimestamp(payload.lastSyncAt, "Última sincronização"),
          last_failure_at: optionalTimestamp(payload.lastFailureAt, "Última falha"),
          last_failure_message: optionalString(payload.lastFailureMessage, 4000),
          technical_owner_user_id: optionalUuid(
            payload.technicalOwnerUserId,
            "Responsável técnico",
          ),
          secret_reference: validateSecretReference(payload.secretReference),
          summary_log: optionalString(payload.summaryLog, 10000),
          updated_by: caller.id,
        })
        .eq("id", id)
        .eq("version", requiredVersion(payload.expectedVersion))
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("A integração foi alterada por outro usuário.");
      return json({ result: data });
    }

    if (action === "record-sync") {
      const id = requiredUuid(payload.id, "Integração");
      const { data: current, error: currentError } = await adminClient
        .from("integration_connections")
        .select("business_unit_id")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current) throw new Error("Integração não encontrada.");

      await requirePermission(
        callerClient,
        await unitCodeFromId(adminClient, current.business_unit_id),
      );

      const succeeded = payload.succeeded === true;
      const now = new Date().toISOString();
      const values = succeeded
        ? {
            status: "active",
            last_sync_at: now,
            last_failure_at: null,
            last_failure_message: null,
            summary_log: optionalString(payload.summaryLog, 10000),
            updated_by: caller.id,
          }
        : {
            status: "error",
            last_failure_at: now,
            last_failure_message: requiredString(payload.failureMessage, "Falha", 4000),
            summary_log: optionalString(payload.summaryLog, 10000),
            updated_by: caller.id,
          };

      const { data, error } = await adminClient
        .from("integration_connections")
        .update(values)
        .eq("id", id)
        .eq("version", requiredVersion(payload.expectedVersion))
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("A integração foi alterada por outro usuário.");
      return json({ result: data });
    }

    if (action === "delete") {
      const id = requiredUuid(payload.id, "Integração");
      const { data: current, error: currentError } = await adminClient
        .from("integration_connections")
        .select("business_unit_id")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current) throw new Error("Integração não encontrada.");

      await requirePermission(
        callerClient,
        await unitCodeFromId(adminClient, current.business_unit_id),
      );

      const { data, error } = await adminClient
        .from("integration_connections")
        .update({
          status: "inactive",
          deleted_at: new Date().toISOString(),
          updated_by: caller.id,
        })
        .eq("id", id)
        .eq("version", requiredVersion(payload.expectedVersion))
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("A integração foi alterada por outro usuário.");
      return json({ result: data });
    }

    return json({ error: "Ação desconhecida." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha inesperada.";
    const status =
      error instanceof Error && error.name === "PermissionError"
        ? 403
        : message.includes("não encontrada")
          ? 404
          : message.includes("alterada por outro usuário")
            ? 409
            : message.includes("obrigatório") ||
                message.includes("inválid") ||
                message.includes("excede") ||
                message.includes("nunca a credencial")
              ? 422
              : 409;
    return json({ error: message }, status);
  }
});
