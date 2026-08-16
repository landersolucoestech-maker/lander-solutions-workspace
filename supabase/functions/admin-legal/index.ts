import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    Deno.env.get("APP_ORIGIN") ??
    "https://lander-solutions-git-dev-lander-sistemas-projects.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

async function matterUnitCode(client: SupabaseClient, matterId: string) {
  const { data: matter, error: matterError } = await client
    .from("legal_matters")
    .select("business_unit_id")
    .eq("id", matterId)
    .maybeSingle();
  if (matterError || !matter) throw new Error("Assunto jurídico não encontrado.");
  if (!matter.business_unit_id) return null;

  const { data: unit, error: unitError } = await client
    .from("business_units")
    .select("code")
    .eq("id", matter.business_unit_id)
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
  if (!supabaseUrl || !anonKey) {
    return json({ error: "Configuração interna incompleta." }, 500);
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Corpo JSON inválido." }, 400);
  }

  const action = typeof payload.action === "string" ? payload.action : "";
  if (action !== "close-legal-matter") {
    return json({ error: "Ação jurídica desconhecida." }, 400);
  }

  if (!isUuid(payload.matterId)) {
    return json({ error: "Assunto jurídico inválido." }, 422);
  }
  if (!Number.isInteger(payload.expectedVersion) || Number(payload.expectedVersion) < 1) {
    return json({ error: "Versão esperada inválida." }, 422);
  }
  const outcome = typeof payload.outcome === "string" ? payload.outcome.trim() : "";
  if (outcome.length < 3) {
    return json({ error: "Resultado do encerramento obrigatório." }, 422);
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

  try {
    const unitCode = await matterUnitCode(client, payload.matterId);
    const { data: allowed, error: permissionError } = await client.rpc("has_permission", {
      p_permission_code: "legal.close",
      p_unit_code: unitCode,
    });
    if (permissionError || allowed !== true) {
      return json({ error: "Permissão insuficiente." }, 403);
    }

    const { data, error } = await client.rpc("close_legal_matter", {
      p_matter_id: payload.matterId,
      p_expected_version: Number(payload.expectedVersion),
      p_outcome: outcome,
    });

    if (error) {
      const status = error.code === "42501" ? 403 : 409;
      return json({ error: error.message }, status);
    }
    if (!data) {
      return json({ error: "O assunto jurídico foi alterado por outro usuário." }, 409);
    }

    return json({ result: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha inesperada.";
    const status = message.includes("não encontrado")
      ? 404
      : message.includes("Permissão insuficiente")
        ? 403
        : 409;
    return json({ error: message }, status);
  }
});
