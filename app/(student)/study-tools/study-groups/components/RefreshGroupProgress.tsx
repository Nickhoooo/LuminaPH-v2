"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export default function RefreshGroupProgress() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      className="inline-flex items-center gap-2 rounded-xl border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-60"
    >
      <RefreshCw
        size={15}
        aria-hidden="true"
        className={pending ? "animate-spin" : ""}
      />
      {pending ? "Refreshing…" : "Refresh progress"}
    </button>
  );
}
