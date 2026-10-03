"use client";
import { useActionState, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { setLessonProgress, type LessonProgressState } from "./actions";

export default function LessonProgress({ pathId, lessonId, completed }: { pathId: string; lessonId: string; completed: boolean }) {
  const [retryValue, setRetryValue] = useState<boolean | null>(null);
  const [state, action, pending] = useActionState(async (previous: LessonProgressState, data: FormData): Promise<LessonProgressState> => {
    const intended = retryValue ?? !completed;
    setRetryValue(intended);
    data.set("completed", String(intended));
    try {
      const next = await setLessonProgress(previous, data);
      if (next.status === "success") setRetryValue(null);
      return next;
    } catch { return { status: "error", message: "Connection interrupted. Retry to confirm the same progress update." }; }
  }, { status: "idle", message: "" });
  return <form action={action} aria-busy={pending} className="mt-4 space-y-2">
    
    <input type="hidden" name="pathId" value={pathId} /><input type="hidden" name="lessonId" value={lessonId} />
    
    <button 
      disabled={pending} 
      className="inline-flex items-center  gap-2 rounded-lg border border-emerald-800/25 px-4 py-2.5 text-sm font-medium text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950 disabled:opacity-50">
        {completed ? <RotateCcw size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}{pending ? "Saving…" : retryValue !== null ? "Retry progress update" : completed ? "Mark incomplete" : "Mark as complete"}
    </button>

    <p role="status" 
      className={state.status === "error" ? "text-xs text-red-700 dark:text-red-200" : "text-xs text-emerald-800 dark:text-emerald-200"}>{state.message}
    </p>
  </form>;
}
