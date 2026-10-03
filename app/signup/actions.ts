"use server";

import { createClient } from "@/lib/supabase/server";

export type SignupState = {
  status: "idle" | "error" | "success";
  message: string;
};

export async function signup(
  _previousState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const emailInput = formData.get("email");
  const password = formData.get("password");
  const displayNameInput = formData.get("full_name");

  if (
    typeof displayNameInput !== "string" ||
    !displayNameInput.trim() ||
    displayNameInput.trim().length > 80
  ) {
    return {
      status: "error",
      message: "Enter a display name of 1–80 characters.",
    };
  }

  if (
    typeof emailInput !== "string" ||
    typeof password !== "string"
  ) {
    return {
      status: "error",
      message: "Please enter your email and password.",
    };
  }

  const email = emailInput.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      status: "error",
      message: "Please enter a valid email address.",
    };
  }

  if (password.length < 8) {
    return {
      status: "error",
      message: "Use a password with at least 8 characters.",
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: displayNameInput.trim() },
    },
  });

  if (error) {
    return {
      status: "error",
      message: "We couldn't complete signup. Please try again.",
    };
  }

  return {
    status: "success",
    message: data.session
      ? "Your account is ready."
      : "Check your email for a confirmation link. If you already have an account, try logging in.",
  };
}
