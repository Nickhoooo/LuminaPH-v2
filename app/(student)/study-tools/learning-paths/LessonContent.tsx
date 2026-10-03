"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BookOpen, LoaderCircle } from "lucide-react";
import { generateLessonContent, type LessonContentState } from "./lesson-actions";

type LessonContentProps = {
  pathId: string;
  lessonId: string;
  studySetId: string | null;
};

const initialState: LessonContentState = { status: "idle", message: "" };

export default function LessonContent({ pathId, lessonId, studySetId }: LessonContentProps) {
  const [state, action, pending] = useActionState(
    async (previous: LessonContentState, data: FormData): Promise<LessonContentState> => {
      try {
        return await generateLessonContent(previous, data);
      } catch {
        return {
          status: "error",
          message: "Connection interrupted. Refresh this path to check for a saved lesson before generating again.",
        };
      }
    },
    initialState,
  );

  const savedId = state.studySetId ?? studySetId;
  const buttonStyle = "inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 disabled:opacity-50";

  if (savedId) {
    return (
      <div className="mt-4 space-y-2">
        <Link href={"/library/" + savedId} className={buttonStyle}>
          <BookOpen size={17} aria-hidden="true" />
          Open lesson
        </Link>
        <p className="text-xs text-stone-500 dark:text-stone-400">Saved in Library. Reopening uses no AI attempt.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {!state.unsavedContent && (
        <form action={action} aria-busy={pending}>
          <input type="hidden" name="pathId" value={pathId} />
          <input type="hidden" name="lessonId" value={lessonId} />
          <button disabled={pending} className={buttonStyle}>
            {pending ? (
              <LoaderCircle size={17} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            ) : (
              <BookOpen size={17} aria-hidden="true" />
            )}
            {pending ? "Creating lesson…" : "Generate lesson"}
          </button>
          <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">Uses one generation attempt, then saves the lesson for later.</p>
        </form>
      )}
      <p role="status" className="text-sm text-red-700 dark:text-red-200">{state.message}</p>
      {state.unsavedContent && (
        <label className="block text-sm font-medium">
          Copy your lesson backup
          <textarea
            readOnly
            rows={10}
            value={state.unsavedContent}
            onFocus={event => event.target.select()}
            className="mt-2 w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 p-3 text-sm"
          />
        </label>
      )}
    </div>
  );
}
