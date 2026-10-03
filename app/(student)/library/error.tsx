"use client";

import Link from "next/link";

export default function LibraryError({ reset }: { reset: () => void }) {
  return (
    <section
      role="alert"
      className="space-y-4 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6"
    >
      <h2 className="text-xl font-semibold">We could not load your Library</h2>
      <p className="text-sm text-stone-600 dark:text-stone-300">
        Your materials may still be saved. Check your connection and try again;
        you do not need to generate them again.
      </p>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-emerald-800 px-4 py-2 text-sm text-white"
        >
          Try again
        </button>
        <Link
          href="/library"
          className="px-2 py-2 text-sm text-emerald-800 dark:text-emerald-200 underline"
        >
          Back to Library
        </Link>
      </div>
    </section>
  );
}
