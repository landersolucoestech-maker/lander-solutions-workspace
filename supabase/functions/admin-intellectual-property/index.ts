import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    Deno.env.get("APP_ORIGIN") ??
    "https://lander-solutions-git-dev-lander-sistemas-projects.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const permissions: Record<string, string> = {
  "approve-ip-event": "ip.approve",
  "reject-ip-event": "ip.approve",
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

async function eventUnitCode(client: SupabaseClient, eventId: string) {
  const { data: event, error: eventError } = await client
    .from("intellectual_property_events")
    .select("intellectual_property_id")
    .eq("id", eventId)
    .maybeSingle();
  if (eventError || !event) throw new Error("Evento de propriedade intelectual não encontrado.");

  const { data: asset, error: assetError } = await client
    .from("intellectual_property_assets")
    .select("business_unit_id")
    .eq("id", event.intellectual_property_id)
    .maybeSingle();
  if (assetError || !asset) throw new Error("Ativo de propriedade intelectual não encontrado.");
  if (!asset.business_unit_id) return null;

  const { data: unit, error: unitError } = await client
    .from("business_units")
    .select("code")
    .eq("id", asset.business_unit_id)
    .maybeSingle();
  if (unitError || !unit) throw new Error("Unidade de negócio não encontrada.");
  return String(unit.code);
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
  if (!permission) return json({ error: "Ação de propriedade intelectual desconhecida." }, 400);
  if (!isUuid(payload.eventId)) {
    return json({ error: "Evento de propriedade intelectual inválido." }, 422);
  }
  if (!Number.isInteger(payload.expectedVersion) || Number(payload.expectedVersion) < 1) {
    return json({ error: "Versão esperada inválida." }, 422);
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
    const unitCode = await eventUnitCode(adminClient, payload.eventId);
    const { data: allowed, error: permissionError } = await callerClient.rpc("has_permission", {
      p_permission_code: permission,
      p_unit_code: unitCode,
    });
    if (permissionError || allowed !== true) {
      return json({ error: "Permissão insuficiente." }, 403);
    }

    const { data, error } = await adminClient.rpc("admin_apply_ip_event", {
      p_event_id: payload.eventId,
      p_expected_version: Number(payload.expectedVersion),
      p_actor_user_id: caller.id,
      p_accept: action === "approve-ip-event",
      p_reason: typeof payload.reason === "string" ? payload.reason.trim() || null : null,
    });
    if (error) {
      const status = error.code === "42501" ? 403 : 409;
      return json({ error: error.message }, status);
    }
    if (!data) {
      return json({ error: "O evento foi alterado por outro usuário." }, 409);
    }
    return json({ result: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha inesperada.";
    const status = message.includes("não encontrad")
      ? 404
      : message.includes("Permissão insuficiente")
        ? 403
        : 409;
    return json({ error: message }, status);
  }
});
