"use client";

import { useActionState } from "react";
import { submitReport, type ReportState } from "./actions";

const initialState: ReportState = { status: "idle", message: "" };
const fieldStyle = "mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100";

export default function ReportForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(submitReport, initialState);

  return (
    <form action={action} aria-busy={pending} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-900 md:p-6">
      <input type="hidden" name="requestId" value={requestId} />
      <h2 className="text-lg font-semibold">Send feedback</h2>
      <p className="text-sm text-stone-600 dark:text-stone-300">Please do not include passwords or other sensitive information.</p>
      <fieldset disabled={pending || state.status === "success"} className="space-y-4">
      <label className="block text-sm font-medium">
        Category
        <select name="category" required className={fieldStyle} defaultValue="bug">
          <option value="bug">Bug or something is broken</option>
          <option value="ai_quality">AI answer or study material issue</option>
          <option value="account">Account or settings</option>
          <option value="group">Study group</option>
          <option value="suggestion">Suggestion</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="block text-sm font-medium">
        Short title
        <input name="title" required minLength={4} maxLength={120} className={fieldStyle} placeholder="What should we look at?" />
      </label>
      <label className="block text-sm font-medium">
        Details
        <textarea name="message" required minLength={10} maxLength={4000} rows={6} className={fieldStyle} placeholder="What happened, and what did you expect?" />
      </label>
      <label className="block text-sm font-medium">
        Screenshot (optional)
        <input
          name="screenshot"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className={`${fieldStyle} file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-emerald-900 dark:file:bg-emerald-950 dark:file:text-emerald-200`}
        />
        <span className="mt-1 block text-xs font-normal text-stone-500 dark:text-stone-400">JPG, PNG, or WebP · maximum 5 MB</span>
      </label>
      </fieldset>
      <button disabled={pending || state.status === "success"} className="rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-60">
        {pending ? "Sending…" : "Send feedback"}
      </button>
      {state.message && <p role={state.status === "error" ? "alert" : "status"} className={`text-sm ${state.status === "error" ? "text-red-700 dark:text-red-300" : "text-emerald-800 dark:text-emerald-300"}`}>{state.message}</p>}
      {state.status === "success" && <p className="text-xs text-stone-500 dark:text-stone-400">Refresh this page to send another report.</p>}
    </form>
  );
}
