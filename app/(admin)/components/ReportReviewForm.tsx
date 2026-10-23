"use client";

import { useActionState } from "react";
import { updateReport, type ReviewReportState } from "../admin/reports/actions";
import type { ReportStatus } from "@/lib/admin-reports";

const initialState: ReviewReportState = { status: "idle", message: "" };

export default function ReportReviewForm({ reportId, status, response }: { reportId: string; status: ReportStatus; response: string | null }) {
  const [state, action, pending] = useActionState(updateReport, initialState);

  return (
    <form action={action} aria-busy={pending} className="mt-4 grid gap-3 border-t border-stone-200 pt-4 dark:border-stone-700 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
      <input type="hidden" name="reportId" value={reportId} />
      <label className="block text-sm font-medium">
        Reply to user (optional)
        <textarea name="response" maxLength={2000} rows={2} defaultValue={response ?? ""} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-950" />
      </label>
      <label className="block text-sm font-medium">
        Status
        <select name="status" defaultValue={status} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-950">
          <option value="new">New</option>
          <option value="in_review">In review</option>
          <option value="resolved">Resolved</option>
        </select>
      </label>
      <button disabled={pending} className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">{pending ? "Saving…" : "Save review"}</button>
      {state.message && <p role={state.status === "error" ? "alert" : "status"} className={`text-sm sm:col-span-3 ${state.status === "error" ? "text-red-700 dark:text-red-300" : "text-emerald-800 dark:text-emerald-300"}`}>{state.message}</p>}
    </form>
  );
}
