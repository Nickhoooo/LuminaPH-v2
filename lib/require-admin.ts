import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: isSuspended, error: suspensionError } = await supabase.rpc(
    "is_current_account_suspended",
  );

  if (suspensionError || typeof isSuspended !== "boolean") {
    redirect("/account-status-check");
  }

  if (isSuspended) {
    redirect("/account-suspended");
  }

  const { data: isAdmin, error } = await supabase.rpc(
    "is_app_administrator",
  );

  if (process.env.NODE_ENV === "development") {
    console.info("[Admin access check]", {
      email: user.email,
      isAdmin,
      errorCode: error?.code ?? null,
    });
  }

  if (error) {
    throw new Error(
      "Could not verify administrator access. Please try again.",
    );
  }

  if (isAdmin !== true) {
    redirect("/dashboard");
  }

  return { supabase, user };
}
