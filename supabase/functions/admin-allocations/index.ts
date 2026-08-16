import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    Deno.env.get("APP_ORIGIN") ??
    "https://lander-solutions-git-dev-lander-sistemas-projects.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const workflowActions: Record<string, string> = {
  "submit-rule-version": "submit-version",
  "approve-rule-version": "approve-version",
  "reject-rule-version": "reject-version",
  "simulate-run": "simulate-run",
  "submit-run": "submit-run",
  "approve-run": "approve-run",
  "reject-run": "reject-run",
  "post-run": "post-run",
  "reverse-run": "reverse-run",
};

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json({ error: "Autenticação obrigatória." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return json({ error: "Configuração interna incompleta." }, 500);

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Corpo JSON inválido." }, 400);
  }

  const externalAction = typeof payload.action === "string" ? payload.action : "";
  const workflowAction = workflowActions[externalAction];
  if (!workflowAction) return json({ error: "Ação administrativa desconhecida." }, 400);

  const expectedVersion = payload.expectedVersion;
  if (!Number.isInteger(expectedVersion) || Number(expectedVersion) < 1) {
    return json({ error: "Versão esperada inválida." }, 422);
  }

  const recordId = externalAction.includes("rule-version") ? payload.versionId : payload.runId;
  if (!isUuid(recordId)) return json({ error: "Identificador de rateio inválido." }, 422);

  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
  if (
    ["reject-rule-version", "reject-run", "reverse-run"].includes(externalAction) &&
    (reason.length < 5 || reason.length > 2000)
  ) {
    return json({ error: "Motivo inválido." }, 422);
  }

  const reversalDate = typeof payload.reversalDate === "string" ? payload.reversalDate : "";
  if (externalAction === "reverse-run" && !/^\d{4}-\d{2}-\d{2}$/.test(reversalDate)) {
    return json({ error: "Data de estorno inválida." }, 422);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await callerClient.rpc("run_allocation_workflow", {
    p_action: workflowAction,
    p_record_id: recordId,
    p_expected_version: Number(expectedVersion),
    p_reason: reason || null,
    p_reversal_date: externalAction === "reverse-run" ? reversalDate : null,
  });
  if (error) {
    const status = error.code === "42501" ? 403 : 409;
    return json({ error: error.message }, status);
  }
  if (!data) return json({ error: "O registro foi alterado por outro usuário." }, 409);
  return json({ [externalAction.includes("rule-version") ? "version" : "run"]: data });
});
