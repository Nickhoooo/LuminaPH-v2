"use server";

import { createClient } from "@/lib/supabase/server";

export type ForgotPasswordState = {
  status: "idle" | "error" | "success";
  message: string;
};

export async function requestPasswordReset(
  // React supplies previous state; validate each new submission independently.
  _previousState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const emailInput = formData.get("email");

  if (typeof emailInput !== "string") {
    return { status: "error", message: "Please enter your email address." };
  }

  const email = emailInput.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Please enter a valid email address." };
  }

  try {
    const supabase = await createClient();
    // The recovery email template will point to our server confirmation route.
    // This requests an email; it does not change the user's password.
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      return {
        status: "error",
        message: "We couldn't process your request. Please wait a moment and try again.",
      };
    }

    // Avoid revealing whether an email belongs to a registered account.
    return {
      status: "success",
      message: "If an account exists for this email, you'll receive a password reset link. Check your inbox and spam folder.",
    };
  } catch {
    return {
      status: "error",
      message: "We couldn't reach the account service. Please try again shortly.",
    };
  }
}
