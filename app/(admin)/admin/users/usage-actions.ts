"use server";

import { requireAdmin } from "@/lib/require-admin";

// ---------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------

export type UsageBucket = {
  attempts24h: number;
  limit: number | null;
  remaining: number | null;
  nextAttemptExpiresAt: string | null;
};

export type AdminUserUsage = {
  userId: string;
  checkedAt: string;
  mode: AllowanceMode;
  canEdit: boolean;
  editReason: string | null;
  source: "developer" | "allowance";
  materials: UsageBucket;
  tutor: UsageBucket;
};

export type UsageResult =
  | { success: true; usage: AdminUserUsage }
  | { success: false; message: string };

export type AllowanceMode = "default" | "custom" | "unlimited";

export type AllowanceInput = {
  targetUserId: string;
  mode: AllowanceMode;
  materialLimit: number | null;
  tutorLimit: number | null;
  reason: string;
  requestId: string;
};

export type SaveAllowanceResult =
  | {
      success: true;
      duplicate: boolean;
      allowance: {
        mode: AllowanceMode;
        materialLimit: number | null;
        tutorLimit: number | null;
      };
    }
  | { success: false; message: string };

// Ito ang hugis ng sagot ng SQL function na set_user_generation_allowance
type SaveRpcResult = {
  ok: boolean;
  duplicate: boolean;
  after: {
    mode: AllowanceMode;
    materialLimit: number | null;
    tutorLimit: number | null;
  };
};

// ---------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Mga mensaheng galing sa sarili nating SQL, at ang friendly na bersyon nila.
// Kapag binago mo ang error text sa SQL, i-update mo rin dito.
const ALLOWANCE_ERRORS: Record<string, string> = {
  "Developer access is managed separately.":
    "Developer access is managed separately.",
  "This request ID was already used for a different change.":
    "This request ID belongs to another change. Go back and review a new change.",
  "Please log in.": "Your session expired. Please log in again.",
  "Super Admin access required.":
    "Only a Super Admin can change usage allowances.",
  "Super Admin access required for this action.":
    "Only a Super Admin can change usage allowances.",
  "Super Admin accounts are protected.":
    "Super Admin accounts cannot be changed here.",
  "You cannot manage your own account here.":
    "You cannot change your own allowance here.",
  "Regular admins cannot manage other admins.":
    "Admin accounts cannot be changed from this action.",
  "Account unavailable.": "That account is no longer available.",
  "Allowance is already set to these values.":
    "The allowance is already set to these values.",
  "Custom limits must be whole numbers from 1 to 1000.":
    "Custom limits must be whole numbers from 1 to 1000.",
  "A reason of 1 to 1000 characters is required.":
    "Please enter a reason (up to 1000 characters).",
};

// ---------------------------------------------------------------
// HELPERS PARA SA USAGE (pagbasa ng sagot ng database)
// ---------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object") {
    return false;
  }
  if (value === null) {
    return false;
  }
  return true;
}

// Buong numero na 0 pataas
function isCount(value: unknown): value is number {
  if (typeof value !== "number") {
    return false;
  }
  if (!Number.isSafeInteger(value)) {
    return false;
  }
  if (value < 0) {
    return false;
  }
  return true;
}

function isDateString(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  if (Number.isNaN(Date.parse(value))) {
    return false;
  }
  return true;
}

function isUsageBucket(value: unknown): value is UsageBucket {
  if (!isRecord(value)) {
    return false;
  }
  if (!isCount(value.attempts24h)) {
    return false;
  }
  if (value.limit !== null && !isCount(value.limit)) {
    return false;
  }
  if (value.remaining !== null && !isCount(value.remaining)) {
    return false;
  }
  if (
    value.nextAttemptExpiresAt !== null &&
    !isDateString(value.nextAttemptExpiresAt)
  ) {
    return false;
  }
  return true;
}

function isUserUsage(value: unknown): value is AdminUserUsage {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.userId !== "string") {
    return false;
  }
  if (!isDateString(value.checkedAt)) {
    return false;
  }
  if (
    value.mode !== "default" &&
    value.mode !== "custom" &&
    value.mode !== "unlimited"
  ) {
    return false;
  }
  if (typeof value.canEdit !== "boolean") {
    return false;
  }
  if (value.editReason !== null && typeof value.editReason !== "string") {
    return false;
  }
  if (value.source !== "developer" && value.source !== "allowance") {
    return false;
  }
  if (!isUsageBucket(value.materials)) {
    return false;
  }
  if (!isUsageBucket(value.tutor)) {
    return false;
  }
  // Parehong rules ang gamit sa materials at tutor.
  if (!hasCorrectRemaining(value.materials, value.mode)) {
    return false;
  }
  if (!hasCorrectRemaining(value.tutor, value.mode)) {
    return false;
  }
  return true;
}

