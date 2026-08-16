import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    Deno.env.get("APP_ORIGIN") ??
    "https://lander-solutions-git-dev-lander-sistemas-projects.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const actions = new Set(["approve-version", "activate-contract", "terminate-contract"]);

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
  if (!actions.has(action)) return json({ error: "Ação administrativa desconhecida." }, 400);

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

  async function contractContext(contractId: string) {
    const { data, error } = await adminClient
      .from("contracts")
      .select("id,business_unit_id")
      .eq("id", contractId)
      .maybeSingle();
    if (error || !data) return null;
    const { data: unit, error: unitError } = await adminClient
      .from("business_units")
      .select("code")
      .eq("id", data.business_unit_id)
      .maybeSingle();
    if (unitError || !unit) return null;
    return { contractId: data.id as string, unitCode: unit.code as string };
  }

  async function authorize(permissionCode: string, unitCode: string): Promise<boolean> {
    const { data, error } = await callerClient.rpc("has_permission", {
      p_permission_code: permissionCode,
      p_unit_code: unitCode,
    });
    return !error && data === true;
  }

  const expectedVersion = payload.expectedVersion;
  if (!Number.isInteger(expectedVersion) || Number(expectedVersion) < 1) {
    return json({ error: "Versão esperada inválida." }, 422);
  }

  if (action === "approve-version") {
    const versionId = payload.versionId;
    if (!isUuid(versionId)) return json({ error: "Identificador da versão inválido." }, 422);

    const { data: version, error: versionError } = await adminClient
      .from("contract_versions")
      .select("id,contract_id")
      .eq("id", versionId)
      .maybeSingle();
    if (versionError || !version) return json({ error: "Versão contratual não encontrada." }, 404);

    const context = await contractContext(String(version.contract_id));
    if (!context) return json({ error: "Contrato ou unidade não encontrados." }, 404);
    if (!(await authorize("contracts.approve", context.unitCode))) {
      return json({ error: "Permissão de aprovação insuficiente." }, 403);
    }

    const { data, error } = await adminClient.rpc("admin_approve_contract_version", {
      p_version_id: versionId,
      p_expected_version: Number(expectedVersion),
      p_actor_user_id: caller.id,
    });
    if (error) return json({ error: error.message }, 409);
    if (!data) return json({ error: "A versão foi alterada por outro usuário." }, 409);
    return json({ version: data });
  }

  const contractId = payload.contractId;
  if (!isUuid(contractId)) return json({ error: "Identificador do contrato inválido." }, 422);
  const context = await contractContext(contractId);
  if (!context) return json({ error: "Contrato não encontrado." }, 404);

  if (action === "activate-contract") {
    if (!(await authorize("contracts.approve", context.unitCode))) {
      return json({ error: "Permissão de ativação insuficiente." }, 403);
    }
    const { data, error } = await adminClient.rpc("admin_activate_contract", {
      p_contract_id: contractId,
      p_expected_version: Number(expectedVersion),
      p_actor_user_id: caller.id,
    });
    if (error) return json({ error: error.message }, 409);
    if (!data) return json({ error: "O contrato foi alterado por outro usuário." }, 409);
    return json({ contract: data });
  }

  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
  if (reason.length < 5 || reason.length > 2000) {
    return json({ error: "Motivo de encerramento inválido." }, 422);
  }
  if (!(await authorize("contracts.terminate", context.unitCode))) {
    return json({ error: "Permissão de encerramento insuficiente." }, 403);
  }
  const { data, error } = await adminClient.rpc("admin_terminate_contract", {
    p_contract_id: contractId,
    p_expected_version: Number(expectedVersion),
    p_reason: reason,
    p_actor_user_id: caller.id,
  });
  if (error) return json({ error: error.message }, 409);
  if (!data) return json({ error: "O contrato foi alterado por outro usuário." }, 409);
  return json({ contract: data });
});
