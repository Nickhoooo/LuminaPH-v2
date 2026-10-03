"use server";

import { revalidatePath } from "next/cache";
import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase/server";
import { generateTutorReply } from "@/lib/ai/tutor";

export type TutorState = {
  status: "idle" | "error" | "success";
  message: string;
  conversationId?: string;
  turn?: {
    id: string;
    question: string;
    answer: string;
    saved: boolean;
  };
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function askTutor(
  _previous: TutorState,
  formData: FormData,
): Promise<TutorState> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { status: "error", message: "Please log in to ask the AI Tutor." };
    }

    const studySetId = formData.get("studySetId");
    const turnId = formData.get("turnId");
    const questionInput = formData.get("question");
    const language = formData.get("language");

    if (
      typeof studySetId !== "string" || !uuidPattern.test(studySetId) ||
      typeof turnId !== "string" || !uuidPattern.test(turnId)
    ) {
      return { status: "error", message: "Open a valid saved guide and try again." };
    }
    if (typeof questionInput !== "string" || !questionInput.trim() || questionInput.length > 2000) {
      return { status: "error", message: "Enter a question of 1–2,000 characters." };
    }
    if (language !== "english" && language !== "filipino" && language !== "taglish") {
      return { status: "error", message: "Choose a valid explanation language." };
    }

    const question = questionInput.trim();
    const { data: guide, error: guideError } = await supabase
      .from("study_sets")
      .select("id, title, notes")
      .eq("id", studySetId)
      .eq("user_id", user.id)
      .eq("material_type", "study_guide")
      .maybeSingle();

    if (guideError || !guide) {
      return { status: "error", message: "This study guide is unavailable." };
    }
    if (
      typeof guide.title !== "string" || !guide.title.trim() || guide.title.length > 120 ||
      typeof guide.notes !== "string" || !guide.notes.trim() || guide.notes.length > 20000
    ) {
      return { status: "error", message: "This guide does not contain valid lesson text." };
    }

    const { data: conversationId, error: conversationError } = await supabase.rpc("open_lesson_tutor", {
      p_study_set_id: studySetId,
    });

    if (conversationError || typeof conversationId !== "string" || !uuidPattern.test(conversationId)) {
      return { status: "error", message: "We could not open your conversation. Please try again." };
    }

    // The conversation ID comes from the ownership-checking RPC, never the form.
    const { data: existingTurn, error: turnError } = await supabase
      .from("tutor_turns")
      .select("id, question, answer")
      .eq("id", turnId)
      .eq("conversation_id", conversationId)
      .maybeSingle();

    if (turnError) {
      return { status: "error", message: "We could not check your previous submission. Refresh before retrying." };
    }
    if (existingTurn) {
      if (existingTurn.question !== question) {
        return { status: "error", message: "This message ID was already used. Start a new message for a different question." };
      }
      return {
        status: "success",
        message: "Your saved reply is ready.",
        conversationId,
        turn: { ...existingTurn, saved: true },
      };
    }

    const { data: recentTurns, error: historyError } = await supabase
      .from("tutor_turns")
      .select("question, answer")
      .eq("conversation_id", conversationId)
      .order("turn_number", { ascending: false })
      .limit(6);

    if (historyError) {
      return { status: "error", message: "We could not load your conversation context. Please try again." };
    }
    if (!process.env.GROQ_API_KEY?.trim()) {
      return { status: "error", message: "AI Tutor is temporarily unavailable." };
    }

    const { data: allowance, error: allowanceError } = await supabase.rpc("reserve_tutor_generation", {
      p_conversation_id: conversationId,
    });

    if (allowanceError) {
      return { status: "error", message: "We could not check your chat allowance. Try again later." };
    }
    if (allowance !== "allowed") {
      const messages: Record<string, string> = {
        unauthorized: "Please log in again.",
        unavailable: "This conversation is unavailable.",
        cooldown: "Please wait at least 10 seconds between chat attempts.",
        user_limit: "You have used your 20 chat attempts in the last 24 hours.",
        app_limit: "LuminaPH has reached its shared chat allowance. Try again later.",
      };
      return {
        status: "error",
        message: messages[String(allowance)] ?? "We could not confirm your chat allowance.",
      };
    }

    let answer: string;
    try {
      answer = await generateTutorReply({
        guideTitle: guide.title,
        guideContent: guide.notes,
        question,
        language,
        history: [...(recentTurns ?? [])].reverse(),
      });
    } catch (error) {
      const providerLimited = error instanceof Groq.APIError && error.status === 429;
      return {
        status: "error",
        message: providerLimited
          ? "The AI provider's free allowance is unavailable. Try again later. This chat attempt counts toward your limit."
          : "We could not generate a complete reply. This chat attempt counts toward your limit.",
      };
    }

    try {
      const { data: savedId, error: saveError } = await supabase.rpc("save_tutor_turn", {
        p_conversation_id: conversationId,
        p_turn_id: turnId,
        p_question: question,
        p_answer: answer,
      });

      if (saveError || savedId !== turnId) {
        throw new Error("Tutor reply save was not confirmed.");
      }
    } catch {
      return {
        status: "error",
        message: "Your reply was generated, but saving was not confirmed. Copy it before leaving and reload the conversation to check. Do not resend just to retry saving.",
        conversationId,
        turn: { id: turnId, question, answer, saved: false },
      };
    }

    try {
      revalidatePath("/study-tools/ai-tutor");
    } catch {
      console.warn("Tutor reply saved, but page refresh failed.");
    }

    return {
      status: "success",
      message: "Reply saved to your conversation.",
      conversationId,
      turn: { id: turnId, question, answer, saved: true },
    };
  } catch {
    return {
      status: "error",
      message: "We could not confirm your request. Reload your conversation before retrying; a chat attempt may have counted.",
    };
  }
}
