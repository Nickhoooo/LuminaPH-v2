"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import Groq from "groq-sdk";
import { generateStudyGuide } from "@/lib/ai/study-guide";
import { STUDY_MODEL } from "@/lib/ai/groq";
import { createClient } from "@/lib/supabase/server";

export type StudyGuideState = {
  status: "idle" | "error" | "success";
  message: string;
  guide?: {
    title: string;
    content: string;
    sourceNote?: { id: string; title: string };
  };
  studySetId?: string;
};

export async function createStudyGuide(
  _previousState: StudyGuideState,
  formData: FormData,
): Promise<StudyGuideState> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        status: "error",
        message: "Please log in before generating a study guide.",
      };
    }

    const fieldNames = [
      "educationLevel",
      "academicDetails",
      "subject",
      "learningGoal",
      "language",
    ];

    for (const field of fieldNames) {
      if (typeof formData.get(field) !== "string") {
        return {
          status: "error",
          message: "Please check your form fields.",
        };
      }
    }

    const educationLevel = String(formData.get("educationLevel")).trim();
    const academicDetails = String(formData.get("academicDetails")).trim();
    const subject = String(formData.get("subject")).trim();
    const learningGoal = String(formData.get("learningGoal")).trim();
    const language = String(formData.get("language")).trim();

    const allowedLevels = [
      "junior-high",
      "senior-high",
      "college",
      "independent",
    ];

    if (!allowedLevels.includes(educationLevel)) {
      return {
        status: "error",
        message: "Please select a valid education level.",
      };
    }

    if (subject.length === 0 || subject.length > 120) {
      return {
        status: "error",
        message: "Subject must contain 1–120 characters.",
      };
    }

    if (learningGoal.length === 0 || learningGoal.length > 1000) {
      return {
        status: "error",
        message: "Learning goal must contain 1–1,000 characters.",
      };
    }

    if (academicDetails.length > 120) {
      return {
        status: "error",
        message: "Please shorten your academic details.",
      };
    }

    if (
      language !== "english" &&
      language !== "filipino" &&
      language !== "taglish"
    ) {
      return {
        status: "error",
        message: "Please select a valid explanation language.",
      };
    }

    // Missing server configuration should not consume a student's allowance.
    if (!process.env.GROQ_API_KEY?.trim()) {
      return {
        status: "error",
        message: "Study guide generation is temporarily unavailable. Please try again later.",
      };
    }

    // The browser sends an ID only. Read the actual text from the user's own note.
    const noteIdInput = formData.get("sourceNoteId");
    let sourceNote: { title: string; content: string } | undefined;
    let noteReference: { id: string; title: string } | undefined;

    if (noteIdInput !== null) {
      const validId =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (typeof noteIdInput !== "string" || !validId.test(noteIdInput)) {
        return {
          status: "error",
          message: "Please select a valid personal note from your Library.",
        };
      }

      const { data: note, error: noteError } = await supabase
        .from("study_sets")
        .select("id, title, notes")
        .eq("id", noteIdInput)
        .eq("user_id", user.id)
        .eq("material_type", "notes")
        .maybeSingle();

      if (noteError) {
        return {
          status: "error",
          message: "We could not load your notes. Please try again. No generation attempt was used.",
        };
      }

      if (!note) {
        return {
          status: "error",
          message: "This note is unavailable. Choose one of your saved personal notes.",
        };
      }

      if (
        typeof note.notes !== "string" ||
        note.notes.trim().length === 0 ||
        note.notes.length > 20_000
      ) {
        return {
          status: "error",
          message: "Your selected notes must contain 1?20,000 characters.",
        };
      }

      sourceNote = { title: note.title, content: note.notes };
      noteReference = { id: note.id, title: note.title };
    }

    // Validate the selected note before consuming any generation allowance.
    const { data: allowance, error: allowanceError } = await supabase.rpc(
      "reserve_ai_generation",
    );

    if (allowanceError) {
      return {
        status: "error",
        message: "We could not check your generation allowance. Please try again later.",
      };
    }

    if (allowance === "unauthorized") {
      return {
        status: "error",
        message: "Please log in again before generating a study guide.",
      };
    }

    if (allowance === "cooldown") {
      return {
        status: "error",
        message: "Please wait at least 60 seconds after your last attempt before trying again.",
      };
    }

    if (allowance === "user_limit") {
      return {
        status: "error",
        message: "You have used your 5 generation attempts in the last 24 hours. Please try again when an earlier attempt is more than 24 hours old.",
      };
    }

    if (allowance === "app_limit") {
      return {
        status: "error",
        message: "LuminaPH has reached its shared generation allowance. Please try again later. You can still save personal notes in your Library.",
      };
    }

    // An unexpected response must never allow an AI request through.
    if (allowance !== "allowed") {
      return {
        status: "error",
        message: "We could not confirm your generation allowance. Please try again later.",
      };
    }

    let content: string;

    try {
      content = await generateStudyGuide({
        educationLevel,
        academicDetails,
        subject,
        learningGoal,
        language,
        sourceNote,
      });
    } catch (error) {
      if (error instanceof Groq.APIError && error.status === 429) {
        return {
          status: "error",
          message: "The AI provider's free allowance is currently unavailable. Please try again later. This attempt counts toward your limit.",
        };
      }

      return {
        status: "error",
        message: "We could not generate a complete study guide. Please try again later. This attempt counts toward your limit.",
      };
    }

    const title = subject;
    const guide = { title, content, sourceNote: noteReference };

    let sourceStatus = "general_unverified";
    if (noteReference) {
      sourceStatus = "user_notes";
    }
    const studySetId = randomUUID();

    // Keep the generated text in the response if saving fails, so it is not lost.
    try {
      const { error: saveError } = await supabase.from("study_sets").insert({
        id: studySetId,
        user_id: user.id,
        title,
        subject,
        notes: content,
        material_type: "study_guide",
        request_details: {
          educationLevel,
          academicDetails,
          subject,
          learningGoal,
          language,
          provider: "groq",
          model: STUDY_MODEL,
          sourceStatus,
          sourceNote: noteReference ?? null,
        },
        // No web sources are used. Personal-note provenance is saved in request_details.
        sources: [],
      });

      if (saveError) {
        return {
          status: "error",
          message: "Your guide was generated, but we could not confirm it was saved. Copy the text below to keep it. Please do not generate it again just to retry saving.",
          guide,
        };
      }
    } catch {
      return {
        status: "error",
        message: "Your guide was generated, but the save request was interrupted. Copy the text below to keep it. Please do not generate it again just to retry saving.",
        guide,
      };
    }

    // Saving is already confirmed; a refresh failure must not suggest regenerating.
    try {
      revalidatePath("/library");
      revalidatePath("/dashboard");
    } catch {
      console.warn("Study guide saved, but Library cache refresh failed.");
    }

    return {
      status: "success",
      message: "Your AI-generated study guide has been saved to your Library.",
      guide,
      studySetId,
    };
  } catch {
    return {
      status: "error",
      message: "We could not process your request. Please try again later.",
    };
  }
}
