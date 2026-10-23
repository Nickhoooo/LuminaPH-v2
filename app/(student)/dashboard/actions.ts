"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type LogoutState = {
  message: string;
  success?: boolean;
};

export async function logout(): Promise<LogoutState> {
  try {
    const supabase = await createClient();
    // End only the session attached to this request's cookies.
    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) {
      return { message: "We couldn't log you out. Please try again." };
    }
    (await cookies()).delete("lumina-theme");
  } catch {
    return { message: "We couldn't log you out. Please try again." };
  }

  // Refresh authenticated UI before navigating to the login page.
  revalidatePath("/", "layout");
  return { success: true, message: "Logged out." };
}
