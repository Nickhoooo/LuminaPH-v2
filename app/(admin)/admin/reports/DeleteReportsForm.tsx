"use client";

import { useActionState, type FormEvent } from "react";
import { deleteResolvedReports, type DeleteReportsState } from "./delete-actions";

const initialState: DeleteReportsState = { status: "idle", message: "" };

export default function DeleteReportsForm() {
  const [state, action, pending] = useActionState(deleteResolvedReports, initialState);

  function confirmDelete(event: FormEvent<HTMLFormElement>) {
    const selectedCount = new FormData(event.currentTarget).getAll("reportIds").length;
    if (selectedCount === 0) {
      event.preventDefault();
      return;
    }

    if (!window.confirm(`Permanently delete ${selectedCount} selected resolved report${selectedCount === 1 ? "" : "s"}? This also removes attached screenshots.`)) {
      event.preventDefault();
    }
  }

  return (
    <form
      id="delete-resolved-reports-form"
      action={action}
      onSubmit={confirmDelete}
      aria-busy={pending}
      className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900"
    >
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete selected resolved reports"}
      </button>
      <p className="text-sm text-stone-600 dark:text-stone-300">
        Select resolved reports below. New and in-review reports are protected.
      </p>
      {state.message && (
        <p role={state.status === "error" ? "alert" : "status"} className={`w-full text-sm ${state.status === "error" ? "text-red-700 dark:text-red-300" : "text-emerald-800 dark:text-emerald-300"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
