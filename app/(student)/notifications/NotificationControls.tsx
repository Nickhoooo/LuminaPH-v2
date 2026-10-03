"use client";

import { useActionState } from "react";
import {
  markNotificationsRead,
  respondToInvitation,
  type NotificationState,
} from "./actions";

const initial: NotificationState = { status: "idle", message: "" };

export function MarkReadForm({ id = "all" }: { id?: string }) {
  const [state, action, pending] = useActionState(
    markNotificationsRead,
    initial,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <button
        disabled={pending}
        className="rounded-xl border border-stone-300 dark:border-stone-700 px-3 py-2 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-50"
      >
        {pending
          ? "Updating…"
          : id === "all"
            ? "Mark all as read"
            : "Mark as read"}
      </button>
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className="text-xs text-stone-600 dark:text-stone-300"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

export function InvitationResponse({ id }: { id: string }) {
  const [state, action, pending] = useActionState(respondToInvitation, initial);
  return (
    <form action={action} className="mt-4 space-y-3" aria-busy={pending}>
      <input type="hidden" name="invitationId" value={id} />
      <div className="flex gap-3">
        <button
          name="decision"
          value="accept"
          disabled={pending || state.status === "success"}
          className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Accept invitation"}
        </button>
        <button
          name="decision"
          value="decline"
          disabled={pending || state.status === "success"}
          className="rounded-xl border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm disabled:opacity-50"
        >
          Decline
        </button>
      </div>
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className="text-sm text-stone-600 dark:text-stone-300"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
