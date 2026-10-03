"use client";

import { useActionState, useId } from "react";
import { inviteMember, type InviteMemberState } from "../invitation-actions";

export default function InviteMemberForm({ groupId }: { groupId: string }) {
  const fieldId = useId();
  const [state, action, pending] = useActionState(inviteMember, {
    status: "idle",
    message: "",
  } as InviteMemberState);
  return (
    <form
      action={action}
      className="mt-5 space-y-3 border-t border-stone-200 dark:border-stone-700 pt-5"
      aria-busy={pending}
    >
      <input type="hidden" name="groupId" value={groupId} />
      <label htmlFor={fieldId} className="block text-sm font-semibold">
        Invite by account email
      </label>
      <p className="text-xs leading-5 text-stone-500 dark:text-stone-400">
        The recipient chooses Accept or Decline in LuminaPH. This does not send
        an email. The six-letter code above still lets people join directly.
      </p>
      <div className="flex flex-wrap gap-3">
        <input
          id={fieldId}
          type="email"
          name="email"
          required
          maxLength={254}
          disabled={pending}
          placeholder="classmate@example.com"
          className="min-w-0 flex-1 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm"
        />
        <button
          disabled={pending}
          className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send invitation"}
        </button>
      </div>
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`text-sm ${state.status === "error" ? "text-red-700 dark:text-red-200" : "text-emerald-800 dark:text-emerald-200"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
