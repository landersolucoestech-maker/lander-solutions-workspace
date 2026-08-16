import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    Deno.env.get("APP_ORIGIN") ??
    "https://lander-solutions-git-dev-lander-sistemas-projects.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedStatuses = new Set(["planned", "active", "inactive", "discontinued"]);

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

function normalizeCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return normalized || null;
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
  if (!new Set(["create-service", "update-service"]).has(action)) {
    return json({ error: "Ação administrativa desconhecida." }, 400);
  }

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

  const { data: aal2, error: aalError } = await callerClient.rpc("has_aal2");
  if (aalError || !aal2) return json({ error: "A operação exige MFA aal2." }, 403);

  const businessUnitId = payload.businessUnitId;
  if (!isUuid(businessUnitId)) return json({ error: "Unidade de negócio inválida." }, 422);

  const { data: businessUnit, error: unitError } = await adminClient
    .from("business_units")
    .select("id,code,status")
    .eq("id", businessUnitId)
    .maybeSingle();
  if (unitError || !businessUnit) return json({ error: "Unidade não encontrada." }, 404);
  if (businessUnit.status !== "active") {
    return json({ error: "A unidade de negócio precisa estar ativa." }, 422);
  }

  const { data: allowed, error: permissionError } = await callerClient.rpc("has_permission", {
    p_permission_code: "corporate.manage",
    p_unit_code: String(businessUnit.code),
  });
  if (permissionError || !allowed) return json({ error: "Permissão insuficiente." }, 403);

  const code = normalizeCode(payload.code);
  const name = requiredText(payload.name, 2, 160);
  const description = optionalText(payload.description, 1000);
  const status = typeof payload.status === "string" ? payload.status : "";
  if (!code || !name) return json({ error: "Nome e código do serviço são obrigatórios." }, 422);
  if (!allowedStatuses.has(status)) return json({ error: "Situação do serviço inválida." }, 422);

  if (action === "create-service") {
    const { data, error } = await adminClient
      .from("service_lines")
      .insert({
        business_unit_id: businessUnitId,
        code,
        name,
        description,
        service_type: "lead_interest",
        status,
        start_date: null,
        end_date: null,
        is_system: false,
      })
      .select("*")
      .single();
    if (error) return json({ error: error.message }, 409);
    return json({ service: data }, 201);
  }

  const serviceId = payload.serviceId;
  const expectedVersion = Number(payload.expectedVersion);
  if (!isUuid(serviceId)) return json({ error: "Serviço inválido." }, 422);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return json({ error: "Versão esperada inválida." }, 422);
  }

  const { data: current, error: currentError } = await adminClient
    .from("service_lines")
    .select("id,business_unit_id,code,is_system,version")
    .eq("id", serviceId)
    .maybeSingle();
  if (currentError || !current) return json({ error: "Serviço não encontrado." }, 404);
  if (current.business_unit_id !== businessUnitId) {
    return json({ error: "O serviço não pertence à unidade informada." }, 422);
  }

  const values: Record<string, unknown> = {
    name,
    description,
    status,
  };
  if (!current.is_system) {
    values.code = code;
    values.service_type = "lead_interest";
  }

  const { data, error } = await adminClient
    .from("service_lines")
    .update(values)
    .eq("id", serviceId)
    .eq("version", expectedVersion)
    .select("*")
    .maybeSingle();
  if (error) return json({ error: error.message }, 409);
  if (!data) return json({ error: "O serviço foi alterado por outro usuário." }, 409);
  return json({ service: data });
});
