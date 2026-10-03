"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ResetPasswordState = {
  status: "idle" | "error" | "success";
  message: string;
};

const logoutRetryMessage =
  "Your password was updated, but we couldn't finish logging you out. Use Log out below, then log in with your new password.";

export async function resetPassword(
  _previousState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const password = formData.get("password");
  const confirmation = formData.get("confirmPassword");

  if (typeof password !== "string" || typeof confirmation !== "string") {
    return { status: "error", message: "Enter and confirm your new password." };
  }
  if (password.length < 8) {
    return { status: "error", message: "Use at least 8 characters for your new password." };
  }
  if (password !== confirmation) {
    return { status: "error", message: "The passwords don't match. Please check both fields." };
  }

  let passwordUpdated = false;
  try {
    const supabase = await createClient();
    // Never trust page visibility or a submitted user ID to authorize an update.
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { status: "error", message: "Your session has expired. Request a new reset link below." };
    }

    // Supabase updates the account belonging to the verified session.
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      return {
        status: "error",
        message: error.code === "same_password"
          ? "Choose a password different from your current one."
          : "We couldn't update your password. Try a stronger password or request a new reset link.",
      };
    }

    passwordUpdated = true;
    const { error: logoutError } = await supabase.auth.signOut({ scope: "local" });
    if (logoutError) {
      return { status: "success", message: logoutRetryMessage };
    }
  } catch {
    // A logout failure must not falsely report that the password update failed.
    return {
      status: passwordUpdated ? "success" : "error",
      message: passwordUpdated
        ? logoutRetryMessage
        : "We couldn't complete the request. Please try again shortly.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/login");
}
