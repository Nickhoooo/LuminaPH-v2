"use client";

import { useActionState } from "react";
import { markNotificationsRead, type NotificationState } from "./actions";

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
