import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, Route } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import LearningPathForm from "./LearningPathForm";
import LessonProgress from "./LessonProgress";
import LessonContent from "./LessonContent";

export default async function LearningPathsPage({ searchParams }: { searchParams: Promise<{ path?: string | string[]; page?: string }> }) {
  const { path: pathId, page } = await searchParams;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");
  if (pathId !== undefined) {
    if (typeof pathId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pathId)) return <p role="alert">Invalid path link. <Link href="/study-tools/learning-paths" className="underline">Back to paths</Link></p>;
    const { data: path, error } = await supabase.from("learning_paths").select("id, title, subject, learning_goal").eq("id", pathId).eq("user_id", user.id).maybeSingle();
    if (error || !path) return <p role="alert">This path could not be loaded. <Link href="/study-tools/learning-paths" className="underline">Back to paths</Link></p>;
    // Read lessons only after verifying path ownership; RLS also protects these rows.
    const { data: lessons, error: lessonError } = await supabase
      .from("learning_path_lessons")
      .select("id, position, title, objective, completed, study_set_id")
      .eq("path_id", pathId)
      .order("position");
    const total = lessons?.length ?? 0;
    const completed = lessons?.filter(lesson => lesson.completed).length ?? 0;
    return <section className="mx-auto max-w-3xl space-y-6">
      <Link href="/study-tools/learning-paths" className="inline-flex rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-4 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-200">All learning paths</Link>
      <header><p className="text-sm text-emerald-700 dark:text-emerald-200">{path.subject}</p><h1 className="mt-2 break-words text-3xl font-semibold">{path.title}</h1><p className="mt-3 break-words text-sm leading-6 text-stone-500 dark:text-stone-400">{path.learning_goal}</p></header>
      <p className="rounded-xl bg-[#edf1e6] dark:bg-stone-800 p-4 text-sm leading-6">
        Generate lesson content one lesson at a time, then reopen it from your path or Library.
        Completion is self-reported, not a mastery score.
      </p>
      {lessonError ? <p role="alert">Could not load lessons or progress. Refresh to try again.</p> : total === 0 ? <p role="alert">This path has no lessons available.</p> : <>
        <div className="space-y-2"><p className="text-sm font-medium">{completed}/{total} lessons marked complete · {Math.round(completed / total * 100)}%</p><progress aria-label="Lessons marked complete" value={completed} max={total} className="h-2 w-full accent-emerald-800" />{completed === total && <p className="text-sm text-emerald-800 dark:text-emerald-200">All lessons marked complete. You can revisit any objective below.</p>}</div>
        <ol className="space-y-4">{lessons?.map(lesson => <li key={lesson.id} id={`lesson-${lesson.id}`} className={"scroll-mt-24 rounded-2xl border bg-white dark:bg-stone-900 p-5 sm:p-6 " + (lesson.completed ? "border-emerald-300 dark:border-emerald-700" : "border-stone-200 dark:border-stone-700")}>
          <p className="flex items-center gap-2 text-xs font-medium text-emerald-800 dark:text-emerald-200">Lesson {lesson.position}{lesson.completed && <><Check size={15} aria-hidden="true" />Complete</>}</p>
          <h2 className="mt-2 break-words text-lg font-semibold">{lesson.title}</h2><p className="mt-2 break-words text-sm leading-6 text-stone-500 dark:text-stone-400">{lesson.objective}</p>
          <LessonProgress pathId={pathId} lessonId={lesson.id} completed={lesson.completed} />
          <LessonContent
            pathId={pathId}
            lessonId={lesson.id}
            studySetId={lesson.study_set_id}
          />
        </li>)}</ol>
      </>}
    </section>;
  }
  const requested = Number(page ?? 1);
  const current = Number.isSafeInteger(requested) && requested > 0 && requested <= 100000 ? requested : 1;
  const { data: paths, error, count } = await supabase.from("learning_paths").select("id, title, subject, created_at", { count: "exact" }).eq("user_id", user.id).order("created_at", { ascending: false }).order("id").range((current - 1) * 10, current * 10 - 1);
  return <section className="mx-auto max-w-3xl space-y-8">
    <header><h1 className="text-3xl font-semibold">Learning Paths</h1><p className="mt-3 text-sm text-stone-500 dark:text-stone-400">Break a learning goal into smaller steps, and track what you have studied.</p></header>
    <LearningPathForm />
    <section id="saved-paths" className="space-y-4"><h2 className="text-xl font-semibold">Your saved paths</h2>
      {error ? <p role="alert">Could not load saved paths. Refresh before generating another outline.</p> : <>
        {!paths?.length && <p className="text-sm text-stone-500 dark:text-stone-400">No saved paths on this page. Your generated outlines appear here.</p>}
        <ul className="space-y-3">{paths?.map(path => <li key={path.id}><Link href={"/study-tools/learning-paths?path=" + path.id} className="flex items-start gap-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5 hover:border-emerald-600"><Route size={22} className="shrink-0 text-emerald-800 dark:text-emerald-200" aria-hidden="true" /><div className="min-w-0"><h3 className="break-words font-semibold">{path.title}</h3><p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{path.subject}</p><p className="mt-2 text-xs text-stone-500 dark:text-stone-400">Saved {new Date(path.created_at).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}</p></div></Link></li>)}</ul>
        <nav aria-label="Saved path pages" className="flex gap-4 text-sm text-emerald-800 dark:text-emerald-200">{current > 1 && <Link href={"?page=" + (current - 1) + "#saved-paths"}>Previous</Link>}{(count ?? 0) > current * 10 && <Link href={"?page=" + (current + 1) + "#saved-paths"}>Next</Link>}</nav>
      </>}
    </section>
  </section>;
}
