export type ProfileStatus = "pending" | "active" | "suspended" | "inactive";

export interface AccessProfile {
  id: string;
  email: string | null;
  display_name: string;
  status: ProfileStatus;
  mfa_required: boolean;
  last_seen_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AccessRole {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

export interface RoleAssignment {
  id: string;
  user_id: string;
  role_id: string;
  unit_code: string | null;
  status: "active" | "inactive" | "revoked";
  valid_from: string;
  valid_until: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AccessBusinessUnit {
  id: string;
  code: string;
  name: string;
}

export interface AccessPermission {
  id: string;
  code: string;
  module: string;
  action: string;
  description: string | null;
}

export interface AccessRolePermission {
  role_id: string;
  permission_id: string;
}

export interface AccessData {
  profiles: AccessProfile[];
  roles: AccessRole[];
  assignments: RoleAssignment[];
  businessUnits: AccessBusinessUnit[];
  permissions: AccessPermission[];
  rolePermissions: AccessRolePermission[];
}
