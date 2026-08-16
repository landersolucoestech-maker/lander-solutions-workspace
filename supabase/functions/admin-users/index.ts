import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    Deno.env.get("APP_ORIGIN") ??
    "https://lander-solutions-git-dev-lander-sistemas-projects.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const userActions = new Set(["invite", "set-status", "delete"]);
const roleActions = new Set(["assign-role", "revoke-role"]);
const validStatuses = new Set(["active", "suspended", "inactive"]);

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

function isEmail(value: unknown): value is string {
  return (
    typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function parseReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const reason = value.trim();
  return reason.length >= 5 && reason.length <= 500 ? reason : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer "))
    return json({ error: "Autenticação obrigatória." }, 401);

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
  if (!userActions.has(action) && !roleActions.has(action)) {
    return json({ error: "Ação administrativa desconhecida." }, 400);
  }

  const requiredPermission = userActions.has(action)
    ? "access.users.manage"
    : "access.roles.manage";
  const token = authorization.slice("Bearer ".length);
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser(token);

  if (callerError || !caller) return json({ error: "Sessão inválida ou expirada." }, 401);

  const [{ data: canManage, error: permissionError }, { data: hasAal2, error: aalError }] =
    await Promise.all([
      callerClient.rpc("has_permission", {
        p_permission_code: requiredPermission,
        p_unit_code: null,
      }),
      callerClient.rpc("has_aal2"),
    ]);

  if (permissionError || aalError) {
    return json({ error: "Não foi possível validar a autorização." }, 403);
  }

  if (!canManage || !hasAal2) {
    return json({ error: "A operação exige permissão administrativa e MFA aal2." }, 403);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (action === "invite") {
    const email =
      typeof payload.email === "string" ? payload.email.trim().toLowerCase() : payload.email;
    const displayName = typeof payload.displayName === "string" ? payload.displayName.trim() : "";

    if (!isEmail(email)) return json({ error: "E-mail inválido." }, 422);
    if (displayName.length < 2 || displayName.length > 120) {
      return json({ error: "O nome deve possuir entre 2 e 120 caracteres." }, 422);
    }

    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { display_name: displayName },
    });

    if (error) return json({ error: error.message }, error.status ?? 400);

    await adminClient.from("audit_events").insert({
      actor_user_id: caller.id,
      action: "invite",
      entity_schema: "auth",
      entity_table: "users",
      entity_id: data.user?.id ?? null,
      after_data: { email, display_name: displayName, invited: true },
      metadata: { source: "edge-function:admin-users" },
    });

    return json({ user: { id: data.user?.id, email: data.user?.email } }, 201);
  }

  if (action === "set-status") {
    const userId = payload.userId;
    const status = payload.status;
    const expectedVersion = payload.expectedVersion;
    const reason = parseReason(payload.reason);

    if (!isUuid(userId)) return json({ error: "Identificador de usuário inválido." }, 422);
    if (userId === caller.id)
      return json({ error: "O usuário não pode alterar o próprio status." }, 409);
    if (typeof status !== "string" || !validStatuses.has(status)) {
      return json({ error: "Status de destino inválido." }, 422);
    }
    if (!Number.isInteger(expectedVersion) || Number(expectedVersion) < 1) {
      return json({ error: "Versão esperada inválida." }, 422);
    }
    if (!reason)
      return json({ error: "A justificativa deve possuir entre 5 e 500 caracteres." }, 422);

    const { data: before, error: beforeError } = await adminClient
      .from("profiles")
      .select("id,email,display_name,status,mfa_required,version")
      .eq("id", userId)
      .single();

    if (beforeError) return json({ error: beforeError.message }, 404);

    const { data: after, error: updateError } = await adminClient
      .from("profiles")
      .update({ status })
      .eq("id", userId)
      .eq("version", expectedVersion)
      .select("id,email,display_name,status,mfa_required,version")
      .maybeSingle();

    if (updateError) return json({ error: updateError.message }, 409);
    if (!after) {
      return json(
        { error: "O registro foi alterado por outro usuário. Atualize a tela e tente novamente." },
        409,
      );
    }

    await adminClient.from("audit_events").insert({
      actor_user_id: caller.id,
      action: "status_change_reason",
      entity_schema: "public",
      entity_table: "profiles",
      entity_id: userId,
      before_data: before,
      after_data: after,
      metadata: { reason, source: "edge-function:admin-users" },
    });

    return json({ profile: after });
  }

  if (action === "assign-role") {
    const userId = payload.userId;
    const roleId = payload.roleId;
    const unitCode = payload.unitCode === null ? null : payload.unitCode;
    const reason = parseReason(payload.reason);

    if (!isUuid(userId) || !isUuid(roleId)) {
      return json({ error: "Usuário ou papel inválido." }, 422);
    }
    if (unitCode !== null && typeof unitCode !== "string") {
      return json({ error: "Escopo de unidade inválido." }, 422);
    }
    if (typeof unitCode === "string") {
      const { data: unit, error: unitError } = await adminClient
        .from("business_units")
        .select("code")
        .eq("code", unitCode)
        .eq("status", "active")
        .maybeSingle();
      if (unitError || !unit) return json({ error: "Escopo de unidade inválido." }, 422);
    }
    if (!reason)
      return json({ error: "A justificativa deve possuir entre 5 e 500 caracteres." }, 422);

    const [{ data: profile, error: profileError }, { data: role, error: roleError }] =
      await Promise.all([
        adminClient
          .from("profiles")
          .select("id,email,display_name,status")
          .eq("id", userId)
          .maybeSingle(),
        adminClient.from("app_roles").select("id,code,name").eq("id", roleId).maybeSingle(),
      ]);

    if (profileError || !profile)
      return json({ error: profileError?.message ?? "Usuário não encontrado." }, 404);
    if (roleError || !role)
      return json({ error: roleError?.message ?? "Papel não encontrado." }, 404);
    if (profile.status === "inactive")
      return json({ error: "Não é possível atribuir papel a usuário inativo." }, 409);

    const { data: assignment, error: insertError } = await adminClient
      .from("user_role_assignments")
      .insert({
        user_id: userId,
        role_id: roleId,
        unit_code: unitCode,
        status: "active",
        granted_by: caller.id,
      })
      .select("id,user_id,role_id,unit_code,status,version")
      .single();

    if (insertError) return json({ error: insertError.message }, 409);

    await adminClient.from("audit_events").insert({
      actor_user_id: caller.id,
      action: "role_assignment_reason",
      entity_schema: "public",
      entity_table: "user_role_assignments",
      entity_id: assignment.id,
      after_data: assignment,
      metadata: { reason, role_code: role.code, source: "edge-function:admin-users" },
    });

    return json({ assignment }, 201);
  }

  if (action === "revoke-role") {
    const assignmentId = payload.assignmentId;
    const expectedVersion = payload.expectedVersion;
    const reason = parseReason(payload.reason);

    if (!isUuid(assignmentId)) return json({ error: "Atribuição inválida." }, 422);
    if (!Number.isInteger(expectedVersion) || Number(expectedVersion) < 1) {
      return json({ error: "Versão esperada inválida." }, 422);
    }
    if (!reason)
      return json({ error: "A justificativa deve possuir entre 5 e 500 caracteres." }, 422);

    const { data: before, error: beforeError } = await adminClient
      .from("user_role_assignments")
      .select("id,user_id,role_id,unit_code,status,version")
      .eq("id", assignmentId)
      .maybeSingle();

    if (beforeError || !before)
      return json({ error: beforeError?.message ?? "Atribuição não encontrada." }, 404);
    if (before.user_id === caller.id)
      return json({ error: "O usuário não pode revogar a própria atribuição." }, 409);

    const { data: after, error: updateError } = await adminClient
      .from("user_role_assignments")
      .update({
        status: "revoked",
        revoked_by: caller.id,
        revoked_at: new Date().toISOString(),
        revocation_reason: reason,
      })
      .eq("id", assignmentId)
      .eq("version", expectedVersion)
      .eq("status", "active")
      .select("id,user_id,role_id,unit_code,status,version")
      .maybeSingle();

    if (updateError) return json({ error: updateError.message }, 409);
    if (!after) {
      return json(
        {
          error: "A atribuição foi alterada por outro usuário. Atualize a tela e tente novamente.",
        },
        409,
      );
    }

    return json({ assignment: after });
  }

  if (action === "delete") {
    const userId = payload.userId;
    if (!isUuid(userId)) return json({ error: "Identificador de usuário inválido." }, 422);
    if (userId === caller.id)
      return json({ error: "O usuário não pode excluir a própria conta." }, 409);

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id,email,display_name,status")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) return json({ error: profileError.message }, 500);
    if (!profile) return json({ error: "Usuário não encontrado." }, 404);
    if (!new Set(["pending", "inactive"]).has(profile.status)) {
      return json(
        { error: "Somente usuários pendentes ou inativos podem ser excluídos fisicamente." },
        409,
      );
    }

    const { count, error: assignmentError } = await adminClient
      .from("user_role_assignments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (assignmentError) return json({ error: assignmentError.message }, 500);
    if ((count ?? 0) > 0) {
      return json(
        {
          error:
            "O usuário possui atribuições e deverá permanecer inativo para preservar o histórico.",
        },
        409,
      );
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId, false);
    if (deleteError) return json({ error: deleteError.message }, deleteError.status ?? 400);

    await adminClient.from("audit_events").insert({
      actor_user_id: caller.id,
      action: "delete",
      entity_schema: "auth",
      entity_table: "users",
      entity_id: userId,
      before_data: profile,
      metadata: { source: "edge-function:admin-users" },
    });

    return json({ deleted: true, userId });
  }

  return json({ error: "Ação administrativa desconhecida." }, 400);
});
