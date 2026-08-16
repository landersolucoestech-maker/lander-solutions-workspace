import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    Deno.env.get("APP_ORIGIN") ??
    "https://lander-solutions-git-dev-lander-sistemas-projects.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = {
  action?: string;
  obligationId?: string;
  paymentId?: string;
  expectedVersion?: number;
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
  const permissionCode = action === "list-settlements" ? "payout.read" : "payout.post";
  if (!new Set(["list-settlements", "post-payment"]).has(action)) {
    return json({ error: "Ação de repasse desconhecida." }, 400);
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
    if (action === "list-settlements") {
      if (!isUuid(body.obligationId)) return json({ error: "Obrigação de repasse inválida." }, 422);
      const { data, error } = await client.rpc("list_available_payout_settlements", {
        p_obligation_id: body.obligationId,
      });
      if (error) throw error;
      return json({ settlements: data ?? [] });
    }

    if (!isUuid(body.paymentId)) return json({ error: "Pagamento de repasse inválido." }, 422);
    const version = Number(body.expectedVersion);
    if (!Number.isSafeInteger(version) || version < 1) {
      return json({ error: "Versão esperada inválida." }, 422);
    }

    const { data, error } = await client.rpc("post_payout_payment", {
      p_payment_id: body.paymentId,
      p_expected_version: version,
    });
    if (error) throw error;
    if (!data) return json({ error: "O pagamento foi modificado por outro usuário." }, 409);
    return json({ result: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no workflow de repasse.";
    const status =
      message.includes("Permissão") || message.includes("MFA")
        ? 403
        : message.includes("inválid") ||
            message.includes("obrigatóri") ||
            message.includes("não encontrada")
          ? 422
          : 409;
    return json({ error: message }, status);
  }
});
