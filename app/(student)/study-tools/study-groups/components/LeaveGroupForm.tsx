"use client";

import { useActionState, useState } from "react";
import { leaveStudyGroup, type StudyGroupState } from "../actions";

const initialState: StudyGroupState = { status: "idle", message: "" };

export default function LeaveGroupForm({ groupId }: { groupId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(
    leaveStudyGroup,
    initialState,
  );

  return (
    <section className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6">
      <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-200">Group membership</h2>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 rounded-xl border border-red-200 dark:border-red-700 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-200 hover:bg-red-50 dark:hover:bg-red-950"
        >
          Leave group
        </button>
      ) : (
        <form
          action={formAction}
          aria-busy={pending}
          className="mt-4 space-y-4"
        >
          <input type="hidden" name="groupId" value={groupId} />
          <p className="text-sm leading-6 text-stone-600 dark:text-stone-300">
            Leave this group? You will lose access to its page. Your account and
            personal Library will stay unchanged.
          </p>
          {state.status === "error" && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-200">
              {state.message}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
            >
              {pending ? "Leaving…" : "Yes, leave group"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="rounded-xl border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-60"
            >
              Stay in group
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
