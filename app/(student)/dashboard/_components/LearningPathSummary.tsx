import Link from "next/link";
import { ArrowRight, Check, Route } from "lucide-react";

type PathLesson = {
  id: string;
  title: string;
  position: number;
  completed: boolean;
  study_set_id: string | null;
};

type SavedPath = {
  id: string;
  title: string;
  subject: string;
  learning_path_lessons: PathLesson[];
};

type LearningPathSummaryProps = {
  paths: SavedPath[] | null;
  totalCount: number | null;
};

export default function LearningPathSummary({ paths, totalCount }: LearningPathSummaryProps) {
  return (
    <section aria-labelledby="learning-paths-title" className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="learning-paths-title" className="text-lg font-semibold">Your learning paths</h2>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            {totalCount === null ? "Your saved study plans" : `${totalCount} saved · showing the latest 3`}
          </p>
        </div>
        <Link href="/study-tools/learning-paths" className="inline-flex items-center gap-2 rounded-lg border border-emerald-800/25 bg-white dark:bg-stone-900 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950">
          All paths <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </header>

      {paths === null ? (
        <p role="alert" className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5 text-sm">
          Could not load your learning paths. Refresh this page to try again.
        </p>
      ) : paths.length === 0 ? (
        <div className="rounded-xl border border-[#e6eadd] dark:border-stone-700 bg-white dark:bg-stone-900 p-5">
          <Route size={24} aria-hidden="true" className="text-emerald-800 dark:text-emerald-200" />
          <h3 className="mt-3 font-semibold">Give your next goal a study plan</h3>
          <p className="mt-2 text-sm leading-6 text-stone-500 dark:text-stone-400">Create a learning path, then study and track one lesson at a time.</p>
          <Link href="/study-tools/learning-paths" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-900">
            Create a learning path <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {paths.map(path => {
            const lessons = [...path.learning_path_lessons].sort((first, second) => first.position - second.position);
            const totalLessons = lessons.length;
            const completedCount = lessons.filter(lesson => lesson.completed).length;
            const nextLesson = lessons.find(lesson => !lesson.completed);
            const allComplete = totalLessons > 0 && completedCount === totalLessons;
            const pathHref = `/study-tools/learning-paths?path=${path.id}`;

            let continueHref = pathHref;
            let continueLabel = allComplete ? "Review path" : "Open path";

            if (nextLesson) {
              continueHref = nextLesson.study_set_id
                ? `/library/${nextLesson.study_set_id}`
                : `${pathHref}#lesson-${nextLesson.id}`;
              continueLabel = nextLesson.study_set_id ? "Continue lesson" : "Prepare next lesson";
            }

            return (
              <li key={path.id} className="space-y-4 rounded-xl border border-[#e6eadd] dark:border-stone-700 bg-white dark:bg-stone-900 p-5">
                <div className="flex items-start gap-3">
                  <Route size={22} aria-hidden="true" className="mt-1 shrink-0 text-emerald-800 dark:text-emerald-200" />
                  <div className="min-w-0">
                    <h3 className="break-words font-semibold">{path.title}</h3>
                    <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{path.subject}</p>
                  </div>
                </div>

                {totalLessons > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-stone-600 dark:text-stone-300">
                      {completedCount}/{totalLessons} lessons marked complete · {Math.round(completedCount / totalLessons * 100)}%
                    </p>
                    <progress value={completedCount} max={totalLessons} aria-label={`${path.title}: lessons marked complete`} className="block h-2 w-full accent-emerald-800" />
                  </div>
                ) : (
                  <p className="text-sm text-stone-500 dark:text-stone-400">No lessons available in this path.</p>
                )}

                {nextLesson && (
                  <p className="text-sm text-stone-600 dark:text-stone-300">
                    Up next: Lesson {nextLesson.position} — {nextLesson.title}
                    {!nextLesson.study_set_id && <span className="mt-1 block text-xs text-stone-500 dark:text-stone-400">Content has not been generated yet.</span>}
                  </p>
                )}
                {allComplete && (
                  <p className="flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-200"><Check size={17} aria-hidden="true" />All lessons marked complete</p>
                )}

                <div className="flex flex-wrap gap-3">
                  <Link href={continueHref} className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800">
                    {continueLabel} <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                  {nextLesson && <Link href={pathHref} className="inline-flex items-center rounded-xl border border-stone-200 dark:border-stone-700 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950">View full path</Link>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-stone-500 dark:text-stone-400">Path progress is based on your completion marks, not a mastery score.</p>
    </section>
  );
}
