"use server";

import { requireAdmin } from "@/lib/require-admin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AccountSuspension = {
  suspended: boolean;
  reason: string | null;
  suspendedAt: string | null;
  suspendedUntil: string | null;
  expired: boolean;
};

export type SuspensionDuration =
  | "1h"
  | "6h"
  | "12h"
  | "1d"
  | "3d"
  | "7d"
  | "30d"
  | "permanent";

export type AccountSuspensionResult =
  | { success: true; suspension: AccountSuspension }
  | { success: false; message: string };

export type SaveAccountSuspensionResult =
  | {
      success: true;
      duplicate: boolean;
      suspended: boolean;
      suspendedUntil: string | null;
    }
  | { success: false; message: string };

// I-load ang status at internal reason sa admin profile modal.
export async function loadAdminUserSuspension(
  userId: string,
): Promise<AccountSuspensionResult> {
  const { supabase } = await requireAdmin();

  if (typeof userId !== "string" || !UUID_PATTERN.test(userId)) {
    return { success: false, message: "Invalid account ID." };
  }

  const { data, error } = await supabase
    .from("account_suspensions")
    .select("reason, suspended_at, suspended_until")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return {
      success: false,
      message: "Could not load account status. Please try again.",
    };
  }

  if (data === null) {
    return {
      success: true,
      suspension: {
        suspended: false,
        reason: null,
        suspendedAt: null,
        suspendedUntil: null,
        expired: false,
      },
    };
  }

  if (
    typeof data.reason !== "string" ||
    typeof data.suspended_at !== "string" ||
    (data.suspended_until !== null && typeof data.suspended_until !== "string")
  ) {
    return {
      success: false,
      message: "The account status could not be read.",
    };
  }

  const suspendedUntil = data.suspended_until;
  if (suspendedUntil !== null && Number.isNaN(Date.parse(suspendedUntil))) {
    return {
      success: false,
      message: "The account expiry could not be read.",
    };
  }

  let suspended = true;
  if (suspendedUntil !== null && Date.parse(suspendedUntil) <= Date.now()) {
    suspended = false;
  }

  return {
    success: true,
    suspension: {
      suspended,
      reason: data.reason,
      suspendedAt: data.suspended_at,
      suspendedUntil,
      expired: !suspended,
    },
  };
}

// Database ang huling nagva-validate ng roles at protected accounts.
export async function saveAdminUserSuspension(input: {
  targetUserId: string;
  suspended: boolean;
  duration: SuspensionDuration | null;
  reason: string;
  requestId: string;
}): Promise<SaveAccountSuspensionResult> {
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
  if (typeof input.suspended !== "boolean") {
    return { success: false, message: "Choose a valid account action." };
  }
  if (input.suspended) {
    if (
      input.duration !== "1h" &&
      input.duration !== "6h" &&
      input.duration !== "12h" &&
      input.duration !== "1d" &&
      input.duration !== "3d" &&
      input.duration !== "7d" &&
      input.duration !== "30d" &&
      input.duration !== "permanent"
    ) {
      return { success: false, message: "Choose a valid suspension duration." };
    }
  } else if (input.duration !== null) {
    return { success: false, message: "A restore action cannot include a duration." };
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

  const { data, error } = await supabase.rpc("set_account_suspension", {
    p_target_user_id: input.targetUserId,
    p_suspended: input.suspended,
    p_reason: reason,
    p_request_id: input.requestId,
    p_duration: input.duration,
  });

  if (error) {
    console.error("[Admin account suspension]", { code: error.code });

    if (error.code === "PGRST202" || error.code === "42883") {
      return {
        success: false,
        message: "Ban controls are not installed yet. Apply the latest suspension migration.",
      };
    }
    if (error.message.includes("Super Admin accounts are protected.")) {
      return { success: false, message: "Super Admin accounts are protected." };
    }
    if (error.message.includes("You cannot manage your own account here.")) {
      return { success: false, message: "You cannot change your own account here." };
    }
    if (error.message.includes("Regular admins cannot manage other admins.")) {
      return {
        success: false,
        message: "Regular admins cannot manage admin accounts.",
      };
    }
    if (error.message.includes("Super Admin access required")) {
      return {
        success: false,
        message: "Administrator access is required for this action.",
      };
    }
    if (error.message.includes("already suspended")) {
      return { success: false, message: "This account is already suspended." };
    }
    if (error.message.includes("not suspended")) {
      return { success: false, message: "This account is already active." };
    }
    if (error.message.includes("different change")) {
      return {
        success: false,
        message:
          "This request ID belongs to another change. Review the action and try again.",
      };
    }

    return {
      success: false,
      message: "Could not update account access. Please try again.",
    };
  }

  if (!isSaveSuspensionResponse(data, input.suspended)) {
    return {
      success: false,
      message:
        "The save result could not be read. Refresh and check the account status.",
    };
  }

  return {
    success: true,
    duplicate: data.duplicate,
    suspended: data.after.suspended,
    suspendedUntil: data.after.suspendedUntil,
  };
}

type SaveSuspensionResponse = {
  ok: true;
  duplicate: boolean;
  after: { suspended: boolean; suspendedUntil: string | null };
};

function isSaveSuspensionResponse(
  value: unknown,
  expectedStatus: boolean,
): value is SaveSuspensionResponse {
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
  if (!("suspended" in value.after) || value.after.suspended !== expectedStatus) {
    return false;
  }
  if (
    !("suspendedUntil" in value.after) ||
    (value.after.suspendedUntil !== null &&
      (typeof value.after.suspendedUntil !== "string" ||
        Number.isNaN(Date.parse(value.after.suspendedUntil))))
  ) {
    return false;
  }

  return true;
}
