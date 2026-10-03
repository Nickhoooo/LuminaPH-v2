"use client";

import { useActionState, useState } from "react";
import { removeStudyGroupMember, type StudyGroupState } from "../actions";

type RemoveMemberFormProps = {
  groupId: string;
  memberId: string;
  memberName: string;
};

const initialState: StudyGroupState = {
  status: "idle",
  message: "",
};

export default function RemoveMemberForm({
  groupId,
  memberId,
  memberName,
}: RemoveMemberFormProps) {
  const [confirming, setConfirming] = useState(false);

  const [state, formAction, pending] = useActionState(
    removeStudyGroupMember,
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
        aria-label={`Remove ${memberName} from this group`}
        className="rounded-lg border border-red-200 dark:border-red-700 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-200 hover:bg-red-50 dark:hover:bg-red-950"
      >
        Remove
      </button>
    );
  }

  return (
    <form
      action={formAction}
      aria-busy={pending}
      className="w-full space-y-3 rounded-xl border border-red-100 dark:border-red-700 bg-red-50 dark:bg-red-950 p-4"
    >
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="memberId" value={memberId} />

      <p className="break-words text-sm text-stone-800 dark:text-stone-200">
        Remove <strong>{memberName}</strong> from this group?
      </p>

      <p className="text-xs leading-5 text-stone-600 dark:text-stone-300">
        They will lose group access. Their account and personal Library will
        stay unchanged.
      </p>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-200">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
        >
          {pending ? "Removing…" : "Yes, remove"}
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
