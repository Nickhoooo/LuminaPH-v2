"use client";

import { useActionState, useState } from "react";
import { publishAnnouncement, type NotificationState } from "./actions";

export default function AnnouncementForm({ requestId }: { requestId: string }) {
  const [submissionId] = useState(requestId);
  const [confirmed, setConfirmed] = useState(false);
  const [state, action, pending] = useActionState(publishAnnouncement, {
    status: "idle",
    message: "",
  } as NotificationState);
  if (state.status === "success")
    return (
      <p
        role="status"
        className="rounded-xl bg-emerald-50 dark:bg-emerald-950 p-4 text-emerald-800 dark:text-emerald-200"
      >
        {state.message} Reload to compose another announcement.
      </p>
    );
  return (
    <details className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6">
      <summary className="cursor-pointer font-semibold">
        Admin: publish an announcement
      </summary>
      <form action={action} className="mt-4 space-y-4">
        <input type="hidden" name="requestId" value={submissionId} />
        <fieldset disabled={pending} className="space-y-4">
          <label className="block text-sm">
            Title
            <input
              name="title"
              required
              maxLength={160}
              className="mt-2 w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 p-3"
            />
          </label>
          <label className="block text-sm">
            Message
            <textarea
              name="message"
              required
              maxLength={2000}
              rows={4}
              className="mt-2 w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 p-3"
            />
          </label>
          <label className="flex gap-3 text-sm">
            <input
              type="checkbox"
              required
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />{" "}
            Send this announcement to all confirmed accounts with announcements
            enabled.
          </label>
        </fieldset>
        <button
          disabled={pending || !confirmed}
          className="rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Publishing…" : "Publish announcement"}
        </button>
        {state.message && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-200">
            {state.message}
          </p>
        )}
      </form>
    </details>
  );
}
