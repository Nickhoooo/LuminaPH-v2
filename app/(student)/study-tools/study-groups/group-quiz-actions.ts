"use server";

import { revalidatePath } from "next/cache";
import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase/server";
import {
  generateQuiz,
  validateQuizQuestions,
  type QuizQuestion,
} from "@/lib/ai/quizzes";
import type { GroupQuizAttemptState } from "./group-quiz-types";

export type GroupQuizGenerationState = {
  status: "idle" | "error" | "success";
  message: string;
  unsavedQuestions?: QuizQuestion[];
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readIds(form: FormData) {
  const groupId = form.get("groupId");
  const quizId = form.get("quizId");
  if (
    typeof groupId !== "string" ||
    !uuidPattern.test(groupId) ||
    typeof quizId !== "string" ||
    !uuidPattern.test(quizId)
  )
    throw new Error("Invalid IDs.");
  return { groupId, quizId };
}

function refreshQuiz(groupId: string, quizId: string) {
  revalidatePath(`/study-tools/study-groups/${groupId}`);
  revalidatePath(`/study-tools/study-groups/${groupId}/quizzes/${quizId}`);
}

export async function generateGroupQuiz(
  _previous: GroupQuizGenerationState,
  form: FormData,
): Promise<GroupQuizGenerationState> {
  let questions: QuizQuestion[] | undefined;
  try {
    const { groupId, quizId } = readIds(form);
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return { status: "error", message: "Please log in to prepare the quiz." };
    const { data: group, error: groupError } = await supabase
      .from("study_groups")
      .select("owner_id")
      .eq("id", groupId)
      .maybeSingle();
    if (groupError || !group || group.owner_id !== user.id) {
      return {
        status: "error",
        message: "Only the current group owner can generate shared quizzes.",
      };
    }
    const { data: track, error: trackError } = await supabase
      .from("group_study_tracks")
      .select("id, subject, education_level, academic_details, language")
      .eq("group_id", groupId)
      .maybeSingle();
    if (trackError || !track)
      return { status: "error", message: "Study track unavailable." };

    // Column-level grants intentionally prohibit selecting the answer-key column.
    const { data: quiz, error: quizError } = await supabase
      .from("group_track_quizzes")
      .select("id, lesson_id, generated_at")
      .eq("id", quizId)
      .maybeSingle();
    if (quizError || !quiz)
      return { status: "error", message: "Quiz unavailable." };
    const { data: lesson, error: lessonError } = await supabase
      .from("group_track_lessons")
      .select("id, title, objective, content")
      .eq("id", quiz.lesson_id)
      .eq("track_id", track.id)
      .maybeSingle();
    if (lessonError || !lesson?.content) {
      return {
        status: "error",
        message: "Generate this group's lesson before preparing its quiz.",
      };
    }
    if (quiz.generated_at) {
      try {
        refreshQuiz(groupId, quizId);
      } catch {
        /* Saved quiz remains available. */
      }
      return {
        status: "success",
        message: "This quiz is already saved. Refresh to open it.",
      };
    }

    const { data: reading, error: readingError } = await supabase
      .from("group_track_lesson_progress")
      .select("completed_at")
      .eq("lesson_id", lesson.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (readingError || !reading) {
      return {
        status: "error",
        message: "Read and mark the lesson complete before preparing its quiz.",
      };
    }

    const mode = form.get("mode");
    if (mode === "retry-save") {
      const raw = form.get("questions");
      if (typeof raw !== "string" || raw.length > 40000)
        throw new Error("Invalid draft.");
      questions = validateQuizQuestions(JSON.parse(raw));
    } else if (mode === "generate") {
      const count = form.get("questionCount");
      if (count !== "5" && count !== "10")
        return { status: "error", message: "Choose 5 or 10 questions." };
      const language = track.language;
      if (
        language !== "english" &&
        language !== "filipino" &&
        language !== "taglish"
      ) {
        return { status: "error", message: "The track language is invalid." };
      }
      if (!process.env.GROQ_API_KEY?.trim())
        return {
          status: "error",
          message: "Quiz generation is temporarily unavailable.",
        };
      const { data: allowance, error } = await supabase.rpc(
        "reserve_ai_generation",
      );
      if (error)
        return {
          status: "error",
          message: "Could not check your generation allowance.",
        };
      if (allowance !== "allowed") {
        const messages: Record<string, string> = {
          unauthorized: "Please log in again.",
          cooldown:
            "Please wait at least 60 seconds between generation attempts.",
          user_limit:
            "You have used your 5 generation attempts in the last 24 hours.",
          app_limit:
            "LuminaPH has reached its shared allowance. Try again later.",
        };
        return {
          status: "error",
          message:
            messages[String(allowance)] ??
            "Could not confirm your generation allowance.",
        };
      }
      try {
        questions = validateQuizQuestions(
          await generateQuiz({
            subject: track.subject,
            educationLevel: track.education_level,
            academicDetails: track.academic_details,
            language,
            learningGoal: lesson.objective,
            questionCount: count === "10" ? 10 : 5,
            sourceGuide: { title: lesson.title, content: lesson.content },
          }),
          Number(count),
        );
      } catch (error) {
        return {
          status: "error",
          message:
            error instanceof Groq.APIError && error.status === 429
              ? "The AI provider's free allowance is unavailable. Try again later. This attempt counts toward your limit."
              : "Could not generate a complete quiz. This attempt counts toward your limit.",
        };
      }
    } else {
      return {
        status: "error",
        message: "Choose Generate quiz or Retry saving.",
      };
    }
    const { data, error } = await supabase.rpc("save_group_track_quiz", {
      p_group_id: groupId,
      p_quiz_id: quizId,
      p_questions: questions,
    });
    if (error || data !== quizId) throw new Error("Save not confirmed.");
    try {
      refreshQuiz(groupId, quizId);
    } catch {
      return { status: "success", message: "Quiz saved. Refresh to open it." };
    }
    return {
      status: "success",
      message: "Quiz saved for everyone in the group.",
    };
  } catch {
    return {
      status: "error",
      message: questions
        ? "Saving was not confirmed. Keep this draft and retry saving without generating again."
        : "Could not complete the request. Refresh and check your access before retrying; an attempt may have counted.",
      ...(questions ? { unsavedQuestions: questions } : {}),
    };
  }
}

export async function submitGroupQuiz(
  form: FormData,
): Promise<GroupQuizAttemptState> {
  try {
    const { groupId, quizId } = readIds(form);
    const attemptId = form.get("attemptId");
    const raw = form.get("answers");
    if (
      typeof attemptId !== "string" ||
      !uuidPattern.test(attemptId) ||
      typeof raw !== "string" ||
      raw.length > 100
    )
      throw new Error("Invalid submission.");
    const answers: unknown = JSON.parse(raw);
    if (
      !Array.isArray(answers) ||
      ![5, 10].includes(answers.length) ||
      !answers.every(
        (answer) => Number.isInteger(answer) && answer >= 0 && answer <= 3,
      )
    ) {
      return {
        status: "error",
        message: "Choose one answer for every question.",
      };
    }
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return {
        status: "error",
        message: "Please log in again before submitting.",
      };
    // SQL validates membership, the group's quiz, choices, and the retry ID, then grades.
    const { data: attempt, error } = await supabase.rpc(
      "submit_group_track_quiz",
      {
        p_group_id: groupId,
        p_quiz_id: quizId,
        p_attempt_id: attemptId,
        p_answers: answers,
      },
    );
    if (
      error ||
      !attempt ||
      attempt.id !== attemptId ||
      attempt.user_id !== user.id ||
      attempt.quiz_id !== quizId ||
      attempt.question_count !== answers.length ||
      !Number.isInteger(attempt.score) ||
      attempt.score < 0 ||
      attempt.score > answers.length ||
      JSON.stringify(attempt.answers) !== JSON.stringify(answers)
    )
      throw new Error("Save not confirmed.");

    // A review failure must not misreport an already saved attempt as a failed save.
    let review: QuizQuestion[] | undefined;
    try {
      const { data, error: reviewError } = await supabase.rpc(
        "get_group_track_quiz_review",
        {
          p_group_id: groupId,
          p_attempt_id: attemptId,
        },
      );
      if (!reviewError) review = validateQuizQuestions(data, answers.length);
    } catch {
      /* The learner can reopen the saved result to retry loading explanations. */
    }
    try {
      refreshQuiz(groupId, quizId);
    } catch {
      /* Return the confirmed result anyway. */
    }
    return {
      status: "success",
      message: review
        ? "Your quiz result has been saved."
        : "Result saved. Reopen it to load the explanations.",
      result: {
        attemptId,
        score: attempt.score,
        questionCount: answers.length,
        answers,
        review,
      },
    };
  } catch {
    return {
      status: "error",
      message:
        "Submission was not confirmed. Retry with the same answers; no AI attempt is used.",
    };
  }
}
