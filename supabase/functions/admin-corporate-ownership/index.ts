import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    Deno.env.get("APP_ORIGIN") ??
    "https://lander-solutions-git-dev-lander-sistemas-projects.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = Record<string, unknown>;

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
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function expectedVersion(value: unknown): number {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error("Versão esperada inválida.");
  }
  return version;
}

function optionalText(value: unknown, maxLength = 2000): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("Valor textual inválido.");
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new Error("Valor textual excede o limite permitido.");
  }
  return normalized || null;
}

function requiredPermission(action: string) {
  return action === "submit-change"
    ? "corporate_ownership.manage"
    : "corporate_ownership.apply_changes";
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "Método não permitido." }, 405);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json({ error: "Autenticação obrigatória." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return json({ error: "Configuração interna incompleta." }, 500);
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return json({ error: "Corpo JSON inválido." }, 400);
  }

  const action = typeof payload.action === "string" ? payload.action : "";
  const supportedActions = new Set([
    "approve-resolution",
    "submit-change",
    "approve-change",
    "reject-change",
    "apply-change",
  ]);
  if (!supportedActions.has(action)) {
    return json({ error: action ? "Ação societária desconhecida." : "Ação obrigatória." }, 400);
  }

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = authorization.slice("Bearer ".length);
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user) {
    return json({ error: "Sessão inválida ou expirada." }, 401);
  }

  const { data: aal2, error: aalError } = await client.rpc("has_aal2");
  if (aalError || !aal2) {
    return json({ error: "A operação exige MFA aal2." }, 403);
  }

  const permissionCode = requiredPermission(action);
  const { data: permitted, error: permissionError } = await client.rpc("has_permission", {
    p_permission_code: permissionCode,
    p_unit_code: null,
  });
  if (permissionError || !permitted) {
    return json({ error: `Permissão ${permissionCode} obrigatória.` }, 403);
  }

  try {
    const version = expectedVersion(payload.expectedVersion);
    let result: unknown;

    if (action === "approve-resolution") {
      if (!isUuid(payload.resolutionId)) {
        return json({ error: "Deliberação societária inválida." }, 422);
      }
      const { data, error } = await client.rpc("approve_corporate_resolution", {
        p_resolution_id: payload.resolutionId,
        p_expected_version: version,
      });
      if (error) throw error;
      result = data;
    } else {
      if (!isUuid(payload.changeId)) {
        return json({ error: "Alteração societária inválida." }, 422);
      }

      if (action === "submit-change") {
        const { data, error } = await client.rpc("submit_corporate_ownership_change", {
          p_change_id: payload.changeId,
          p_expected_version: version,
        });
        if (error) throw error;
        result = data;
      } else if (action === "approve-change" || action === "reject-change") {
        const approve = action === "approve-change";
        const reason = optionalText(payload.reason);
        if (!approve && (!reason || reason.length < 3)) {
          throw new Error("Motivo da rejeição obrigatório.");
        }
        const { data, error } = await client.rpc("decide_corporate_ownership_change", {
          p_change_id: payload.changeId,
          p_expected_version: version,
          p_approve: approve,
          p_reason: reason,
        });
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await client.rpc("apply_corporate_ownership_change", {
          p_change_id: payload.changeId,
          p_expected_version: version,
        });
        if (error) throw error;
        result = data;
      }
    }

    if (!result) {
      return json({ error: "O registro foi modificado por outro usuário." }, 409);
    }
    return json({ result });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    const message = error instanceof Error ? error.message : "Falha societária inesperada.";
    const status =
      code === "42501" || message.includes("Permissão") || message.includes("MFA")
        ? 403
        : message.includes("inválid") ||
            message.includes("obrigatóri") ||
            message.includes("Somente") ||
            message.includes("não pode") ||
            message.includes("não está")
          ? 422
          : 409;
    return json({ error: message }, status);
  }
});
