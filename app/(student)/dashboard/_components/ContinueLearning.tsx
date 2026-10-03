import Link from "next/link";
import { ArrowRight, BookOpen, Layers, FileText, ListChecks } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LearningPathSummary from "./LearningPathSummary";

export default async function ContinueLearning() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  // Counts cover all owned records; only the latest few rows are sent to the UI.
  const [materialsResult, attemptsResult, pathsResult] = await Promise.allSettled([
    supabase.from("study_sets").select("id, title, subject, material_type, created_at", { count: "exact" })
      .eq("user_id", user.id).order("created_at", { ascending: false }).order("id").limit(4),
    supabase.from("quiz_attempts").select("id, study_set_id, score, question_count, submitted_at, study_sets(title)", { count: "exact" })
      .eq("user_id", user.id).order("submitted_at", { ascending: false }).order("id").limit(3),
    supabase
      .from("learning_paths")
      .select("id, title, subject, learning_path_lessons(id, title, position, completed, study_set_id)", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .order("id")
      .limit(3),
  ]);
  const paths = pathsResult.status === "fulfilled" && !pathsResult.value.error
    ? pathsResult.value
    : null;
  const materials = materialsResult.status === "fulfilled" && !materialsResult.value.error ? materialsResult.value : null;
  const attempts = attemptsResult.status === "fulfilled" && !attemptsResult.value.error ? attemptsResult.value : null;
  const date = (value: string) => new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });
  return (
    <section className="mt-8 space-y-6" aria-labelledby="continue-title">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[#e6eadd] dark:border-stone-700 bg-white dark:bg-stone-900 p-5"><p className="text-sm text-stone-500 dark:text-stone-400">Saved materials</p><p className="mt-2 text-3xl font-semibold">{materials?.count ?? "—"}</p><p className="mt-2 text-xs text-stone-500 dark:text-stone-400">Notes, guides, flashcard decks, and quizzes</p></div>
        <div className="rounded-xl border border-[#e6eadd] dark:border-stone-700 bg-white dark:bg-stone-900 p-5"><p className="text-sm text-stone-500 dark:text-stone-400">Completed quiz attempts</p><p className="mt-2 text-3xl font-semibold">{attempts?.count ?? "—"}</p><p className="mt-2 text-xs text-stone-500 dark:text-stone-400">Includes each saved retake</p></div>
      </div>
      <LearningPathSummary
        paths={paths?.data ?? null}
        totalCount={paths?.count ?? null}
      />
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2
          id="continue-title"
          className="text-lg font-semibold tracking-tight"
        >
          Recent materials
        </h2>
        <Link href="/library" className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200">View Library <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
      {!materials ? <p role="alert" className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5 text-sm">Could not load your materials. Refresh this page to try again.</p> : materials.data?.length ? <ul className="grid gap-4 sm:grid-cols-2">{materials.data.map(material => {
        let label = "Personal notes";
        let Icon = FileText;
        if (material.material_type === "study_guide") { label = "Study guide"; Icon = BookOpen; }
        if (material.material_type === "flashcards") { label = "Flashcard deck"; Icon = Layers; }
        if (material.material_type === "quiz") { label = "Practice quiz"; Icon = ListChecks; }
        return <li key={material.id}><Link href={"/library/" + material.id} className="flex h-full flex-col gap-3 rounded-xl border border-[#e6eadd] dark:border-stone-700 bg-white dark:bg-stone-900 p-5 transition-colors hover:border-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800">
          <span className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200"><Icon size={18} aria-hidden="true" />{label}</span>
          <h3 className="break-words font-semibold">{material.title}</h3>
          {material.subject && <p className="text-sm text-stone-500 dark:text-stone-400">{material.subject}</p>}
          <span className="mt-auto flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400"><time dateTime={material.created_at}>Saved {date(material.created_at)}</time><span className="inline-flex items-center gap-1 text-emerald-800 dark:text-emerald-200">Open <ArrowRight size={15} aria-hidden="true" /></span></span>
        </Link></li>;
      })}</ul> : <div className="flex flex-wrap items-center gap-5 rounded-xl border border-[#e6eadd] dark:border-stone-700 bg-white dark:bg-stone-900 p-6">
        <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-[#eff3e9] dark:bg-stone-800 text-[#779061] dark:text-stone-200">
          <BookOpen size={26} strokeWidth={1.5} />
        </span>
        <div className="min-w-40 flex-1">
          <h3 className="mb-2 text-sm font-semibold">
            Your first chapter starts here.
          </h3>
          <p className="max-w-md text-xs leading-6 text-stone-500 dark:text-stone-400">
            Create a study guide, then turn it into flashcards or a quiz. Your saved materials will appear here.
          </p>
        </div>
        <Link
          href="/study-tools/study-guides"
          className="inline-flex items-center gap-2 py-2 text-xs font-semibold text-[#537242] dark:text-stone-200 hover:text-[#224b2c] dark:hover:text-stone-200"
        >
          Create your first study guide <ArrowRight size={17} />
        </Link>
      </div>}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Latest quiz results</h2>
        {!attempts ? <p role="alert" className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5 text-sm">Could not load your quiz results. Refresh this page to try again.</p> : attempts.data?.length ? <ul className="space-y-3">{attempts.data.map(attempt => {
          const quiz = Array.isArray(attempt.study_sets) ? attempt.study_sets[0] : attempt.study_sets;
          return <li key={attempt.id}><Link href={"/library/" + attempt.study_set_id + "#quiz-attempts"} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#e6eadd] dark:border-stone-700 bg-white dark:bg-stone-900 p-5 hover:border-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800">
            <div className="min-w-0"><h3 className="break-words font-medium">{quiz?.title ?? "Saved quiz"}</h3><time dateTime={attempt.submitted_at} className="mt-1 block text-xs text-stone-500 dark:text-stone-400">{date(attempt.submitted_at)}</time></div>
            <div className="text-right"><p className="font-semibold text-emerald-800 dark:text-emerald-200">{attempt.score}/{attempt.question_count} ({Math.round(attempt.score / attempt.question_count * 100)}%)</p><p className="mt-1 text-xs text-stone-500 dark:text-stone-400">Review results →</p></div>
          </Link></li>;
        })}</ul> : <div className="rounded-xl border border-[#e6eadd] dark:border-stone-700 bg-white dark:bg-stone-900 p-5"><p className="text-sm text-stone-500 dark:text-stone-400">No completed quizzes yet. Your scores will appear after you submit a quiz.</p><Link href="/study-tools/quizzes" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-200">Start a quiz <ArrowRight size={16} aria-hidden="true" /></Link></div>}
        <p className="text-xs text-stone-500 dark:text-stone-400">Scores reflect submitted quiz attempts. Flashcard self-check marks are session-only.</p>
      </div>
    </section>
  );
}
