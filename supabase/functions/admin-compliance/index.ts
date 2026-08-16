import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    Deno.env.get("APP_ORIGIN") ??
    "https://lander-solutions-git-dev-lander-sistemas-projects.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = Record<string, unknown>;

const actionPermissions: Record<string, string> = {
  "complete-occurrence": "compliance.complete",
  "waive-occurrence": "compliance.waive",
  "submit-policy-version": "policies.manage",
  "approve-policy-version": "policies.approve",
  "reject-policy-version": "policies.approve",
  "publish-policy-version": "policies.publish",
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

function expectedVersion(value: unknown): number {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) {
    throw new Error("Versão esperada inválida.");
  }
  return version;
}

function optionalText(value: unknown, maxLength = 5000): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("Valor textual inválido.");
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new Error("Valor textual excede o limite permitido.");
  return normalized || null;
}

async function unitCodeForBusinessUnit(client: SupabaseClient, businessUnitId: string | null) {
  if (!businessUnitId) return null;
  const { data, error } = await client
    .from("business_units")
    .select("code")
    .eq("id", businessUnitId)
    .maybeSingle();
  if (error || !data) throw new Error("Unidade de negócio não encontrada.");
  return String(data.code);
}

async function occurrenceUnitCode(client: SupabaseClient, occurrenceId: string) {
  const { data: occurrence, error: occurrenceError } = await client
    .from("compliance_occurrences")
    .select("compliance_obligation_id")
    .eq("id", occurrenceId)
    .maybeSingle();
  if (occurrenceError || !occurrence) throw new Error("Ocorrência não encontrada.");

  const { data: obligation, error: obligationError } = await client
    .from("compliance_obligations")
    .select("business_unit_id")
    .eq("id", occurrence.compliance_obligation_id)
    .maybeSingle();
  if (obligationError || !obligation) throw new Error("Obrigação de compliance não encontrada.");

  return unitCodeForBusinessUnit(
    client,
    obligation.business_unit_id ? String(obligation.business_unit_id) : null,
  );
}

async function policyVersionUnitCode(client: SupabaseClient, versionId: string) {
  const { data: version, error: versionError } = await client
    .from("corporate_policy_versions")
    .select("policy_id")
    .eq("id", versionId)
    .maybeSingle();
  if (versionError || !version) throw new Error("Versão de política não encontrada.");

  const { data: policy, error: policyError } = await client
    .from("corporate_policies")
    .select("business_unit_id")
    .eq("id", version.policy_id)
    .maybeSingle();
  if (policyError || !policy) throw new Error("Política corporativa não encontrada.");

  return unitCodeForBusinessUnit(
    client,
    policy.business_unit_id ? String(policy.business_unit_id) : null,
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
  if (!supabaseUrl || !anonKey) {
    return json({ error: "Configuração interna incompleta." }, 500);
  }

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return json({ error: "Corpo JSON inválido." }, 400);
  }

  const action = typeof payload.action === "string" ? payload.action : "";
  const permissionCode = actionPermissions[action];
  if (!permissionCode) {
    return json({ error: "Ação de compliance ou política desconhecida." }, 400);
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
    let unitCode: string | null;
    if (action === "complete-occurrence" || action === "waive-occurrence") {
      if (!isUuid(payload.occurrenceId)) throw new Error("Ocorrência inválida.");
      unitCode = await occurrenceUnitCode(client, payload.occurrenceId);
    } else {
      if (!isUuid(payload.versionId)) throw new Error("Versão de política inválida.");
      unitCode = await policyVersionUnitCode(client, payload.versionId);
    }

    const { data: allowed, error: permissionError } = await client.rpc("has_permission", {
      p_permission_code: permissionCode,
      p_unit_code: unitCode,
    });
    if (permissionError || allowed !== true) {
      return json({ error: "Permissão insuficiente." }, 403);
    }

    let result: unknown;

    if (action === "complete-occurrence") {
      const { data, error } = await client.rpc("complete_compliance_occurrence", {
        p_occurrence_id: payload.occurrenceId,
        p_expected_version: expectedVersion(payload.expectedVersion),
        p_evidence_reference: optionalText(payload.evidenceReference, 1000),
        p_notes: optionalText(payload.notes),
      });
      if (error) throw error;
      result = data;
    } else if (action === "waive-occurrence") {
      const reason = optionalText(payload.reason, 2000);
      if (!reason || reason.length < 3) throw new Error("Motivo da dispensa obrigatório.");
      const { data, error } = await client.rpc("waive_compliance_occurrence", {
        p_occurrence_id: payload.occurrenceId,
        p_expected_version: expectedVersion(payload.expectedVersion),
        p_reason: reason,
      });
      if (error) throw error;
      result = data;
    } else if (action === "submit-policy-version") {
      const { data, error } = await client.rpc("submit_policy_version", {
        p_version_id: payload.versionId,
        p_expected_version: expectedVersion(payload.expectedVersion),
      });
      if (error) throw error;
      result = data;
    } else if (action === "approve-policy-version" || action === "reject-policy-version") {
      const approve = action === "approve-policy-version";
      const reason = optionalText(payload.reason, 2000);
      if (!approve && (!reason || reason.length < 3)) {
        throw new Error("Motivo da rejeição obrigatório.");
      }
      const { data, error } = await client.rpc("decide_policy_version", {
        p_version_id: payload.versionId,
        p_expected_version: expectedVersion(payload.expectedVersion),
        p_approve: approve,
        p_reason: reason,
      });
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await client.rpc("publish_policy_version", {
        p_version_id: payload.versionId,
        p_expected_version: expectedVersion(payload.expectedVersion),
      });
      if (error) throw error;
      result = data;
    }

    if (!result) {
      return json({ error: "O registro foi alterado por outro usuário." }, 409);
    }
    return json({ result });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    const message = error instanceof Error ? error.message : "Falha inesperada.";
    const status =
      code === "42501" || message.includes("Permissão insuficiente")
        ? 403
        : message.includes("não encontrada")
          ? 404
          : message.includes("inválid") ||
              message.includes("obrigatório") ||
              message.includes("não pode") ||
              message.includes("Somente") ||
              message.includes("Autoaprovação")
            ? 422
            : 409;
    return json({ error: message }, status);
  }
});
