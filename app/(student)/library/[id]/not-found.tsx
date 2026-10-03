import Link from "next/link";

export default function MaterialNotFound() {
  return (
    <section className="space-y-4 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6">
      <h2 className="text-xl font-semibold">Material not found</h2>
      <p className="text-sm text-stone-600 dark:text-stone-300">
        This saved material is unavailable in your Library.
      </p>
      <Link
        href="/library"
        className="inline-block text-sm font-medium text-emerald-800 dark:text-emerald-200 underline"
      >
        Back to Library
      </Link>
    </section>
  );
}
