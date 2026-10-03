import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateQuizQuestions } from "@/lib/ai/quizzes";
import GroupQuizGenerator from "../../../components/GroupQuizGenerator";
import GroupQuizPractice from "../../../components/GroupQuizPractice";
import {
  readGroupQuizQuestions,
  type GroupQuizQuestion,
  type GroupQuizResult,
} from "../../../group-quiz-types";

export default async function GroupQuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; quizId: string }>;
  searchParams: Promise<{ attempt?: string | string[] }>;
}) {
  const { id, quizId } = await params;
  const { attempt: attemptId } = await searchParams;
  const validId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    !validId.test(id) ||
    !validId.test(quizId) ||
    (attemptId !== undefined &&
      (typeof attemptId !== "string" || !validId.test(attemptId)))
  )
    notFound();

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");
  const groupUrl = `/study-tools/study-groups/${id}`;
  const quizUrl = `${groupUrl}/quizzes/${quizId}`;
  const button =
    "inline-flex rounded-xl border border-stone-300 dark:border-stone-700 px-4 py-3 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800";
  const loadError = (
    <div className="space-y-4">
      <p role="alert" className="text-red-700 dark:text-red-200">
        Could not load this quiz. Please refresh.
      </p>
      <Link href={`${groupUrl}#group-track`} className={button}>
        Back to group
      </Link>
    </div>
  );
  const { data: group, error: groupError } = await supabase
    .from("study_groups")
    .select("id, owner_id")
    .eq("id", id)
    .maybeSingle();
  if (groupError) return loadError;
  if (!group) notFound();
  const { data: track, error: trackError } = await supabase
    .from("group_study_tracks")
    .select("id, title")
    .eq("group_id", id)
    .maybeSingle();
  if (trackError) return loadError;
  if (!track) notFound();
  const { data: quiz, error: quizError } = await supabase
    .from("group_track_quizzes")
    .select("id, lesson_id, generated_at")
    .eq("id", quizId)
    .maybeSingle();
  if (quizError) return loadError;
  if (!quiz) notFound();
  const { data: lesson, error: lessonError } = await supabase
    .from("group_track_lessons")
    .select("id, title, position, generated_at")
    .eq("id", quiz.lesson_id)
    .eq("track_id", track.id)
    .maybeSingle();
  if (lessonError) return loadError;
  if (!lesson) notFound();

  const { data: reading, error: readingError } = await supabase
    .from("group_track_lesson_progress")
    .select("completed_at")
    .eq("lesson_id", lesson.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readingError) return loadError;
  if (!reading) {
    return (
      <section className="mx-auto max-w-3xl space-y-5 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-800 dark:text-emerald-200">
          Quiz locked
        </p>
        <h1 className="text-2xl font-semibold">Read the lesson first</h1>
        <p className="text-sm leading-6 text-stone-600 dark:text-stone-300">
          Read {lesson.title}, then press Mark lesson complete at the bottom.
          This unlocks its quiz for your account.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={`${groupUrl}/lessons/${lesson.id}`} className={button}>
            Open lesson
          </Link>
          <Link href={`${groupUrl}#group-track`} className={button}>
            Back to group
          </Link>
        </div>
      </section>
    );
  }

  let questions: GroupQuizQuestion[] = [];
  let result: GroupQuizResult | undefined;
  if (quiz.generated_at) {
    const { data, error } = await supabase.rpc("get_group_track_quiz", {
      p_group_id: id,
      p_quiz_id: quizId,
    });
    if (error) return loadError;
    try {
      questions = readGroupQuizQuestions(data);
    } catch {
      return loadError;
    }
  }
  if (attemptId) {
    // Attempts are constrained to this quiz and the logged-in learner, even for owners.
    const { data: attempt, error } = await supabase
      .from("group_track_quiz_attempts")
      .select("id, score, question_count, answers")
      .eq("id", attemptId)
      .eq("quiz_id", quizId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) return loadError;
    if (!attempt) notFound();
    if (
      attempt.question_count !== questions.length ||
      !Array.isArray(attempt.answers) ||
      attempt.answers.length !== questions.length ||
      !attempt.answers.every(
        (answer: unknown) =>
          typeof answer === "number" &&
          Number.isInteger(answer) &&
          answer >= 0 &&
          answer <= 3,
      ) ||
      !Number.isInteger(attempt.score) ||
      attempt.score < 0 ||
      attempt.score > questions.length
    )
      return loadError;
    result = {
      attemptId: attempt.id,
      score: attempt.score,
      questionCount: attempt.question_count,
      answers: attempt.answers,
    };
    try {
      const { data, error: reviewError } = await supabase.rpc(
        "get_group_track_quiz_review",
        { p_group_id: id, p_attempt_id: attemptId },
      );
      if (!reviewError)
        result.review = validateQuizQuestions(data, questions.length);
    } catch {
      /* Keep the saved score visible when explanations cannot be loaded. */
    }
  }
  const { data: history, error: historyError } = await supabase
    .from("group_track_quiz_attempts")
    .select("id, score, question_count, submitted_at")
    .eq("quiz_id", quizId)
    .eq("user_id", user.id)
    .order("submitted_at", { ascending: false })
    .order("id")
    .limit(10);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <nav className="flex flex-wrap gap-3" aria-label="Quiz navigation">
        <Link href={`${groupUrl}#group-track`} className={button}>
          Back to group
        </Link>
        <Link href={`${groupUrl}/lessons/${lesson.id}`} className={button}>
          Read source lesson
        </Link>
      </nav>
      <header className="space-y-2">
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
          {track.title} · Quiz {lesson.position} of 5
        </p>
        <h1 className="break-words text-3xl font-semibold">{lesson.title}</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Practice based on your group&apos;s saved lesson. AI-generated
          questions may contain mistakes.
        </p>
      </header>
      {quiz.generated_at ? (
        <GroupQuizPractice
          key={`${quizId}:${attemptId ?? "new"}`}
          groupId={id}
          quizId={quizId}
          questions={questions}
          initialResult={result}
        />
      ) : (
        <section className="space-y-4 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6">
          <h2 className="text-lg font-semibold">Quiz not ready yet</h2>
          {!lesson.generated_at ? (
            <p className="text-sm text-stone-600 dark:text-stone-300">
              The source lesson needs to be generated first.
            </p>
          ) : group.owner_id === user.id ? (
            <GroupQuizGenerator groupId={id} quizId={quizId} />
          ) : (
            <p className="text-sm text-stone-600 dark:text-stone-300">
              Your group owner will prepare this quiz. You can review the lesson
              while waiting.
            </p>
          )}
        </section>
      )}
      <section className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6">
        <h2 className="font-semibold">Your latest 10 attempts</h2>
        {historyError ? (
          <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-200">
            Could not load your attempt history.
          </p>
        ) : !history?.length ? (
          <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
            No submitted attempts yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100 dark:divide-stone-700">
            {history.map((attempt) => (
              <li
                key={attempt.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-medium">
                    {attempt.score}/{attempt.question_count}
                  </p>
                  <time
                    dateTime={attempt.submitted_at}
                    className="text-xs text-stone-500 dark:text-stone-400"
                  >
                    {new Date(attempt.submitted_at).toLocaleString("en-PH", {
                      timeZone: "Asia/Manila",
                    })}
                  </time>
                </div>
                <Link
                  href={`${quizUrl}?attempt=${attempt.id}`}
                  className={button}
                >
                  View result
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Link href={`${groupUrl}#group-track`} className={button}>
        Back to group track
      </Link>
    </div>
  );
}
