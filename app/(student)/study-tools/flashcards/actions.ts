"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase/server";
import { generateFlashcards, type Flashcard } from "@/lib/ai/flashcards";
import { STUDY_MODEL } from "@/lib/ai/groq";

export type FlashcardState = {
  status: "idle" | "error" | "success";
  message: string;
  deck?: {
    title: string;
    cards: Flashcard[];
    sourceGuide?: { id: string; title: string };
    sourceNote?: {
      id: string;
      title: string;
    };
  };
  studySetId?: string;
};

export async function createFlashcards(
  _previousState: FlashcardState,
  formData: FormData,
): Promise<FlashcardState> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        status: "error",
        message: "Please log in before generating flashcards.",
      };
    }

    const fieldNames = [
      "educationLevel",
      "academicDetails",
      "subject",
      "learningGoal",
      "language",
      "cardCount",
    ];

    for (const field of fieldNames) {
      if (typeof formData.get(field) !== "string") {
        return {
          status: "error",
          message: "Please check your form fields.",
        };
      }
    }

    let educationLevel = String(formData.get("educationLevel")).trim();
    let academicDetails = String(formData.get("academicDetails")).trim();
    let subject = String(formData.get("subject")).trim();
    const learningGoal = String(formData.get("learningGoal")).trim();
    const language = String(formData.get("language")).trim();
    const cardCountInput = String(formData.get("cardCount")).trim();

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

    if (academicDetails.length > 120) {
      return {
        status: "error",
        message: "Academic details must not exceed 120 characters.",
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

    if (cardCountInput !== "5" && cardCountInput !== "10") {
      return {
        status: "error",
        message: "Please choose either 5 or 10 flashcards.",
      };
    }

    // Check server configuration before attempting generation.
if (!process.env.GROQ_API_KEY?.trim()) {
  return {
    status: "error",
    message: "Flashcard generation is temporarily unavailable.",
  };
}

const noteIdInput = formData.get("sourceNoteId");
const guideIdInput = formData.get("sourceGuideId");
let sourceGuide: { id: string; title: string; content: string } | undefined;

if (guideIdInput !== null) {
  if (noteIdInput !== null || typeof guideIdInput !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guideIdInput)) {
    return { status: "error", message: "Choose one valid study guide from your Library." };
  }
  // Read the content on the server; never trust a submitted title or guide body.
  const { data: guide, error } = await supabase.from("study_sets")
    .select("id, title, subject, notes, request_details")
    .eq("id", guideIdInput).eq("user_id", user.id)
    .eq("material_type", "study_guide").maybeSingle();
  if (error || !guide) return { status: "error", message: "This study guide is unavailable. Choose another guide from your Library." };
  if (typeof guide.notes !== "string" || !guide.notes.trim() || guide.notes.length > 20000) {
    return { status: "error", message: "Selected study guides must contain 1–20,000 characters." };
  }
  sourceGuide = { id: guide.id, title: guide.title, content: guide.notes };
  subject = guide.subject?.trim() || guide.title;
  const details = guide.request_details;
  educationLevel = typeof details?.educationLevel === "string" && allowedLevels.includes(details.educationLevel)
    ? details.educationLevel : "independent";
  academicDetails = typeof details?.academicDetails === "string" ? details.academicDetails.slice(0, 120) : "";
}

let sourceNote:
  | { id: string; title: string; content: string }
  | undefined;

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
      message: "We could not load your note. Please try again.",
    };
  }

  if (!note) {
    return {
      status: "error",
      message: "This note is unavailable. Choose one of your personal notes.",
    };
  }

  if (
    typeof note.notes !== "string" ||
    note.notes.trim().length === 0 ||
    note.notes.length > 20_000
  ) {
    return {
      status: "error",
      message: "Selected notes must contain 1–20,000 characters.",
    };
  }

  sourceNote = {
    id: note.id,
    title: note.title,
    content: note.notes,
  };
}

    // Reserve an attempt only after the form and selected note are valid.
    const { data: allowance, error: allowanceError } = await supabase.rpc(
      "reserve_ai_generation",
    );

    if (allowanceError) {
      return {
        status: "error",
        message: "We could not check your generation allowance. Try again later.",
      };
    }

    if (allowance !== "allowed") {
      let message = "We could not confirm your generation allowance.";
      if (allowance === "unauthorized") {
        message = "Please log in again.";
      } else if (allowance === "cooldown") {
        message = "Please wait at least 60 seconds between generation attempts.";
      } else if (allowance === "user_limit") {
        message = "You have used your 5 generation attempts in the last 24 hours.";
      } else if (allowance === "app_limit") {
        message = "LuminaPH has reached its shared allowance. Try again later.";
      }
      return { status: "error", message };
    }

    let cardCount: 5 | 10 = 5;
    if (cardCountInput === "10") cardCount = 10;

    let cards: Flashcard[];
    try {
      cards = await generateFlashcards({
        educationLevel,
        academicDetails,
        subject,
        learningGoal,
        language,
        cardCount,
        sourceNote,
        sourceGuide,
      });
    } catch (error) {
      let message = "We could not generate a complete deck. This attempt counts toward your limit.";
      if (error instanceof Groq.APIError && error.status === 429) {
        message = "The AI provider's free allowance is unavailable. Try again later. This attempt counts toward your limit.";
      }
      return { status: "error", message };
    }

    let noteReference: { id: string; title: string } | undefined;
    let sourceStatus = "general_unverified";
    if (sourceNote) {
      noteReference = { id: sourceNote.id, title: sourceNote.title };
      sourceStatus = "user_notes";
    }

    const guideReference = sourceGuide ? { id: sourceGuide.id, title: sourceGuide.title } : undefined;
    if (sourceGuide) sourceStatus = "saved_study_guide";
    const deck = { title: subject, cards, sourceNote: noteReference, sourceGuide: guideReference };
    const studySetId = randomUUID();

    // Preserve the generated cards in the response if saving fails.
    try {
      const { error: saveError } = await supabase.from("study_sets").insert({
        id: studySetId,
        user_id: user.id,
        title: subject,
        subject,
        material_type: "flashcards",
        notes: "",
        flashcards: cards,
        request_details: {
          educationLevel,
          academicDetails,
          subject,
          learningGoal,
          language,
          cardCount,
          provider: "groq",
          model: STUDY_MODEL,
          sourceStatus,
          sourceNote: noteReference ?? null,
          sourceGuide: guideReference ?? null,
        },
        sources: [],
      });

      if (saveError) {
        return {
          status: "error",
          message: "Your cards were generated, but saving was not confirmed. Keep a copy before leaving. Do not regenerate just to retry saving.",
          deck,
        };
      }
    } catch {
      return {
        status: "error",
        message: "Your cards were generated, but the save request was interrupted. Keep a copy before leaving.",
        deck,
      };
    }

    // A refresh failure must not misreport a confirmed save.
    try {
      revalidatePath("/library");
      revalidatePath("/dashboard");
    } catch {
      console.warn("Flashcard deck saved, but Library cache refresh failed.");
    }

    return {
      status: "success",
      message: "Your flashcard deck has been saved to your Library.",
      deck,
      studySetId,
    };
  } catch {
    return {
      status: "error",
      message: "We could not process your request. Please try again.",
    };
  }
}
