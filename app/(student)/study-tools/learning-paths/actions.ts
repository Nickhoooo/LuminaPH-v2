"use server";

import { revalidatePath } from "next/cache";
import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase/server";
import { generateLearningPathOutline, type LearningPathOutline } from "@/lib/ai/learning-paths";

export type LearningPathState = {
  status: "idle" | "error" | "success";
  message: string;
  outline?: LearningPathOutline;
  pathId?: string;
};
export type LessonProgressState = {
  status: "idle" | "error" | "success";
  message: string;
  lessonId?: string;
  completed?: boolean;
};
const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createLearningPath(_previous: LearningPathState, form: FormData): Promise<LearningPathState> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { status: "error", message: "Please log in before creating a learning path." };
    for (const name of ["subject", "learningGoal", "educationLevel", "academicDetails", "language", "lessonCount"]) {
      if (typeof form.get(name) !== "string") return { status: "error", message: "Please complete the learning path details." };
    }
    const subject = String(form.get("subject")).trim();
    const learningGoal = String(form.get("learningGoal")).trim();
    const educationLevel = String(form.get("educationLevel"));
    const academicDetails = String(form.get("academicDetails")).trim();
    const language = form.get("language");
    const count = String(form.get("lessonCount"));
    if (!subject || subject.length > 120 || !learningGoal || learningGoal.length > 1000 || academicDetails.length > 120) {
      return { status: "error", message: "Use a subject of 1–120 characters, goal of 1–1,000 characters, and academic details up to 120 characters." };
    }
    if (!["junior-high", "senior-high", "college", "independent"].includes(educationLevel)) return { status: "error", message: "Choose a valid education level." };
    if (language !== "english" && language !== "filipino" && language !== "taglish") return { status: "error", message: "Choose a valid language." };
    if (!/^[3-8]$/.test(count)) return { status: "error", message: "Choose between 3 and 8 lessons." };
    if (!process.env.GROQ_API_KEY?.trim()) return { status: "error", message: "Learning path generation is temporarily unavailable." };

    // Validation comes before reserving an attempt. All study tools share this allowance.
    const { data: allowance, error: allowanceError } = await supabase.rpc("reserve_ai_generation");
    if (allowanceError) return { status: "error", message: "We could not check your generation allowance. Try again later." };
    if (allowance !== "allowed") {
      let message = "We could not confirm your generation allowance.";
      if (allowance === "unauthorized") message = "Please log in again.";
      if (allowance === "cooldown") message = "Please wait at least 60 seconds between generation attempts.";
      if (allowance === "user_limit") message = "You have used your 5 generation attempts in the last 24 hours.";
      if (allowance === "app_limit") message = "LuminaPH has reached its shared allowance. Try again later.";
      return { status: "error", message };
    }
    let outline: LearningPathOutline;
    try {
      outline = await generateLearningPathOutline({ subject, learningGoal, educationLevel, academicDetails, language, lessonCount: Number(count) });
    } catch (error) {
      return { status: "error", message: error instanceof Groq.APIError && error.status === 429
        ? "The AI provider's free allowance is unavailable. Try again later. This attempt counts toward your limit."
        : "We could not generate a complete outline. This attempt counts toward your limit." };
    }

    let pathId: string;
    try {
      // This RPC saves the parent and ordered lessons together, protected by RLS.
      const { data, error } = await supabase.rpc("create_learning_path", {
        p_title: outline.title, p_subject: subject, p_learning_goal: learningGoal,
        p_education_level: educationLevel, p_academic_details: academicDetails,
        p_language: language, p_lessons: outline.lessons,
      });
      if (error || typeof data !== "string" || !validId.test(data)) throw new Error("Save not confirmed.");
      pathId = data;
    } catch {
      // Never automatically retry this RPC: a network failure may hide a successful save.
      return { status: "error", message: "Your outline was generated, but saving was not confirmed. Keep a copy and check your saved learning paths before generating again.", outline };
    }
    try { revalidatePath("/study-tools/learning-paths"); revalidatePath("/dashboard"); }
    catch { console.warn("Learning path saved, but page refresh failed."); }
    return { status: "success", message: "Your learning path outline has been saved. Lesson content is generated separately.", outline, pathId };
  } catch {
    return { status: "error", message: "We could not confirm your request. Check your saved learning paths before retrying; an attempt may have counted." };
  }
}

export async function setLessonProgress(_previous: LessonProgressState, form: FormData): Promise<LessonProgressState> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { status: "error", message: "Please log in to update your progress." };
    const pathId = form.get("pathId");
    const lessonId = form.get("lessonId");
    const value = form.get("completed");
    if (typeof pathId !== "string" || !validId.test(pathId) || typeof lessonId !== "string" || !validId.test(lessonId) || (value !== "true" && value !== "false")) {
      return { status: "error", message: "Choose a valid lesson and completion status." };
    }
    const { data: path, error: pathError } = await supabase.from("learning_paths")
      .select("id").eq("id", pathId).eq("user_id", user.id).maybeSingle();
    if (pathError || !path) return { status: "error", message: "This learning path is unavailable." };
    const completed = value === "true";
    // Set the intended value rather than toggling; retrying the same request is safe.
    const { data: lesson, error } = await supabase.from("learning_path_lessons")
      .update({ completed }).eq("id", lessonId).eq("path_id", pathId)
      .select("id, completed").maybeSingle();
    if (error || !lesson || lesson.completed !== completed) return { status: "error", message: "We could not confirm the progress update. Refresh and try again." };
    try {
      revalidatePath("/study-tools/learning-paths", "layout");
      revalidatePath("/library/[id]", "page");
      revalidatePath("/dashboard");
    }
    catch { console.warn("Lesson progress saved, but page refresh failed."); }
    return { status: "success", message: completed ? "Lesson marked complete." : "Lesson marked incomplete.", lessonId: lesson.id, completed };
  } catch {
    return { status: "error", message: "We could not confirm your progress. Refresh to check before retrying." };
  }
}
