"use client";

import { useActionState, useId, useRef } from "react";
import { Trash2 } from "lucide-react";
import { deleteLibraryMaterial, type StudySetState } from "./actions";

const initialState: StudySetState = { status: "idle", message: "" };

export default function DeleteMaterialForm({
  materialId,
  title,
  materialType,
}: {
  materialId: string;
  title: string;
  materialType: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, action, pending] = useActionState(
    deleteLibraryMaterial,
    initialState,
  );

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-label={`Delete ${title}`}
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-700 dark:text-red-200 hover:bg-red-50 dark:hover:bg-red-950"
      >
        <Trash2 size={16} aria-hidden="true" /> Delete
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl bg-white dark:bg-stone-900 p-6 text-stone-900 dark:text-stone-200 shadow-xl backdrop:bg-black/40"
      >
        <h2 id={titleId} className="break-words text-xl font-semibold">
          Delete “{title}”?
        </h2>
        <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-300">
          This permanently removes this material from your Library. This cannot
          be undone.
        </p>
        {materialType === "quiz" && (
          <p className="mt-3 text-sm text-red-700 dark:text-red-200">
            Its saved quiz attempts and scores will also be deleted.
          </p>
        )}
        {materialType === "study_guide" && (
          <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-300">
            Its AI Tutor conversation will also be deleted. If this is a
            learning-path lesson, the outline stays, but the lesson content and
            completion mark will reset.
          </p>
        )}
        {(materialType === "notes" || materialType === "study_guide") && (
          <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-300">
            Copies already shared with groups and other materials generated from
            this source will stay.
          </p>
        )}
        <form action={action} aria-busy={pending} className="mt-5 space-y-4">
          <input type="hidden" name="materialId" value={materialId} />
          <input type="hidden" name="confirmed" value="yes" />
          {state.status === "error" && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-200">
              {state.message}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              autoFocus
              disabled={pending}
              onClick={() => dialog.current?.close()}
              className="rounded-xl border border-stone-300 dark:border-stone-700 px-4 py-2 disabled:opacity-50"
            >
              Keep material
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-red-700 px-4 py-2 font-semibold text-white hover:bg-red-800 disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
