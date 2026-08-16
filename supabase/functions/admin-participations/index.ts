import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    Deno.env.get("APP_ORIGIN") ??
    "https://lander-solutions-git-dev-lander-sistemas-projects.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const permissions: Record<string, string> = {
  calculate: "participation.manage",
  submit: "participation.manage",
  approve: "participation.approve",
  reject: "participation.approve",
  post: "participation.post",
};

type Body = {
  action?: string;
  calculationId?: string;
  expectedVersion?: number;
  reason?: string;
};

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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json({ error: "Autenticação obrigatória." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return json({ error: "Configuração interna incompleta." }, 500);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ error: "Corpo JSON inválido." }, 400);
  }

  const action = body.action ?? "";
  const permissionCode = permissions[action];
  if (!permissionCode) return json({ error: "Ação de participação desconhecida." }, 400);
  if (!isUuid(body.calculationId)) return json({ error: "Apuração inválida." }, 422);

  const version = Number(body.expectedVersion);
  if (!Number.isSafeInteger(version) || version < 1) {
    return json({ error: "Versão esperada inválida." }, 422);
  }

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = authorization.slice("Bearer ".length);
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Sessão inválida ou expirada." }, 401);

  const { data: aal2, error: aalError } = await client.rpc("has_aal2");
  if (aalError || !aal2) return json({ error: "A operação exige MFA aal2." }, 403);

  const { data: permitted, error: permissionError } = await client.rpc("has_permission", {
    p_permission_code: permissionCode,
    p_unit_code: null,
  });
  if (permissionError || !permitted) {
    return json({ error: `Permissão ${permissionCode} obrigatória.` }, 403);
  }

  try {
    let response;
    if (action === "calculate") {
      response = await client.rpc("calculate_participation", {
        p_calculation_id: body.calculationId,
        p_expected_version: version,
      });
    } else if (action === "submit") {
      response = await client.rpc("submit_participation", {
        p_calculation_id: body.calculationId,
        p_expected_version: version,
      });
    } else if (action === "approve" || action === "reject") {
      const reason = typeof body.reason === "string" ? body.reason.trim() : null;
      if (action === "reject" && (!reason || reason.length < 3)) {
        return json({ error: "Motivo da rejeição obrigatório." }, 422);
      }
      response = await client.rpc("decide_participation", {
        p_calculation_id: body.calculationId,
        p_expected_version: version,
        p_approve: action === "approve",
        p_reason: reason,
      });
    } else {
      response = await client.rpc("post_participation", {
        p_calculation_id: body.calculationId,
        p_expected_version: version,
      });
    }

    if (response.error) throw response.error;
    if (!response.data) return json({ error: "A apuração foi modificada por outro usuário." }, 409);
    return json({ result: response.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no workflow de participação.";
    const status =
      message.includes("Permissão") || message.includes("MFA")
        ? 403
        : message.includes("inválid") ||
            message.includes("obrigatóri") ||
            message.includes("Somente")
          ? 422
          : 409;
    return json({ error: message }, status);
  }
});