function hasCorrectRemaining(usage: UsageBucket, mode: AllowanceMode) {
  if (mode === "unlimited") {
    // Walang numeric limit o remaining count kapag unlimited.
    if (usage.limit !== null || usage.remaining !== null) {
      return false;
    }
  } else {
    if (!isValidLimit(usage.limit)) {
      return false;
    }

    let expectedRemaining = usage.limit - usage.attempts24h;
    if (expectedRemaining < 0) {
      expectedRemaining = 0;
    }

    if (usage.remaining !== expectedRemaining) {
      return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------
// ACTION 1: Load ng usage ng isang account
// ---------------------------------------------------------------

export async function loadAdminUserUsage(userId: string): Promise<UsageResult> {
  // Siguraduhing admin ang tumatawag
  const { supabase } = await requireAdmin();

  if (typeof userId !== "string" || !UUID_PATTERN.test(userId)) {
    return { success: false, message: "Invalid account ID." };
  }

  const { data, error } = await supabase.rpc("get_admin_user_usage", {
    p_user_id: userId,
  });

  if (error) {
    console.error("[Admin usage lookup]", { code: error.code });

    return {
      success: false,
      message: "Could not load usage. Please try again.",
    };
  }

  if (data === null) {
    return { success: false, message: "Account unavailable." };
  }

  if (!isUserUsage(data)) {
    return {
      success: false,
      message: "The usage information could not be read.",
    };
  }

  // Siguraduhing ang ibinalik na account ay ang hiningi natin
  if (data.userId.toLowerCase() !== userId.toLowerCase()) {
    return {
      success: false,
      message: "The usage information could not be read.",
    };
  }

  return { success: true, usage: data };
}

// ---------------------------------------------------------------
// ACTION 2: I-save ang allowance ng isang account
// ---------------------------------------------------------------

// Valid na limit: buong numero, 1 hanggang 1000
function isValidLimit(value: unknown): value is number {
  if (typeof value !== "number") {
    return false;
  }
  if (!Number.isInteger(value)) {
    return false;
  }
  if (value < 1) {
    return false;
  }
  if (value > 1000) {
    return false;
  }
  return true;
}

export async function saveAdminUserAllowance(
  input: AllowanceInput,
): Promise<SaveAllowanceResult> {
  // 1. Siguraduhing admin ang tumatawag
  const { supabase } = await requireAdmin();

  const { data: isSuperAdmin, error: roleError } = await supabase.rpc(
    "is_super_administrator",
  );
  if (roleError || isSuperAdmin !== true) {
    return {
      success: false,
      message: "Only a verified Super Admin can change usage allowances.",
    };
  }

  // 2. Kung walang laman o hindi object ang ipinadala, huminto agad
  if (!input || typeof input !== "object") {
    return { success: false, message: "Invalid request." };
  }

  // 3. Tingnan ang bawat field ng input
  if (
    typeof input.targetUserId !== "string" ||
    !UUID_PATTERN.test(input.targetUserId)
  ) {
    return { success: false, message: "Invalid account ID." };
  }

  if (
    typeof input.requestId !== "string" ||
    !UUID_PATTERN.test(input.requestId)
  ) {
    return { success: false, message: "Invalid request ID. Please try again." };
  }

  if (
    input.mode !== "default" &&
    input.mode !== "custom" &&
    input.mode !== "unlimited"
  ) {
    return { success: false, message: "Choose a valid allowance mode." };
  }

  // 4. Limits: kailangan lang kapag custom, null sa iba
  let materialLimit: number | null = null;
  let tutorLimit: number | null = null;

  if (input.mode === "custom") {
    if (!isValidLimit(input.materialLimit) || !isValidLimit(input.tutorLimit)) {
      return {
        success: false,
        message: "Custom limits must be whole numbers from 1 to 1000.",
      };
    }
    materialLimit = input.materialLimit;
    tutorLimit = input.tutorLimit;
  } else if (input.materialLimit !== null || input.tutorLimit !== null) {
    return {
      success: false,
      message: "Limits are only allowed in custom mode.",
    };
  }

  // 5. Reason: may laman at hindi lalagpas ng 1000 characters
  if (typeof input.reason !== "string") {
    return { success: false, message: "Please enter a reason." };
  }

  const reason = input.reason.trim();

  if (reason.length === 0) {
    return { success: false, message: "Please enter a reason." };
  }

  if (Array.from(reason).length > 1000) {
    return { success: false, message: "The reason is too long (max 1000)." };
  }

  // 6. Tawagin ang SQL function
  const { data, error } = await supabase.rpc("set_user_generation_allowance", {
    p_target_user_id: input.targetUserId,
    p_mode: input.mode,
    p_material_limit: materialLimit,
    p_tutor_limit: tutorLimit,
    p_reason: reason,
    p_request_id: input.requestId,
  });

  // 7. Kung may error, ipakita ang friendly na mensahe
  if (error) {
    console.error("[Admin allowance save]", { code: error.code });

    const friendly = ALLOWANCE_ERRORS[error.message];

    if (friendly) {
      return { success: false, message: friendly };
    }

    return {
      success: false,
      message: "Could not save the allowance. Please try again.",
    };
  }

  // 8. Basahin ang sagot ng database
  if (
    !isSaveRpcResult(data) ||
    data.after.mode !== input.mode ||
    data.after.materialLimit !== materialLimit ||
    data.after.tutorLimit !== tutorLimit
  ) {
    return {
      success: false,
      message: "The save result could not be read. Please refresh and check.",
    };
  }

  return {
    success: true,
    duplicate: data.duplicate,
    allowance: {
      mode: data.after.mode,
      materialLimit: data.after.materialLimit,
      tutorLimit: data.after.tutorLimit,
    },
  };
}

function isSaveRpcResult(value: unknown): value is SaveRpcResult {
  if (!isRecord(value)) {
    return false;
  }
  if (value.ok !== true) {
    return false;
  }
  if (typeof value.duplicate !== "boolean") {
    return false;
  }
  if (!isRecord(value.after)) {
    return false;
  }

  const after = value.after;
  if (after.mode === "custom") {
    if (!isValidLimit(after.materialLimit)) {
      return false;
    }
    if (!isValidLimit(after.tutorLimit)) {
      return false;
    }
  } else if (after.mode === "default" || after.mode === "unlimited") {
    if (after.materialLimit !== null || after.tutorLimit !== null) {
      return false;
    }
  } else {
    return false;
  }

  return true;
}
