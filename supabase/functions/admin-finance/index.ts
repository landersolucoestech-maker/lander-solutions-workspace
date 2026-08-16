import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    Deno.env.get("APP_ORIGIN") ??
    "https://lander-solutions-git-dev-lander-sistemas-projects.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const actionPermissions: Record<string, string> = {
  "submit-document": "finance.documents.manage_draft",
  "approve-document": "finance.documents.approve",
  "submit-settlement": "finance.settlements.create",
  "post-settlement": "finance.settlements.post",
  "submit-journal": "ledger.create",
  "post-journal": "ledger.post",
  "reverse-journal": "ledger.reverse",
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
  const permissionCode = actionPermissions[action];
  if (!permissionCode) return json({ error: "Ação administrativa desconhecida." }, 400);

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

  async function authorize(unitCode: string | null): Promise<boolean> {
    const { data, error } = await callerClient.rpc("has_permission", {
      p_permission_code: permissionCode,
      p_unit_code: unitCode,
    });
    return !error && data === true;
  }

  async function documentContext(documentId: string) {
    const { data: document, error } = await adminClient
      .from("financial_documents")
      .select("id,business_unit_id")
      .eq("id", documentId)
      .maybeSingle();
    if (error || !document) return null;
    const { data: unit, error: unitError } = await adminClient
      .from("business_units")
      .select("code")
      .eq("id", document.business_unit_id)
      .maybeSingle();
    if (unitError || !unit) return null;
    return { documentId: String(document.id), unitCode: String(unit.code) };
  }

  async function settlementContext(settlementId: string) {
    const { data: settlement, error } = await adminClient
      .from("financial_settlements")
      .select("id,financial_document_id")
      .eq("id", settlementId)
      .maybeSingle();
    if (error || !settlement) return null;
    return documentContext(String(settlement.financial_document_id));
  }

  const expectedVersion = payload.expectedVersion;
  if (!Number.isInteger(expectedVersion) || Number(expectedVersion) < 1) {
    return json({ error: "Versão esperada inválida." }, 422);
  }

  if (action === "submit-document" || action === "approve-document") {
    const documentId = payload.documentId;
    if (!isUuid(documentId)) return json({ error: "Identificador do documento inválido." }, 422);
    const context = await documentContext(documentId);
    if (!context) return json({ error: "Documento financeiro não encontrado." }, 404);
    if (!(await authorize(context.unitCode)))
      return json({ error: "Permissão insuficiente." }, 403);

    const rpcName =
      action === "submit-document"
        ? "admin_submit_financial_document"
        : "admin_approve_financial_document";
    const { data, error } = await adminClient.rpc(rpcName, {
      p_document_id: documentId,
      p_expected_version: Number(expectedVersion),
      p_actor_user_id: caller.id,
    });
    if (error) return json({ error: error.message }, 409);
    if (!data) return json({ error: "O documento foi alterado por outro usuário." }, 409);
    return json({ document: data });
  }

  if (action === "submit-settlement" || action === "post-settlement") {
    const settlementId = payload.settlementId;
    if (!isUuid(settlementId)) return json({ error: "Identificador da liquidação inválido." }, 422);
    const context = await settlementContext(settlementId);
    if (!context) return json({ error: "Liquidação ou documento não encontrados." }, 404);
    if (!(await authorize(context.unitCode)))
      return json({ error: "Permissão insuficiente." }, 403);

    const rpcName =
      action === "submit-settlement"
        ? "admin_submit_financial_settlement"
        : "admin_post_financial_settlement";
    const { data, error } = await adminClient.rpc(rpcName, {
      p_settlement_id: settlementId,
      p_expected_version: Number(expectedVersion),
      p_actor_user_id: caller.id,
    });
    if (error) return json({ error: error.message }, 409);
    if (!data) return json({ error: "A liquidação foi alterada por outro usuário." }, 409);
    return json({ settlement: data });
  }

  const entryId = payload.entryId;
  if (!isUuid(entryId)) return json({ error: "Identificador do lançamento inválido." }, 422);
  if (!(await authorize(null))) return json({ error: "Permissão insuficiente." }, 403);

  if (action === "submit-journal" || action === "post-journal") {
    const rpcName =
      action === "submit-journal" ? "admin_submit_manual_journal" : "admin_post_manual_journal";
    const { data, error } = await adminClient.rpc(rpcName, {
      p_entry_id: entryId,
      p_expected_version: Number(expectedVersion),
      p_actor_user_id: caller.id,
    });
    if (error) return json({ error: error.message }, 409);
    if (!data) return json({ error: "O lançamento foi alterado por outro usuário." }, 409);
    return json({ entry: data });
  }

  const reversalDate = typeof payload.reversalDate === "string" ? payload.reversalDate : "";
  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reversalDate) || reason.length < 5 || reason.length > 2000) {
    return json({ error: "Data ou motivo de estorno inválido." }, 422);
  }
  const { data, error } = await adminClient.rpc("admin_reverse_journal_entry", {
    p_entry_id: entryId,
    p_expected_version: Number(expectedVersion),
    p_reversal_date: reversalDate,
    p_reason: reason,
    p_actor_user_id: caller.id,
  });
  if (error) return json({ error: error.message }, 409);
  if (!data) return json({ error: "O lançamento foi alterado por outro usuário." }, 409);
  return json({ entry: data });
});
