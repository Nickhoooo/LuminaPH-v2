"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import {
  generateGroupQuiz,
  type GroupQuizGenerationState,
} from "../group-quiz-actions";

export default function GroupQuizGenerator({
  groupId,
  quizId,
}: {
  groupId: string;
  quizId: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (
      previous: GroupQuizGenerationState,
      form: FormData,
    ): Promise<GroupQuizGenerationState> => {
      try {
        const result = await generateGroupQuiz(previous, form);
        return result.status === "error" &&
          !result.unsavedQuestions &&
          previous.unsavedQuestions
          ? { ...result, unsavedQuestions: previous.unsavedQuestions }
          : result;
      } catch {
        return {
          ...previous,
          status: "error",
          message:
            "Connection interrupted. Check the saved quiz before retrying.",
        };
      }
    },
    { status: "idle", message: "" },
  );
  const button =
    "inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60";
  if (state.status === "success") {
    return (
      <div className="space-y-3">
        <p role="status">{state.message}</p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className={button}
        >
          Open saved quiz
        </button>
      </div>
    );
  }
  return (
    <form action={action} aria-busy={pending} className="space-y-4">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="quizId" value={quizId} />
      <input
        type="hidden"
        name="mode"
        value={state.unsavedQuestions ? "retry-save" : "generate"}
      />
      {state.unsavedQuestions ? (
        <label className="block text-sm font-medium">
          Unsaved quiz draft — keep a copy before leaving
          <textarea
            name="questions"
            readOnly
            value={JSON.stringify(state.unsavedQuestions)}
            rows={6}
            className="mt-2 w-full rounded-xl border border-stone-300 dark:border-stone-700 p-3 font-mono text-xs"
          />
        </label>
      ) : (
        <>
          <p className="text-sm leading-6 text-stone-600 dark:text-stone-300">
            Create one shared quiz from this saved lesson. Everyone will answer
            the same questions. Generation uses one study-tool attempt,
            including failed AI requests.
          </p>
          <label className="block text-sm font-medium">
            Questions
            <select
              name="questionCount"
              defaultValue="5"
              disabled={pending}
              className="ml-3 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 p-2"
            >
              <option value="5">5 questions</option>
              <option value="10">10 questions</option>
            </select>
          </label>
        </>
      )}
      <button disabled={pending} className={button}>
        {pending && (
          <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
        )}
        {pending
          ? "Please wait…"
          : state.unsavedQuestions
            ? "Retry saving quiz"
            : "Generate shared quiz"}
      </button>
      {state.message && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-200">
          {state.message}
        </p>
      )}
    </form>
  );
}
