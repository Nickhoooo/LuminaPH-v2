import Link from "next/link";

export default function SharedMaterialNotFound() {
  return (
    <section className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6">
      <h1 className="text-2xl font-semibold">Shared material unavailable</h1>
      <p className="text-sm leading-6 text-stone-600 dark:text-stone-300">
        This copy may have been removed, or you may no longer be a member of its
        group.
      </p>
      <Link
        href="/study-tools/study-groups"
        className="inline-flex rounded-xl bg-emerald-800 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-900"
      >
        Back to Study Groups
      </Link>
    </section>
  );
}
