import Link from "next/link";

export default function LessonNotFound() {
  return (
    <section className="space-y-4 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6">
      <h1 className="text-xl font-semibold">Lesson unavailable</h1>
      <p className="text-sm text-stone-600 dark:text-stone-300">
        This lesson may no longer exist, or you may no longer belong to its
        group.
      </p>
      <Link
        href="/study-tools/study-groups"
        className="inline-flex rounded-xl bg-emerald-800 px-4 py-3 text-sm font-medium text-white"
      >
        Back to my groups
      </Link>
    </section>
  );
}
