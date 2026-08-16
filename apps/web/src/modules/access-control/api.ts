import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  AccessData,
  AccessPermission,
  AccessProfile,
  AccessRole,
  AccessRolePermission,
  ProfileStatus,
  RoleAssignment,
} from "./types";

function requireData<T>(data: T | null, message: string): T {
  if (data === null) throw new Error(message);
  return data;
}

async function invokeAdminUsers(body: Record<string, unknown>): Promise<unknown> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.functions.invoke("admin-users", { body });

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data;
}

export async function hasPermission(
  permissionCode: string,
  unitCode: string | null = null,
): Promise<boolean> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.rpc("has_permission", {
    p_permission_code: permissionCode,
    p_unit_code: unitCode,
  });

  if (error) throw error;
  return data === true;
}

export async function listAccessData(): Promise<AccessData> {
  const client = getSupabaseBrowserClient();
  const [
    profilesResult,
    rolesResult,
    assignmentsResult,
    unitsResult,
    permissionsResult,
    rolePermissionsResult,
  ] = await Promise.all([
    client
      .from("profiles")
      .select(
        "id,email,display_name,status,mfa_required,last_seen_at,version,created_at,updated_at",
      )
      .order("display_name"),
    client.from("app_roles").select("id,code,name,description,is_system").order("name"),
    client
      .from("user_role_assignments")
      .select(
        "id,user_id,role_id,unit_code,status,valid_from,valid_until,version,created_at,updated_at",
      )
      .order("created_at"),
    client.from("business_units").select("id,code,name").eq("status", "active").order("name"),
    client.from("permissions").select("id,code,module,action,description").order("code"),
    client.from("role_permissions").select("role_id,permission_id"),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (rolesResult.error) throw rolesResult.error;
  if (assignmentsResult.error) throw assignmentsResult.error;
  if (unitsResult.error) throw unitsResult.error;
  if (permissionsResult.error) throw permissionsResult.error;
  if (rolePermissionsResult.error) throw rolePermissionsResult.error;

  return {
    profiles: (profilesResult.data ?? []) as AccessProfile[],
    roles: (rolesResult.data ?? []) as AccessRole[],
    assignments: (assignmentsResult.data ?? []) as RoleAssignment[],
    businessUnits: (unitsResult.data ?? []).map((unit) => ({
      id: String(unit.id),
      code: String(unit.code),
      name: String(unit.name),
    })),
    permissions: (permissionsResult.data ?? []) as AccessPermission[],
    rolePermissions: (rolePermissionsResult.data ?? []) as AccessRolePermission[],
  };
}

export async function inviteUser(input: { email: string; displayName: string }): Promise<void> {
  await invokeAdminUsers({
    action: "invite",
    email: input.email,
    displayName: input.displayName,
  });
}

export async function updateProfile(input: {
  id: string;
  displayName: string;
  mfaRequired: boolean;
  expectedVersion: number;
}): Promise<AccessProfile> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("profiles")
    .update({
      display_name: input.displayName.trim(),
      mfa_required: input.mfaRequired,
    })
    .eq("id", input.id)
    .eq("version", input.expectedVersion)
    .select("id,email,display_name,status,mfa_required,last_seen_at,version,created_at,updated_at")
    .maybeSingle();

  if (error) throw error;
  return requireData(
    data as AccessProfile | null,
    "O perfil foi alterado por outro usuário. Atualize a tela e tente novamente.",
  );
}

export async function setProfileStatus(input: {
  id: string;
  status: Exclude<ProfileStatus, "pending">;
  reason: string;
  expectedVersion: number;
}): Promise<void> {
  await invokeAdminUsers({
    action: "set-status",
    userId: input.id,
    status: input.status,
    reason: input.reason,
    expectedVersion: input.expectedVersion,
  });
}

export async function deleteUser(userId: string): Promise<void> {
  await invokeAdminUsers({ action: "delete", userId });
}

export async function assignRole(input: {
  userId: string;
  roleId: string;
  unitCode: string | null;
  reason?: string;
}): Promise<void> {
  await invokeAdminUsers({
    action: "assign-role",
    userId: input.userId,
    roleId: input.roleId,
    unitCode: input.unitCode,
    reason: input.reason?.trim() || "Atribuição realizada pela interface administrativa.",
  });
}

export async function revokeRoleAssignment(input: {
  assignmentId: string;
  expectedVersion: number;
  reason: string;
}): Promise<void> {
  await invokeAdminUsers({
    action: "revoke-role",
    assignmentId: input.assignmentId,
    expectedVersion: input.expectedVersion,
    reason: input.reason,
  });
}
