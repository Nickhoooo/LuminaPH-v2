"use server";

import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DeleteAdminUserResult =
  | { success: true; duplicate: boolean }
  | { success: false; message: string };

export async function permanentlyDeleteAdminUser(input: {
  targetUserId: string;
  reason: string;
  requestId: string;
}): Promise<DeleteAdminUserResult> {
  const { supabase } = await requireAdmin();

  if (
    !input ||
    !UUID_PATTERN.test(input.targetUserId) ||
    !UUID_PATTERN.test(input.requestId)
  ) {
    return { success: false, message: "Invalid account or request ID." };
  }
  if (typeof input.reason !== "string") {
    return { success: false, message: "Enter a reason for deleting this account." };
  }
  const reason = input.reason.trim();
  if (reason.length < 1 || Array.from(reason).length > 1000) {
    return { success: false, message: "Enter a reason between 1 and 1000 characters." };
  }

  const { data: authorized, error: authorizationError } = await supabase.rpc(
    "authorize_admin_user_deletion",
    { p_target_user_id: input.targetUserId },
  );
  if (authorizationError || authorized !== true) {
    const message = authorizationError?.message ?? "Only a Super Admin can permanently delete accounts.";
    if (message.includes("Super Admin accounts are protected")) {
      return { success: false, message: "Super Admin accounts are protected." };
    }
    if (message.includes("You cannot manage your own account")) {
      return { success: false, message: "You cannot delete your own account here." };
    }
    if (message.includes("Suspend the account")) {
      return { success: false, message: "Suspend the account before permanently deleting it." };
    }
    return { success: false, message: "Only a Super Admin can delete a suspended account." };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return {
      success: false,
      message: "Permanent deletion is not configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment.",
    };
  }

  const adminClient = createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(
    input.targetUserId,
    false,
  );
  if (deleteError) {
    console.error("[Admin user deletion]", { message: deleteError.message });
    return {
      success: false,
      message: deleteError.message.toLowerCase().includes("storage")
        ? "This account owns uploaded files. Remove or reassign those files in Supabase Storage, then retry."
        : "Supabase could not delete this account. Check its storage ownership and try again.",
    };
  }

  const { data: audit, error: auditError } = await supabase.rpc(
    "record_admin_user_deletion",
    {
      p_target_user_id: input.targetUserId,
      p_reason: reason,
      p_request_id: input.requestId,
    },
  );
  if (auditError || !audit || typeof audit !== "object" || !("ok" in audit) || audit.ok !== true) {
    console.error("[Admin user deletion audit]", { code: auditError?.code ?? null });
    return {
      success: false,
      message: "The account was deleted, but the audit entry could not be saved. Contact a Super Admin before retrying.",
    };
  }

  return { success: true, duplicate: "duplicate" in audit && audit.duplicate === true };
}
