import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    Deno.env.get("APP_ORIGIN") ??
    "https://lander-solutions-git-dev-lander-sistemas-projects.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const permissions: Record<string, string> = {
  "submit-asset-event": "assets.manage",
  "approve-asset-event": "assets.approve",
  "reject-asset-event": "assets.approve",
  "apply-asset-event": "assets.apply",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
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
  const permission = permissions[action];
  const expectedVersion = payload.expectedVersion;
  if (!permission) return json({ error: "Ação administrativa de Patrimônio desconhecida." }, 400);
  if (!Number.isInteger(expectedVersion) || Number(expectedVersion) < 1) {
    return json({ error: "Versão esperada inválida." }, 422);
  }
  if (!isUuid(payload.eventId)) return json({ error: "Evento de ativo inválido." }, 422);

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

  const { data: event } = await adminClient
    .from("asset_events")
    .select("asset_id")
    .eq("id", payload.eventId)
    .maybeSingle();
  if (!event) return json({ error: "Evento de ativo não encontrado." }, 404);

  const { data: asset } = await adminClient
    .from("corporate_assets")
    .select("business_unit_id")
    .eq("id", event.asset_id)
    .maybeSingle();
  if (!asset) return json({ error: "Ativo corporativo não encontrado." }, 404);

  let unitCode: string | null = null;
  if (asset.business_unit_id) {
    const { data: unit } = await adminClient
      .from("business_units")
      .select("code")
      .eq("id", asset.business_unit_id)
      .maybeSingle();
    unitCode = unit?.code ?? null;
  }

  const { data: authorized, error: permissionError } = await callerClient.rpc("has_permission", {
    p_permission_code: permission,
    p_unit_code: unitCode,
  });
  if (permissionError || !authorized) return json({ error: "Permissão insuficiente." }, 403);

  const rpcArgs: Record<string, unknown> = {
    p_event_id: payload.eventId,
    p_expected_version: Number(expectedVersion),
    p_actor_user_id: caller.id,
  };
  let rpcName = "";
  if (action === "submit-asset-event") rpcName = "admin_submit_asset_event";
  if (action === "approve-asset-event" || action === "reject-asset-event") {
    rpcName = "admin_decide_asset_event";
    rpcArgs.p_approve = action === "approve-asset-event";
    rpcArgs.p_reason = typeof payload.reason === "string" ? payload.reason.trim() || null : null;
  }
  if (action === "apply-asset-event") rpcName = "admin_apply_asset_event";

  const { data, error } = await adminClient.rpc(rpcName, rpcArgs);
  if (error) return json({ error: error.message }, 409);
  if (!data) return json({ error: "O registro foi alterado por outro usuário." }, 409);
  return json({ result: data });
});
