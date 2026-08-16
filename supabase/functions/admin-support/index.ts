import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    Deno.env.get("APP_ORIGIN") ??
    "https://lander-solutions-git-dev-lander-sistemas-projects.vercel.app",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BODY_BYTES = 1_048_576;

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };
type Action =
  | "list-products"
  | "get-workspace"
  | "list-inbox"
  | "get-conversation"
  | "get-ticket"
  | "list-automation-versions"
  | "preview-automation"
  | "simulate-sla"
  | "save-product-settings"
  | "save-product-member"
  | "save-queue"
  | "archive-queue"
  | "save-queue-members"
  | "save-category"
  | "save-tag"
  | "save-channel"
  | "save-template"
  | "archive-template"
  | "save-form"
  | "archive-form"
  | "save-business-hours"
  | "save-sla-policy"
  | "save-escalation-rule"
  | "get-or-create-draft"
  | "save-automation-draft"
  | "validate-automation"
  | "publish-automation"
  | "restore-automation-version"
  | "create-conversation"
  | "reply-conversation"
  | "add-conversation-note"
  | "assign-conversation"
  | "transition-conversation"
  | "create-ticket"
  | "transition-ticket"
  | "process-ticket-escalations";

interface ActionPolicy {
  permission: string;
  requiresMfa: boolean;
  limit: number;
}
interface ProductScope {
  productId: string | null;
  legalEntityId: string | null;
  unitCode: string | null;
}

const policies: Record<Action, ActionPolicy> = {
  "list-products": { permission: "support.read", requiresMfa: false, limit: 120 },
  "get-workspace": { permission: "support.read", requiresMfa: false, limit: 120 },
  "list-inbox": { permission: "support.read", requiresMfa: false, limit: 180 },
  "get-conversation": { permission: "support.read", requiresMfa: false, limit: 180 },
  "get-ticket": { permission: "support.read", requiresMfa: false, limit: 180 },
  "list-automation-versions": { permission: "support.read", requiresMfa: false, limit: 120 },
  "preview-automation": { permission: "support.read", requiresMfa: false, limit: 120 },
  "simulate-sla": { permission: "support.manage", requiresMfa: true, limit: 60 },
  "save-product-settings": { permission: "support.manage", requiresMfa: true, limit: 60 },
  "save-product-member": { permission: "support.manage", requiresMfa: true, limit: 60 },
  "save-queue": { permission: "support.manage", requiresMfa: true, limit: 60 },
  "archive-queue": { permission: "support.manage", requiresMfa: true, limit: 30 },
  "save-queue-members": { permission: "support.manage", requiresMfa: true, limit: 60 },
  "save-category": { permission: "support.manage", requiresMfa: true, limit: 60 },
  "save-tag": { permission: "support.manage", requiresMfa: true, limit: 60 },
  "save-channel": { permission: "support.manage", requiresMfa: true, limit: 60 },
  "save-template": { permission: "support.manage", requiresMfa: true, limit: 60 },
  "archive-template": { permission: "support.manage", requiresMfa: true, limit: 30 },
  "save-form": { permission: "support.manage", requiresMfa: true, limit: 60 },
  "archive-form": { permission: "support.manage", requiresMfa: true, limit: 30 },
  "save-business-hours": { permission: "support.manage", requiresMfa: true, limit: 60 },
  "save-sla-policy": { permission: "support.manage", requiresMfa: true, limit: 60 },
  "save-escalation-rule": { permission: "support.manage", requiresMfa: true, limit: 60 },
  "get-or-create-draft": { permission: "support.manage", requiresMfa: true, limit: 60 },
  "save-automation-draft": { permission: "support.manage", requiresMfa: true, limit: 60 },
  "validate-automation": { permission: "support.manage", requiresMfa: true, limit: 60 },
  "publish-automation": { permission: "support.publish", requiresMfa: true, limit: 20 },
  "restore-automation-version": { permission: "support.manage", requiresMfa: true, limit: 30 },
  "create-conversation": { permission: "support.operate", requiresMfa: true, limit: 120 },
  "reply-conversation": { permission: "support.operate", requiresMfa: true, limit: 180 },
  "add-conversation-note": { permission: "support.operate", requiresMfa: true, limit: 180 },
  "assign-conversation": { permission: "support.operate", requiresMfa: true, limit: 120 },
  "transition-conversation": { permission: "support.operate", requiresMfa: true, limit: 120 },
  "create-ticket": { permission: "support.operate", requiresMfa: true, limit: 120 },
  "transition-ticket": { permission: "support.operate", requiresMfa: true, limit: 180 },
  "process-ticket-escalations": { permission: "support.manage", requiresMfa: true, limit: 30 },
};

