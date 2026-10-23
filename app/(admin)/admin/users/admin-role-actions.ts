"use server";

import { requireAdmin } from "@/lib/require-admin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AdminRole = "admin" | "super_admin" | null;

export type AdminRoleResult =
  | {
      success: true;
      role: AdminRole;
      canManageRoles: boolean;
    }
  | { success: false; message: string };

export type SaveAdminRoleResult =
  | { success: true; role: AdminRole; duplicate: boolean }
  | { success: false; message: string };

export async function loadAdminRole(
  userId: string,
): Promise<AdminRoleResult> {
  const { supabase } = await requireAdmin();

  if (typeof userId !== "string" || !UUID_PATTERN.test(userId)) {
    return { success: false, message: "Invalid account ID." };
  }

  const [roleResult, permissionResult] = await Promise.all([
    supabase.rpc("get_admin_role", { p_user_id: userId }),
    supabase.rpc("is_super_administrator"),
  ]);

  if (roleResult.error || permissionResult.error) {
    return {
      success: false,
      message: "Could not load administrator access. Please try again.",
    };
  }

  if (
    roleResult.data !== null &&
    roleResult.data !== "admin" &&
    roleResult.data !== "super_admin"
  ) {
    return {
      success: false,
      message: "The account role could not be read.",
    };
  }

  return {
    success: true,
    role: roleResult.data,
    canManageRoles: permissionResult.data === true,
  };
}

export async function saveAdminRole(input: {
  targetUserId: string;
  grantAdmin: boolean;
  reason: string;
  requestId: string;
}): Promise<SaveAdminRoleResult> {
  const { supabase } = await requireAdmin();

  if (!input || typeof input !== "object") {
    return { success: false, message: "Invalid request." };
  }
  if (!UUID_PATTERN.test(input.targetUserId)) {
    return { success: false, message: "Invalid account ID." };
  }
  if (!UUID_PATTERN.test(input.requestId)) {
    return { success: false, message: "Invalid request ID. Please try again." };
  }
  if (typeof input.grantAdmin !== "boolean") {
    return { success: false, message: "Choose a valid role action." };
  }
  if (typeof input.reason !== "string") {
    return { success: false, message: "Please enter a reason." };
  }

  const reason = input.reason.trim();
  if (reason.length === 0 || Array.from(reason).length > 1000) {
    return {
      success: false,
      message: "Please enter a reason of 1 to 1000 characters.",
    };
  }

  const { data, error } = await supabase.rpc("set_regular_admin_role", {
    p_target_user_id: input.targetUserId,
    p_grant_admin: input.grantAdmin,
    p_reason: reason,
    p_request_id: input.requestId,
  });

  if (error) {
    console.error("[Admin role change]", { code: error.code });

    if (error.code === "PGRST202" || error.code === "42883") {
      return {
        success: false,
        message: "Admin role controls are not installed yet. Apply the role management migration.",
      };
    }
    if (error.message.includes("Super Admin accounts are protected")) {
      return { success: false, message: "Super Admin accounts are protected." };
    }
    if (error.message.includes("You cannot manage your own account")) {
      return { success: false, message: "You cannot change your own role." };
    }
    if (error.message.includes("Super Admin access required")) {
      return { success: false, message: "Only a Super Admin can manage Admin roles." };
    }
    if (error.message.includes("already an Admin")) {
      return { success: false, message: "This account already has Admin access." };
    }
    if (error.message.includes("does not have Admin access")) {
      return { success: false, message: "This account does not have Admin access." };
    }
    if (error.message.includes("different change")) {
      return {
        success: false,
        message: "This request ID belongs to another change. Review the action and try again.",
      };
    }

    return { success: false, message: "Could not update Admin access. Please try again." };
  }

  const expectedRole = input.grantAdmin ? "admin" : null;
  if (!isSaveAdminRoleResponse(data, expectedRole)) {
    return {
      success: false,
      message: "The save result could not be read. Refresh and check the account role.",
    };
  }

  return {
    success: true,
    role: data.after.role,
    duplicate: data.duplicate,
  };
}

type SaveAdminRoleResponse = {
  ok: true;
  duplicate: boolean;
  after: { role: "admin" | null };
};

function isSaveAdminRoleResponse(
  value: unknown,
  expectedRole: "admin" | null,
): value is SaveAdminRoleResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("ok" in value) || value.ok !== true) {
    return false;
  }
  if (!("duplicate" in value) || typeof value.duplicate !== "boolean") {
    return false;
  }
  if (!("after" in value) || typeof value.after !== "object" || value.after === null) {
    return false;
  }
  if (!("role" in value.after) || value.after.role !== expectedRole) {
    return false;
  }

  return true;
}
