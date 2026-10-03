"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase/server";
import { generateQuiz, validateQuizQuestions, type QuizQuestion } from "@/lib/ai/quizzes";
import { STUDY_MODEL } from "@/lib/ai/groq";

export type QuizState = {
  status: "idle" | "error" | "success";
  message: string;
  studySetId?: string;
  quiz?: {
    title: string;
    questions: QuizQuestion[];
    sourceGuide?: { id: string; title: string };
  };
};

export type QuizAttemptState = {
  status: "idle" | "error" | "success";
  message: string;
  result?: {
    attemptId: string;
    score: number;
    questionCount: number;
    answers: number[];
    questions: QuizQuestion[];
  };
};

const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const levels = ["junior-high", "senior-high", "college", "independent"];

export async function createQuiz(_previous: QuizState, formData: FormData): Promise<QuizState> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { status: "error", message: "Please log in before generating a quiz." };

    const language = formData.get("language");
    const count = formData.get("questionCount");
    if (language !== "english" && language !== "filipino" && language !== "taglish") {
      return { status: "error", message: "Choose a valid language." };
    }
    if (count !== "5" && count !== "10") return { status: "error", message: "Choose 5 or 10 questions." };
    const questionCount = count === "10" ? 10 : 5;
    let educationLevel = "independent";
    let academicDetails = "";
    let subject = "";
    let learningGoal = "Practice the key concepts in the selected study guide.";
    let sourceGuide: { id: string; title: string; content: string } | undefined;
    const guideId = formData.get("sourceGuideId");

    if (guideId !== null) {
      if (typeof guideId !== "string" || !validId.test(guideId)) {
        return { status: "error", message: "Choose a valid saved study guide." };
      }
      // Fetch trusted content ourselves; do not accept a guide body from the browser.
      const { data: guide, error } = await supabase.from("study_sets")
        .select("id, title, subject, notes, request_details")
        .eq("id", guideId).eq("user_id", user.id).eq("material_type", "study_guide").maybeSingle();
      if (error || !guide) return { status: "error", message: "This study guide is unavailable. Choose another guide." };
      if (typeof guide.notes !== "string" || !guide.notes.trim() || guide.notes.length > 20000) {
        return { status: "error", message: "Selected guides must contain 1–20,000 characters." };
      }
      sourceGuide = { id: guide.id, title: guide.title, content: guide.notes };
      subject = guide.subject?.trim() || guide.title;
      const details = guide.request_details;
      if (typeof details?.educationLevel === "string" && levels.includes(details.educationLevel)) educationLevel = details.educationLevel;
      if (typeof details?.academicDetails === "string") academicDetails = details.academicDetails.slice(0, 120);
    } else {
      for (const field of ["educationLevel", "academicDetails", "subject", "learningGoal"]) {
        if (typeof formData.get(field) !== "string") return { status: "error", message: "Please complete the quiz details." };
      }
      educationLevel = String(formData.get("educationLevel")).trim();
      academicDetails = String(formData.get("academicDetails")).trim();
      subject = String(formData.get("subject")).trim();
      learningGoal = String(formData.get("learningGoal")).trim();
    }
    if (!levels.includes(educationLevel) || academicDetails.length > 120 || !subject || subject.length > 120 ||
        !learningGoal || learningGoal.length > 1000) {
      return { status: "error", message: "Check your level, subject (1–120 characters), academic details (up to 120), and learning goal (1–1,000)." };
    }
    if (!process.env.GROQ_API_KEY?.trim()) return { status: "error", message: "Quiz generation is temporarily unavailable." };

    // Invalid input or inaccessible guides must not consume an AI attempt.
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

    let questions: QuizQuestion[];
    try {
      questions = await generateQuiz({ educationLevel, academicDetails, subject, learningGoal, language, questionCount, sourceGuide });
    } catch (error) {
      const message = error instanceof Groq.APIError && error.status === 429
        ? "The AI provider's free allowance is unavailable. Try again later. This attempt counts toward your limit."
        : "We could not generate a complete quiz. This attempt counts toward your limit.";
      return { status: "error", message };
    }

    const guideReference = sourceGuide ? { id: sourceGuide.id, title: sourceGuide.title } : undefined;
    const quiz = { title: subject, questions, sourceGuide: guideReference };
    const studySetId = randomUUID();
    try {
      const { error } = await supabase.from("study_sets").insert({
        id: studySetId, user_id: user.id, title: subject, subject,
        material_type: "quiz", notes: "", quiz_questions: questions,
        request_details: {
          educationLevel, academicDetails, subject, learningGoal, language, questionCount,
          provider: "groq", model: STUDY_MODEL,
          sourceStatus: sourceGuide ? "saved_study_guide" : "general_unverified",
          sourceGuide: guideReference ?? null,
        },
        sources: [],
      });
      if (error) throw new Error("Save not confirmed.");
    } catch {
      return { status: "error", message: "Your quiz was generated, but saving was not confirmed. Keep a copy before leaving. Check your Library before generating again.", quiz };
    }
    try { revalidatePath("/library"); revalidatePath("/dashboard"); }
    catch { console.warn("Quiz saved, but Library cache refresh failed."); }
    return { status: "success", message: "Your quiz has been saved to your Library.", quiz, studySetId };
  } catch {
    return { status: "error", message: "We could not process your quiz request. Please try again." };
  }
}

