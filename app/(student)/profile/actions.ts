"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
export type ProfileState = { status: "idle" | "error" | "success"; message: string };
export async function saveProfile(_previous: ProfileState, form: FormData): Promise<ProfileState> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { status: "error", message: "Please log in to update your profile." };
    for (const field of ["full_name", "educationLevel", "academicDetails", "language"]) {
      if (typeof form.get(field) !== "string") return { status: "error", message: "Please check your profile fields." };
    }
    const full_name = String(form.get("full_name")).trim();
    const educationLevel = String(form.get("educationLevel"));
    const academicDetails = String(form.get("academicDetails")).trim();
    const language = String(form.get("language"));
    if (!full_name || full_name.length > 80 || academicDetails.length > 120 || !["", "junior-high", "senior-high", "college", "independent"].includes(educationLevel) || !["english", "filipino", "taglish"].includes(language)) {
      return { status: "error", message: "Use a name of 1–80 characters, academic details up to 120 characters, and valid preferences." };
    }
    // Only profile preferences are updated, never permissions or credentials.
    const { error } = await supabase.auth.updateUser({ data: { full_name, educationLevel, academicDetails, language } });
    if (error) return { status: "error", message: "Could not save your profile. Please try again." };
    try { revalidatePath("/", "layout"); }
    catch { return { status: "success", message: "Profile saved. Refresh to see your updated preferences." }; }
    return { status: "success", message: "Profile saved. Your preferences will prefill new study-tool forms." };
  } catch { return { status: "error", message: "Could not confirm the save. Refresh your profile to check before retrying." }; }
}
