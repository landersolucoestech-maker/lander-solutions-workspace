import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    Deno.env.get("APP_ORIGIN") ??
    "https://lander-solutions-git-dev-lander-sistemas-projects.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const permissions: Record<string, string> = {
  "qualify-lead": "crm.convert",
  "submit-proposal": "crm.proposals.manage",
  "approve-proposal": "crm.proposals.approve",
  "reject-proposal": "crm.proposals.approve",
  "send-proposal": "crm.proposals.manage",
  "accept-proposal": "crm.convert",
  "reject-sent-proposal": "crm.convert",
  "close-opportunity-lost": "crm.opportunities.manage",
  "convert-opportunity-project": "crm.convert",
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
  if (!permission) return json({ error: "Ação administrativa desconhecida." }, 400);
  if (!Number.isInteger(expectedVersion) || Number(expectedVersion) < 1) {
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

  let unitCode: string | null = null;
  let recordId: string | null = null;
  let rpcName = "";
  const rpcArgs: Record<string, unknown> = {
    p_expected_version: Number(expectedVersion),
    p_actor_user_id: caller.id,
  };

  if (action === "qualify-lead") {
    if (!isUuid(payload.leadId)) return json({ error: "Lead inválido." }, 422);
    recordId = payload.leadId;
    const { data: lead } = await adminClient
      .from("crm_leads")
      .select("business_unit_id")
      .eq("id", recordId)
      .maybeSingle();
    if (!lead) return json({ error: "Lead não encontrado." }, 404);
    const { data: unit } = await adminClient
      .from("business_units")
      .select("code")
      .eq("id", lead.business_unit_id)
      .maybeSingle();
    unitCode = unit?.code ?? null;
    rpcName = "admin_qualify_crm_lead";
    rpcArgs.p_lead_id = recordId;
  } else if (
    [
      "submit-proposal",
      "approve-proposal",
      "reject-proposal",
      "send-proposal",
      "accept-proposal",
      "reject-sent-proposal",
    ].includes(action)
  ) {
    if (!isUuid(payload.proposalVersionId)) {
      return json({ error: "Versão de proposta inválida." }, 422);
    }
    recordId = payload.proposalVersionId;
    const { data: version } = await adminClient
      .from("crm_proposal_versions")
      .select("proposal_id")
      .eq("id", recordId)
      .maybeSingle();
    if (!version) return json({ error: "Versão de proposta não encontrada." }, 404);
    const { data: proposal } = await adminClient
      .from("crm_proposals")
      .select("business_unit_id")
      .eq("id", version.proposal_id)
      .maybeSingle();
    if (!proposal) return json({ error: "Proposta não encontrada." }, 404);
    const { data: unit } = await adminClient
      .from("business_units")
      .select("code")
      .eq("id", proposal.business_unit_id)
      .maybeSingle();
    unitCode = unit?.code ?? null;
    rpcArgs.p_proposal_version_id = recordId;

    if (action === "submit-proposal") rpcName = "admin_submit_crm_proposal";
    if (action === "approve-proposal" || action === "reject-proposal") {
      rpcName = "admin_decide_crm_proposal";
      rpcArgs.p_approve = action === "approve-proposal";
      rpcArgs.p_reason = typeof payload.reason === "string" ? payload.reason.trim() || null : null;
    }
    if (action === "send-proposal") rpcName = "admin_send_crm_proposal";
    if (action === "accept-proposal" || action === "reject-sent-proposal") {
      rpcName = "admin_resolve_crm_proposal";
      rpcArgs.p_accept = action === "accept-proposal";
      rpcArgs.p_reason = typeof payload.reason === "string" ? payload.reason.trim() || null : null;
    }
  } else {
    if (!isUuid(payload.opportunityId)) {
      return json({ error: "Oportunidade inválida." }, 422);
    }
    recordId = payload.opportunityId;
    const { data: opportunity } = await adminClient
      .from("crm_opportunities")
      .select("business_unit_id")
      .eq("id", recordId)
      .maybeSingle();
    if (!opportunity) return json({ error: "Oportunidade não encontrada." }, 404);
    const { data: unit } = await adminClient
      .from("business_units")
      .select("code")
      .eq("id", opportunity.business_unit_id)
      .maybeSingle();
    unitCode = unit?.code ?? null;
    rpcArgs.p_opportunity_id = recordId;

    if (action === "close-opportunity-lost") {
      rpcName = "admin_close_crm_opportunity_lost";
      rpcArgs.p_reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
    }
    if (action === "convert-opportunity-project") {
      rpcName = "admin_convert_crm_opportunity_to_project";
    }
  }

  const { data: authorized, error: permissionError } = await callerClient.rpc("has_permission", {
    p_permission_code: permission,
    p_unit_code: unitCode,
  });
  if (permissionError || !authorized) return json({ error: "Permissão insuficiente." }, 403);

  const { data, error } = await adminClient.rpc(rpcName, rpcArgs);
  if (error) return json({ error: error.message }, 409);
  if (!data) return json({ error: "O registro foi alterado por outro usuário." }, 409);
  return json({ result: data });
});
