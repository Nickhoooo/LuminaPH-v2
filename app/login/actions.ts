"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  status: "idle" | "error";
  message: string;
};

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const emailInput = formData.get("email");
  const password = formData.get("password");

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

  if (!email || !password) {
    return {
      status: "error",
      message: "Please enter your email and password.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      status: "error",
      message:
        "Unable to log in. Check your email and password, and make sure your email is confirmed.",
    };
  }

  redirect("/dashboard");
}