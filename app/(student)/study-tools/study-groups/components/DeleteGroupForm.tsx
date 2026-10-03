"use client";

import { useActionState, useId, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteStudyGroup, type StudyGroupState } from "../actions";

const initialState: StudyGroupState = { status: "idle", message: "" };

export default function DeleteGroupForm({
  groupId,
  groupName,
}: {
  groupId: string;
  groupName: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const inputId = useId();
  const [confirmation, setConfirmation] = useState("");
  const [state, action, pending] = useActionState(
    deleteStudyGroup,
    initialState,
  );

  return (
    <section className="rounded-2xl border border-red-100 dark:border-red-700 bg-white dark:bg-stone-900 p-5">
      <h2 className="font-semibold text-stone-900 dark:text-stone-200">Manage group</h2>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        Only you, the owner, can permanently close this group.
      </p>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-700 px-4 py-2 text-sm font-semibold text-red-700 dark:text-red-200 hover:bg-red-50 dark:hover:bg-red-950"
      >
        <Trash2 size={16} /> Delete group
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white dark:bg-stone-900 p-6 text-stone-900 dark:text-stone-200 shadow-xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
      >
        <h2 id={titleId} className="text-xl font-semibold">
          Delete {groupName}?
        </h2>
        <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-300">
          All members will lose access. The group, shared materials, study track
          and everyone’s group progress will be permanently deleted. Personal
          Library originals will stay. This cannot be undone.
        </p>
        <form action={action} className="mt-5 space-y-4" aria-busy={pending}>
          <input type="hidden" name="groupId" value={groupId} />
          <label htmlFor={inputId} className="block text-sm">
            Type <strong className="break-words">{groupName}</strong> to
            confirm.
          </label>
          <input
            id={inputId}
            name="confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={pending}
            required
            maxLength={80}
            autoComplete="off"
            className="w-full rounded-xl border border-stone-300 dark:border-stone-700 px-3 py-2 focus:outline-emerald-700"
          />
          {state.status === "error" && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-200">
              {state.message}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => dialog.current?.close()}
              className="rounded-xl border border-stone-300 dark:border-stone-700 px-4 py-2 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || confirmation !== groupName}
              className="rounded-xl bg-red-700 px-4 py-2 font-semibold text-white hover:bg-red-800 disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
