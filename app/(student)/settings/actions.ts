"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function saveSettings(
  _previous: SettingsState,
  form: FormData,
): Promise<SettingsState> {
  const theme = form.get("theme");
  const readingSize = form.get("reading_size");
  if (
    typeof theme !== "string" ||
    !["light", "dark", "system"].includes(theme) ||
    typeof readingSize !== "string" ||
    !["normal", "large"].includes(readingSize)
  ) {
    return { status: "error", message: "Choose valid appearance preferences." };
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return { status: "error", message: "Please log in again." };
    // Explicit fields: callers cannot submit someone else's user ID or permissions.
    const { error } = await supabase.from("user_settings").upsert(
      {
        user_id: user.id,
        theme,
        reading_size: readingSize,
        reduce_motion: form.get("reduce_motion") === "on",
        quiz_notifications: form.get("quiz_notifications") === "on",
        group_notifications: form.get("group_notifications") === "on",
        admin_notifications: form.get("admin_notifications") === "on",
      },
      { onConflict: "user_id" },
    );
    if (error)
      return {
        status: "error",
        message: "Could not save settings. Please try again.",
      };
  } catch {
    return {
      status: "error",
      message: "Connection interrupted. Reload to check your saved settings.",
    };
  }
  revalidatePath("/", "layout");
  return { status: "success", message: "Settings saved for your account." };
}
