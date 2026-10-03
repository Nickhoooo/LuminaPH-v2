"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle } from "lucide-react";
import {
  generateGroupLesson,
  completeGroupLesson,
  type GroupLessonState,
} from "../group-lesson-actions";

export default function GroupLessonControls({
  groupId,
  lessonId,
  mode,
}: {
  groupId: string;
  lessonId: string;
  mode: "generate" | "complete";
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (
      previous: GroupLessonState,
      form: FormData,
    ): Promise<GroupLessonState> => {
      try {
        const result = await (
          mode === "generate" ? generateGroupLesson : completeGroupLesson
        )(previous, form);
        // Preserve the local draft even if a later retry fails before reaching the save.
        return result.status === "error" &&
          previous.unsavedContent &&
          !result.unsavedContent
          ? { ...result, unsavedContent: previous.unsavedContent }
          : result;
      } catch {
        return {
          ...previous,
          status: "error",
          message:
            "Connection interrupted. Check the saved lesson before retrying.",
        };
      }
    },
    { status: "idle", message: "" },
  );
  const buttonStyle =
    "inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-60";

  if (state.status === "success") {
    return (
      <div className="space-y-3">
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-200"
        >
          <Check size={16} aria-hidden="true" />
          {state.message}
        </p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className={buttonStyle}
        >
          Refresh lesson
        </button>
      </div>
    );
  }

  return (
    <form action={action} aria-busy={pending} className="space-y-4">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="lessonId" value={lessonId} />
      <input
        type="hidden"
        name="mode"
        value={state.unsavedContent ? "retry-save" : "generate"}
      />
      {state.unsavedContent && (
        <label className="block text-sm font-medium text-stone-800 dark:text-stone-200">
          Unsaved lesson draft — keep a copy before leaving
          <textarea
            name="content"
            readOnly
            value={state.unsavedContent}
            rows={8}
            className="mt-2 w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 p-4 font-mono text-xs"
          />
        </label>
      )}
      {mode === "generate" && !state.unsavedContent && (
        <p className="text-sm leading-6 text-stone-600 dark:text-stone-300">
          Generate this lesson once for everyone. This uses one of your
          study-tool generation attempts. Failed AI requests also count.
        </p>
      )}
      <button disabled={pending} className={buttonStyle}>
        {pending && (
          <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
        )}
        {pending
          ? "Please wait…"
          : mode === "complete"
            ? "Mark lesson complete"
            : state.unsavedContent
              ? "Retry saving lesson"
              : "Generate shared lesson"}
      </button>
      {state.message && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-200">
          {state.message}
        </p>
      )}
    </form>
  );
}
