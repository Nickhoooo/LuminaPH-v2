import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import LessonProgress from "../study-tools/learning-paths/LessonProgress";

type LessonNavigationProps = {
  studySetId: string;
  userId: string;
};

export default async function LessonNavigation({
  studySetId,
  userId,
}: LessonNavigationProps) {
  const supabase = await createClient();

  // Resolve the actual lesson link, not editable request_details metadata.
  const { data: currentLesson, error: lessonError } = await supabase
    .from("learning_path_lessons")
    .select("id, path_id, position, completed")
    .eq("study_set_id", studySetId)
    .maybeSingle();

  if (lessonError) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-stone-200 dark:border-stone-700 p-4 text-sm"
      >
        Could not load lesson navigation. Refresh or{" "}
        <Link
          href="/study-tools/learning-paths"
          className="text-emerald-800 dark:text-emerald-200 underline"
        >
          return to your learning paths
        </Link>
        .
      </p>
    );
  }

  if (!currentLesson) return null;

  const { data: path, error: pathError } = await supabase
    .from("learning_paths")
    .select("id, title")
    .eq("id", currentLesson.path_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (pathError || !path) {
    return (
      <p role="alert">
        This learning path is unavailable. Please refresh to try again.
      </p>
    );
  }

  const { data: lessons, error: orderError } = await supabase
    .from("learning_path_lessons")
    .select("id, position, title, study_set_id")
    .eq("path_id", path.id)
    .order("position");

  const pathHref = `/study-tools/learning-paths?path=${path.id}`;
  const nextLesson = lessons?.find(
    (lesson) => lesson.position > currentLesson.position,
  );
  const nextHref = nextLesson?.study_set_id
    ? `/library/${nextLesson.study_set_id}`
    : `${pathHref}#lesson-${nextLesson?.id}`;
  const linkStyle =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-800/25 bg-white dark:bg-stone-900 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800";

  return (
    <section
      aria-labelledby="lesson-finish-title"
      className="space-y-5 rounded-2xl border border-[#dce5d5] dark:border-stone-700 bg-[#f0f4eb] dark:bg-stone-800 p-5 sm:p-7"
    >
      <header>
        <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">
          Lesson {currentLesson.position} · {path.title}
        </p>
        <h2 id="lesson-finish-title" className="mt-2 text-2xl font-semibold">
          {currentLesson.completed
            ? "Lesson marked complete"
            : "Finished this lesson?"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-300">
          Mark it complete when you are ready. Opening the next lesson does not
          automatically mark this one complete.
        </p>
      </header>

      <LessonProgress
        pathId={path.id}
        lessonId={currentLesson.id}
        completed={currentLesson.completed}
      />

      {orderError ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-200">
          Could not load the next lesson. Return to the path or refresh.
        </p>
      ) : nextLesson ? (
        <div>
          <p className="text-sm font-medium">Up next: {nextLesson.title}</p>
          {!nextLesson.study_set_id && (
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
              This lesson is not generated yet. Continue to its card to generate
              it.
            </p>
          )}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-200">
          <Check size={18} aria-hidden="true" />
          You reached the final lesson. Return to your path to review your
          overall progress.
        </p>
      )}

      <nav
        aria-label="Continue learning"
        className="flex flex-col gap-3 sm:flex-row sm:flex-wrap"
      >
        <Link href={pathHref} className={linkStyle}>
          <ArrowLeft size={17} aria-hidden="true" />
          Back to learning path
        </Link>
        {!orderError && nextLesson && (
          <Link
            href={nextHref}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800"
          >
            {nextLesson.study_set_id
              ? "Next lesson"
              : "Continue to next lesson"}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        )}
      </nav>
    </section>
  );
}
