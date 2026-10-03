import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  FileText,
  Layers,
  ListChecks,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import StudySetForm from "./StudySetForm";
import DeleteMaterialForm from "./DeleteMaterialForm";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[];
    deleted?: string | string[];
  }>;
}) {
  const query = await searchParams;
  let page = 1;
  if (typeof query.page === "string" && /^\d+$/.test(query.page)) {
    const requestedPage = Number(query.page);
    if (
      Number.isSafeInteger(requestedPage) &&
      requestedPage > 0 &&
      requestedPage <= 100000
    ) {
      page = requestedPage;
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const pageSize = 20;
  const {
    data: materials,
    error,
    count,
  } = await supabase
    .from("study_sets")
    .select("id, title, subject, material_type, created_at", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (error) throw new Error("Could not load saved materials.");
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  if (page > totalPages) redirect(`/library?page=${totalPages}`);

  return (
    <section className="space-y-7">
      {query.deleted === "1" && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 dark:bg-emerald-950 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200"
        >
          Material removed from your Library.
        </p>
      )}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-200">
            Your study materials
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Library</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-stone-500 dark:text-stone-400">
            Return to your saved guides, flashcard decks, quizzes, and personal
            notes. Reviewing saved materials does not use an AI generation
            attempt.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/study-tools/quizzes"
            className="rounded-lg border border-emerald-800 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950"
          >
            Create quiz
          </Link>
          <Link
            href="/study-tools/study-guides"
            className="rounded-lg bg-emerald-800 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-900"
          >
            Create study guide
          </Link>
          <Link
            href="/study-tools/flashcards"
            className="rounded-lg border border-emerald-800 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950"
          >
            Create flashcards
          </Link>
        </div>
      </header>

      <section aria-labelledby="saved-materials-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="saved-materials-heading" className="text-xl font-semibold">
            Saved materials
          </h2>
          <span className="text-sm text-stone-500 dark:text-stone-400">{count ?? 0} saved</span>
        </div>
        {materials && materials.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {materials.map((material) => {
              let label = "Personal notes";
              let Icon = FileText;
              if (material.material_type === "quiz") {
                label = "AI practice quiz";
                Icon = ListChecks;
              }
              if (material.material_type === "study_guide") {
                label = "AI study guide";
                Icon = BookOpen;
              }
              if (material.material_type === "flashcards") {
                label = "AI flashcard deck";
                Icon = Layers;
              }
              return (
                <article
                  key={material.id}
                  className="flex flex-col rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5"
                >
                  <Link
                    href={`/library/${material.id}`}
                    className="group flex flex-1 flex-col gap-4 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800"
                  >
                    <div className="flex items-center gap-2 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                      <Icon size={17} aria-hidden="true" />
                      {label}
                    </div>
                    <h3 className="break-words text-lg font-semibold text-stone-900 dark:text-stone-200">
                      {material.title}
                    </h3>
                    {material.subject && (
                      <p className="text-sm text-stone-600 dark:text-stone-300">
                        {material.subject}
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-between gap-3 text-xs text-stone-500 dark:text-stone-400">
                      <time dateTime={material.created_at}>
                        {new Date(material.created_at).toLocaleString("en-PH", {
                          timeZone: "Asia/Manila",
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </time>
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-800 dark:text-emerald-200">
                        Open <ArrowRight size={15} aria-hidden="true" />
                      </span>
                    </div>
                  </Link>
                  <div className="mt-4 flex justify-end border-t border-stone-100 dark:border-stone-700 pt-2">
                    <DeleteMaterialForm
                      materialId={material.id}
                      title={material.title}
                      materialType={material.material_type}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {(!materials || materials.length === 0) && (
          <div className="rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 p-8 text-center">
            <BookOpen
              className="mx-auto text-emerald-700 dark:text-emerald-200"
              size={30}
              aria-hidden="true"
            />
            <h3 className="mt-3 font-semibold">
              Your first saved material starts here
            </h3>
            <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
              Generate a study guide or flashcards, or add your own notes below.
            </p>
          </div>
        )}
        {totalPages > 1 && (
          <nav
            aria-label="Library pages"
            className="flex items-center justify-between gap-4 text-sm"
          >
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-4">
              {page > 1 && (
                <Link
                  className="text-emerald-800 dark:text-emerald-200 underline"
                  href={`/library?page=${page - 1}`}
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  className="text-emerald-800 dark:text-emerald-200 underline"
                  href={`/library?page=${page + 1}`}
                >
                  Next
                </Link>
              )}
            </div>
          </nav>
        )}
      </section>

      <details className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5">
        <summary className="cursor-pointer font-medium">
          Add personal notes
        </summary>
        <div className="mt-5">
          <StudySetForm />
        </div>
      </details>
    </section>
  );
}
