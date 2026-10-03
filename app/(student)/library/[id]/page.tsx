import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BookOpen, Layers } from "lucide-react";
import FlashcardReview from "@/components/study/FlashcardReview";
import QuizPractice from "@/components/study/QuizPractice";
import { validateQuizQuestions } from "@/lib/ai/quizzes";
import type { Flashcard } from "@/lib/ai/flashcards";
import { createClient } from "@/lib/supabase/server";
import SavedMaterial from "../SavedMaterial";
import LessonNavigation from "../LessonNavigation";
import DeleteMaterialForm from "../DeleteMaterialForm";

export default async function SavedMaterialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    notFound();

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  // Both the owner filter and the database RLS policy protect this record.
  const { data: material, error } = await supabase
    .from("study_sets")
    .select(
      "id, title, subject, notes, material_type, created_at, request_details, flashcards, quiz_questions",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error("Could not load the saved material.");
  if (!material) notFound();

  let label = "Personal notes";
  if (material.material_type === "study_guide") label = "AI study guide";
  if (material.material_type === "flashcards") label = "AI flashcard deck";
  if (material.material_type === "quiz") label = "AI practice quiz";
  const quizQuestions =
    material.material_type === "quiz"
      ? validateQuizQuestions(material.quiz_questions)
      : [];
  const history =
    material.material_type === "quiz"
      ? await supabase
          .from("quiz_attempts")
          .select("id, score, question_count, answers, submitted_at")
          .eq("user_id", user.id)
          .eq("study_set_id", id)
          .order("submitted_at", { ascending: false })
          .order("id")
          .limit(20)
      : null;

  let cards: Flashcard[] = [];
  if (material.material_type === "flashcards") {
    const storedCards: unknown = material.flashcards;
    if (!Array.isArray(storedCards) || ![5, 10].includes(storedCards.length)) {
      throw new Error("The saved deck has invalid card data.");
    }
    cards = storedCards.map((card: unknown) => {
      if (
        typeof card !== "object" ||
        card === null ||
        !("question" in card) ||
        !("answer" in card) ||
        typeof card.question !== "string" ||
        typeof card.answer !== "string" ||
        card.question.trim().length === 0 ||
        card.question.trim().length > 240 ||
        card.answer.trim().length === 0 ||
        card.answer.trim().length > 600
      ) {
        throw new Error("The saved deck contains an unreadable card.");
      }
      return { question: card.question.trim(), answer: card.answer.trim() };
    });
  }

  // Older general guides have no sourceNote. Check JSON before showing a link.
  let sourceNote: { id: string; title: string } | undefined;
  const details = material.request_details;
  const savedNote = details?.sourceNote;
  const savedGuide = details?.sourceGuide;
  let sourceGuide =
    (material.material_type === "flashcards" ||
      material.material_type === "quiz") &&
    details?.sourceStatus === "saved_study_guide" &&
    typeof savedGuide?.id === "string" &&
    typeof savedGuide?.title === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      savedGuide.id,
    )
      ? { id: savedGuide.id, title: savedGuide.title }
      : undefined;
  if (
    (material.material_type === "study_guide" ||
      material.material_type === "flashcards") &&
    details?.sourceStatus === "user_notes" &&
    savedNote &&
    typeof savedNote.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      savedNote.id,
    ) &&
    typeof savedNote.title === "string"
  ) {
    sourceNote = { id: savedNote.id, title: savedNote.title };
  }

  // A derived material survives deletion of its original source. Avoid dead links.
  const sourceIds = [sourceNote?.id, sourceGuide?.id].filter(
    (value): value is string => Boolean(value),
  );
  let sourceUnavailable = false;
  if (sourceIds.length) {
    const { data: sources, error: sourceError } = await supabase
      .from("study_sets")
      .select("id")
      .eq("user_id", user.id)
      .in("id", sourceIds);
    const available = new Set((sources ?? []).map((source) => source.id));
    if (sourceError || (sourceNote && !available.has(sourceNote.id))) {
      sourceUnavailable = true;
      sourceNote = undefined;
    }
    if (sourceError || (sourceGuide && !available.has(sourceGuide.id))) {
      sourceUnavailable = true;
      sourceGuide = undefined;
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/library"
          className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-200 hover:underline"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          Back to Library
        </Link>
        <DeleteMaterialForm
          materialId={material.id}
          title={material.title}
          materialType={material.material_type}
        />
      </div>
      <header>
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-200">{label}</p>
        <h1 className="mt-2 break-words text-3xl font-semibold">
          {material.title}
        </h1>
        {material.subject && (
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">{material.subject}</p>
        )}
        <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
          Saved{" "}
          <time dateTime={material.created_at}>
            {new Date(material.created_at).toLocaleString("en-PH", {
              timeZone: "Asia/Manila",
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </time>
        </p>
      </header>

      {sourceUnavailable && (
        <p className="text-sm text-stone-500 dark:text-stone-400">
          The original source is unavailable. You can still use this saved
          material.
        </p>
      )}
      {material.material_type === "notes" && (
        <div className="space-y-3 rounded-xl bg-emerald-50 dark:bg-emerald-950 p-4">
          <p className="text-sm text-stone-600 dark:text-stone-300">
            Turn these notes into a study guide or flashcards. Your original
            notes will stay in your Library.
          </p>

          <Link
            href={`/study-tools/study-guides?note=${material.id}`}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-900"
          >
            <BookOpen size={18} aria-hidden="true" />
            Create study guide from these notes
          </Link>
          <Link
            href={"/study-tools/flashcards?note=" + material.id}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-800 bg-white dark:bg-stone-900 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950"
          >
            <Layers size={18} aria-hidden="true" /> Create flashcards from these
            notes
          </Link>
        </div>
      )}

      {sourceNote && (
        <p className="text-sm text-stone-600 dark:text-stone-300">
          Based on your notes:{" "}
          <Link
            href={"/library/" + sourceNote.id}
            className="font-medium text-emerald-800 dark:text-emerald-200 underline"
          >
            {sourceNote.title}
          </Link>
          . Additional explanations and examples may use AI knowledge.
        </p>
      )}

      {material.material_type === "study_guide" && (
        <Link
          href={"/study-tools/flashcards?guide=" + material.id}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-900"
        >
          <Layers size={18} aria-hidden="true" />
          Create flashcards from this guide
        </Link>
      )}
      {material.material_type === "study_guide" && (
        <Link
          href={"/study-tools/quizzes?guide=" + material.id}
          className="ml-3 inline-flex items-center gap-2 rounded-lg border border-emerald-800 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950"
        >
          Create quiz from this guide
        </Link>
      )}
      {material.material_type === "study_guide" && (
        <Link
          href={"/study-tools/ai-tutor?guide=" + material.id}
          className="inline-flex items-center rounded-xl bg-emerald-800 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-900"
        >
          Ask about this lesson
        </Link>
      )}
      {sourceGuide && (
        <p className="text-sm text-stone-600 dark:text-stone-300">
          Based on your saved study guide:{" "}
          <Link
            href={"/library/" + sourceGuide.id}
            className="text-emerald-800 dark:text-emerald-200 underline"
          >
            {sourceGuide.title}
          </Link>
          . This reference was AI-generated.
        </p>
      )}

      {material.material_type === "flashcards" && (
        <FlashcardReview key={material.id} cards={cards} />
      )}
      {material.material_type === "quiz" && (
        <>
          <QuizPractice
            key={material.id}
            studySetId={material.id}
            questions={quizQuestions.map(({ question, choices }) => ({
              question,
              choices,
            }))}
          />
          <section className="space-y-3">
            <h2
              id="quiz-attempts"
              className="scroll-mt-24 text-xl font-semibold"
            >
              Recent attempts (latest 20)
            </h2>
            {history?.error ? (
              <p role="alert">
                Could not load your attempts. Refresh to try again.
              </p>
            ) : (
              <>
                {!history?.data?.length && (
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    No saved attempts yet.
                  </p>
                )}
                {history?.data?.map((attempt) => (
                  <details
                    key={attempt.id}
                    className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4"
                  >
                    <summary className="cursor-pointer text-sm font-medium">
                      {attempt.score}/{attempt.question_count} ·{" "}
                      {new Date(attempt.submitted_at).toLocaleString("en-PH", {
                        timeZone: "Asia/Manila",
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </summary>
                    <ol className="mt-4 space-y-4">
                      {quizQuestions.map((question, i) => {
                        const selected = Array.isArray(attempt.answers)
                          ? attempt.answers[i]
                          : undefined;
                        const correct = selected === question.correctIndex;
                        return (
                          <li
                            key={i}
                            className={
                              "rounded-lg p-3 " +
                              (correct ? "bg-emerald-50 dark:bg-emerald-950" : "bg-red-50 dark:bg-red-950")
                            }
                          >
                            <p className="font-medium">
                              {i + 1}. {question.question}
                            </p>
                            <p className="mt-2 text-sm">
                              {correct ? "Correct" : "Needs review"} · Your
                              answer:{" "}
                              {typeof selected === "number"
                                ? (question.choices[selected] ?? "Unavailable")
                                : "Unavailable"}
                            </p>
                            {!correct && (
                              <p className="text-sm">
                                Correct answer:{" "}
                                {question.choices[question.correctIndex]}
                              </p>
                            )}
                            <p className="mt-2 text-sm">
                              {question.explanation}
                            </p>
                          </li>
                        );
                      })}
                    </ol>
                  </details>
                ))}
              </>
            )}
          </section>
        </>
      )}
      {material.material_type !== "flashcards" &&
        material.material_type !== "quiz" && (
          <SavedMaterial
            key={material.id}
            content={material.notes}
            isStudyGuide={material.material_type === "study_guide"}
          />
        )}
      {material.material_type === "study_guide" && (
        <LessonNavigation studySetId={material.id} userId={user.id} />
      )}
    </section>
  );
}
