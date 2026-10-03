"use client";

import { useActionState, useState } from "react";
import {
  removeGroupMaterial,
  type MaterialShareState,
} from "../material-actions";

const initialState: MaterialShareState = { status: "idle", message: "" };

export default function RemoveSharedMaterialForm({
  groupId,
  materialId,
  title,
}: {
  groupId: string;
  materialId: string;
  title: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(
    async (
      previous: MaterialShareState,
      data: FormData,
    ): Promise<MaterialShareState> => {
      try {
        return await removeGroupMaterial(previous, data);
      } catch {
        return {
          status: "error",
          message:
            "Connection interrupted. Refresh the list to check whether this copy was removed.",
        };
      }
    },
    initialState,
  );

  if (state.status === "success") {
    return (
      <p role="status" className="text-sm text-emerald-800 dark:text-emerald-200">
        {state.message}
      </p>
    );
  }
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Remove shared copy of ${title}`}
        className="rounded-lg border border-red-200 dark:border-red-700 px-3 py-2 text-xs text-red-700 dark:text-red-200 hover:bg-red-50 dark:hover:bg-red-950"
      >
        Remove shared copy
      </button>
    );
  }
  return (
    <form
      action={action}
      aria-busy={pending}
      className="space-y-3 rounded-xl bg-red-50 dark:bg-red-950 p-4"
    >
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="materialId" value={materialId} />
      <p className="break-words text-sm">
        Remove “{title}” from this group? The original Library material stays
        unchanged.
      </p>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-200">
          {state.message}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          disabled={pending}
          className="rounded-lg bg-red-700 px-3 py-2 text-sm text-white disabled:opacity-60"
        >
          {pending ? "Removing…" : "Yes, remove copy"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
