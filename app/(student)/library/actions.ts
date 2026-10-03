"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { redirect, RedirectType } from "next/navigation";

export type StudySetState = {
  status: "idle" | "error" | "success";
  message: string;
};

export async function deleteLibraryMaterial(
  _previousState: StudySetState,
  formData: FormData,
): Promise<StudySetState> {
  const materialId = formData.get("materialId");
  if (
    typeof materialId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      materialId,
    ) ||
    formData.get("confirmed") !== "yes"
  ) {
    return {
      status: "error",
      message: "Confirm which material you want to delete.",
    };
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return { status: "error", message: "Please log in again." };
    const { error } = await supabase.rpc("delete_library_material", {
      p_material_id: materialId,
    });
    if (error)
      return {
        status: "error",
        message: "Could not delete this material. Please try again.",
      };
  } catch {
    return {
      status: "error",
      message: "Connection interrupted. Check your Library before retrying.",
    };
  }
  try {
    // Refresh saved-material pickers, dashboard totals, lessons and tutor pages.
    revalidatePath("/", "layout");
  } catch {
    console.warn("Material deleted; cached pages could not be refreshed.");
  }
  // Redirect outside try/catch so a deleted detail page never renders a 404 here.
  redirect("/library?deleted=1", RedirectType.replace);
}

export async function createStudySet(
  _previousState: StudySetState,
  formData: FormData,
): Promise<StudySetState> {
  const titleInput = formData.get("title");
  const subjectInput = formData.get("subject");
  const notesInput = formData.get("notes");

  if (
    typeof titleInput !== "string" ||
    typeof subjectInput !== "string" ||
    typeof notesInput !== "string"
  ) {
    return {
      status: "error",
      message: "Please check your form fields.",
    };
  }

  const title = titleInput.trim();
  const subject = subjectInput.trim();
  const notes = notesInput.trim();

  if (title.length === 0 || title.length > 120) {
    return {
      status: "error",
      message: "Title must contain 1–120 characters.",
    };
  }

  if (subject.length > 80) {
    return {
      status: "error",
      message: "Subject must not exceed 80 characters.",
    };
  }

  if (notes.length === 0 || notes.length > 20000) {
    return {
      status: "error",
      message: "Notes must contain 1–20,000 characters.",
    };
  }

  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        status: "error",
        message: "Please log in before saving a study set.",
      };
    }

    const { error } = await supabase.from("study_sets").insert({
      user_id: user.id,
      title: title,
      subject: subject || null,
      notes: notes,
    });

    if (error) {
      return {
        status: "error",
        message: "Could not save your study set. Please try again.",
      };
    }
  } catch {
    return {
      status: "error",
      message: "We could not complete the request. Please try again.",
    };
  }

  revalidatePath("/library");
  revalidatePath("/dashboard");

  return {
    status: "success",
    message: "Study set saved successfully.",
  };
}
