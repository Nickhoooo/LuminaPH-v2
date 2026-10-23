import "server-only";

import { requireAdmin } from "@/lib/require-admin";

export type AdminUser = {
  id: string;
  displayName: string;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
  isAdmin: boolean;
};

export type AdminUserFilter = "all" | "admins" | "users";

type AdminUserList = {
  page: number;
  pageSize: number;
  totalCount: number;
  users: AdminUser[];
};

type AdminUsersResult =
  | { success: true; data: AdminUserList }
  | { success: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAdminUser(value: unknown): value is AdminUser {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.displayName === "string" &&
    (value.email === null || typeof value.email === "string") &&
    typeof value.createdAt === "string" &&
    (value.lastSignInAt === null ||
      typeof value.lastSignInAt === "string") &&
    typeof value.emailConfirmed === "boolean" &&
    typeof value.isAdmin === "boolean"
  );
}

function isAdminUserList(value: unknown): value is AdminUserList {
  if (!isRecord(value)) return false;

  return (
    typeof value.page === "number" &&
    Number.isSafeInteger(value.page) &&
    value.page >= 1 &&
    value.pageSize === 20 &&
    typeof value.totalCount === "number" &&
    Number.isSafeInteger(value.totalCount) &&
    value.totalCount >= 0 &&
    Array.isArray(value.users) &&
    value.users.length <= 20 &&
    value.users.every(isAdminUser)
  );
}

export async function getAdminUsers(
  page: number,
  search: string = "",
  role: AdminUserFilter = "all",
): Promise<AdminUsersResult> {
  const { supabase } = await requireAdmin();
  const searchText = search.trim();

  if (!Number.isSafeInteger(page) || page < 1 || page > 50000) {
    return {
      success: false,
      message: "Invalid page number.",
    };
  }

  if (Array.from(searchText).length > 120) {
    return {
      success: false,
      message: "Search must contain at most 120 characters.",
    };
  }

  if (role !== "all" && role !== "admins" && role !== "users") {
    return {
      success: false,
      message: "Choose all accounts, admins, or users.",
    };
  }

  const { data, error } = await supabase.rpc("list_admin_users", {
    p_page: page,
    p_search: searchText,
    p_role: role,
  });

  if (error || !isAdminUserList(data)) {
    return {
      success: false,
      message: "Could not load users. Please try again.",
    };
  }

  return { success: true, data };
}

type AdminUserResult =
  | { success: true; user: AdminUser | null }
  | { success: false; message: string };

export async function getAdminUser(
  userId: string,
): Promise<AdminUserResult> {
  const { supabase } = await requireAdmin();

  const validId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!validId.test(userId)) {
    return { success: true, user: null };
  }

  const { data, error } = await supabase.rpc("get_admin_user", {
    p_user_id: userId,
  });

  if (error) {
    console.error("[Admin user lookup]", { code: error.code });
    return {
      success: false,
      message:
        error.code === "PGRST202" || error.code === "42883"
          ? "Account lookup is not installed. Apply the admin user lookup repair migration."
          : "Could not load this account. Please try again.",
    };
  }

  if (data === null) {
    return { success: true, user: null };
  }

  if (!isAdminUser(data)) {
    return {
      success: false,
      message: "The account information could not be read.",
    };
  }

  return { success: true, user: data };
}