export async function submitQuiz(_previous: QuizAttemptState, formData: FormData): Promise<QuizAttemptState> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { status: "error", message: "Please log in before submitting your answers." };
    const studySetId = formData.get("studySetId");
    const attemptId = formData.get("attemptId");
    const rawAnswers = formData.get("answers");
    if (typeof studySetId !== "string" || !validId.test(studySetId) ||
        typeof attemptId !== "string" || !validId.test(attemptId) ||
        typeof rawAnswers !== "string" || rawAnswers.length > 100) {
      return { status: "error", message: "Invalid quiz submission. Please reopen the saved quiz." };
    }
    let answers: unknown;
    try { answers = JSON.parse(rawAnswers); }
    catch { return { status: "error", message: "Please select an answer for every question." }; }
    if (!Array.isArray(answers) || ![5, 10].includes(answers.length) ||
        !answers.every((answer) => Number.isInteger(answer) && answer >= 0 && answer <= 3)) {
      return { status: "error", message: "Please select one valid answer for every question." };
    }
    const { data: quiz, error: quizError } = await supabase.from("study_sets")
      .select("quiz_questions").eq("id", studySetId).eq("user_id", user.id).eq("material_type", "quiz").maybeSingle();
    if (quizError || !quiz) return { status: "error", message: "This saved quiz is unavailable." };
    const questions = validateQuizQuestions(quiz.quiz_questions, answers.length);

    // Grading and saving happen together in SQL. Never accept a browser score.
    // Reuse the same attemptId and answers when retrying an uncertain submission.
    const { data: attempt, error } = await supabase.rpc("submit_quiz_attempt", {
      p_attempt_id: attemptId, p_study_set_id: studySetId, p_answers: answers,
    });
    if (error || !attempt) return { status: "error", message: "We could not confirm your submission. Retry with the same answers; no AI attempt is used." };
    if (attempt.id !== attemptId || attempt.user_id !== user.id || attempt.study_set_id !== studySetId ||
        attempt.question_count !== questions.length || !Number.isInteger(attempt.score) ||
        attempt.score < 0 || attempt.score > questions.length ||
        JSON.stringify(attempt.answers) !== JSON.stringify(answers)) {
      return { status: "error", message: "We could not verify the saved result. Reopen the quiz to check your attempts." };
    }
    try { revalidatePath("/library/" + studySetId); revalidatePath("/dashboard"); }
    catch { console.warn("Quiz attempt saved, but page cache refresh failed."); }
    return {
      status: "success", message: "Your quiz result has been saved.",
      result: { attemptId: attempt.id, score: attempt.score, questionCount: questions.length, answers: attempt.answers, questions },
    };
  } catch {
    return { status: "error", message: "We could not confirm your result. Keep your answers and retry the same submission." };
  }
}
