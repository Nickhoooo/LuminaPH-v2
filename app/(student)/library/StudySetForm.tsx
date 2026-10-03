"use client";

import { useActionState } from "react";
import { createStudySet, type StudySetState } from "./actions";

const initialState: StudySetState = {
  status: "idle",
  message: "",
};

export default function StudySetForm() {
  const [state, formAction, pending] = useActionState(
    createStudySet,
    initialState,
  );

  return (
    <form
      action={formAction}
      aria-busy={pending}
      className="space-y-5 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6"
    >
      <h2 className="text-xl font-semibold">Create a study set</h2>

      <div>
        <label htmlFor="title" className="block text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={120}
          placeholder="Introduction to Networking"
          className="mt-2 w-full rounded-lg border border-stone-300 dark:border-stone-700 px-4 py-3"
        />
      </div>

      <div>
        <label htmlFor="subject" className="block text-sm font-medium">
          Subject (optional)
        </label>
        <input
          id="subject"
          name="subject"
          type="text"
          maxLength={80}
          placeholder="Networking"
          className="mt-2 w-full rounded-lg border border-stone-300 dark:border-stone-700 px-4 py-3"
        />
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          required
          rows={6}
          maxLength={20000}
          placeholder="Type or paste the material you want to study."
          className="mt-2 w-full rounded-lg border border-stone-300 dark:border-stone-700 px-4 py-3"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-800 px-5 py-3 font-medium text-white disabled:cursor-wait disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save study set"}
      </button>

      <p role="status" aria-live="polite" className="text-sm">
        {state.message}
      </p>
    </form>
  );
}