class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

function respond(body: JsonValue, requestId: string, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
    },
  });
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAction(value: JsonValue | undefined): Action {
  if (typeof value !== "string" || !(value in policies))
    throw new RequestError("Ação administrativa desconhecida.", 400, "unknown_action");
  return value as Action;
}

function databaseError(message: string): RequestError {
  if (message.includes("CONFLICT"))
    return new RequestError(message.replace("CONFLICT: ", ""), 409, "conflict");
  if (message.includes("RATE_LIMIT"))
    return new RequestError("Limite de requisições excedido.", 429, "rate_limit");
  if (message.toLowerCase().includes("não encontr"))
    return new RequestError(message, 404, "not_found");
  if (message.includes("permiss") || message.includes("MFA"))
    return new RequestError(message, 403, "permission_denied");
  return new RequestError(message, 422, "validation_error");
}

Deno.serve(async (req: Request) => {
  const requestId = req.headers.get("x-request-id")?.slice(0, 100) || crypto.randomUUID();
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: { ...corsHeaders, "X-Request-Id": requestId } });
  if (req.method !== "POST")
    return respond(
      { error: "Método não permitido.", code: "method_not_allowed", requestId },
      requestId,
      405,
    );

  try {
    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES)
      throw new RequestError("Corpo da requisição excede 1 MB.", 413, "payload_too_large");
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer "))
      throw new RequestError("Autenticação obrigatória.", 401, "authentication_required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey)
      throw new RequestError("Configuração interna incompleta.", 500, "server_configuration");

    const raw: unknown = await req.json().catch(() => {
      throw new RequestError("Corpo JSON inválido.", 400, "invalid_json");
    });
    if (!isObject(raw)) throw new RequestError("Payload inválido.", 422, "invalid_payload");
    const action = parseAction(raw.action);
    const policy = policies[action];

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
    if (userError || !caller)
      throw new RequestError("Sessão inválida ou expirada.", 401, "invalid_session");

    if (policy.requiresMfa) {
      const { data: aal2, error: aalError } = await callerClient.rpc("has_aal2");
      if (aalError || !aal2)
        throw new RequestError("A operação exige MFA aal2.", 403, "mfa_required");
    }

    const payload: JsonObject = { ...raw };
    delete payload.action;
    const { data: rawScope, error: scopeError } = await adminClient.rpc(
      "support_admin_resolve_scope",
      { p_action: action, p_payload: payload },
    );
    if (scopeError) throw databaseError(scopeError.message);
    if (!isObject(rawScope))
      throw new RequestError("Escopo administrativo inválido.", 500, "invalid_scope");
    const scope = rawScope as unknown as ProductScope;

    const { data: allowed, error: permissionError } = await callerClient.rpc("has_permission", {
      p_permission_code: policy.permission,
      p_unit_code: scope.unitCode,
    });
    if (permissionError || !allowed)
      throw new RequestError("Permissão insuficiente.", 403, "permission_denied");

    const { error: rateError } = await adminClient.rpc("support_enforce_rate_limit", {
      p_actor_user_id: caller.id,
      p_action: action,
      p_limit: policy.limit,
    });
    if (rateError) throw databaseError(rateError.message);

    console.info(
      JSON.stringify({
        requestId,
        action,
        callerId: caller.id,
        productId: scope.productId,
        unitCode: scope.unitCode,
      }),
    );
    const { data, error } = await adminClient.rpc("support_admin_dispatch", {
      p_action: action,
      p_payload: payload,
      p_actor_user_id: caller.id,
    });
    if (error) throw databaseError(error.message);
    return respond({ result: data as JsonValue, requestId }, requestId);
  } catch (error) {
    if (error instanceof RequestError) {
      console.warn(
        JSON.stringify({
          requestId,
          status: error.status,
          code: error.code,
          message: error.message,
        }),
      );
      return respond(
        { error: error.message, code: error.code, requestId },
        requestId,
        error.status,
      );
    }
    const message = error instanceof Error ? error.message : "Erro interno inesperado.";
    console.error(JSON.stringify({ requestId, message }));
    return respond(
      { error: "Erro interno inesperado.", code: "internal_error", requestId },
      requestId,
      500,
    );
  }
});
