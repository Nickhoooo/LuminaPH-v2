import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ReportForm from "./ReportForm";

const categoryNames: Record<string, string> = {
  bug: "Bug", ai_quality: "AI quality", account: "Account", group: "Study group", suggestion: "Suggestion", other: "Other",
};
const statusNames: Record<string, string> = { new: "Received", in_review: "In review", resolved: "Resolved" };
const dateFormatter = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });

export default async function FeedbackPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: reports, error } = await supabase
    .from("user_reports")
    .select("id, category, title, message, status, admin_response, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(25);

  return (
    <section className="w-full min-w-0 space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Reports & Feedback</h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">Tell us about a problem or suggest an improvement. You can check each report’s status here.</p>
      </header>

      <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <ReportForm requestId={randomUUID()} />
        <section className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-900 md:p-6">
          <h2 className="text-lg font-semibold">Your reports</h2>
          {error ? (
            <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">Could not load your report history. The report migration may still need to be applied.</p>
          ) : reports?.length ? (
            <ol className="mt-4 space-y-3">
              {reports.map((report) => (
                <li key={report.id} className="rounded-xl bg-stone-50 p-4 dark:bg-stone-800">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">{categoryNames[report.category] ?? "Other"}</p><h3 className="mt-1 font-semibold">{report.title}</h3></div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs dark:bg-stone-900">{statusNames[report.status] ?? report.status}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-stone-600 dark:text-stone-300">{report.message}</p>
                  {report.admin_response && <p className="mt-3 rounded-lg border-l-2 border-emerald-700 bg-white p-3 text-sm dark:bg-stone-900"><span className="font-semibold">Team response:</span> {report.admin_response}</p>}
                  <time dateTime={report.created_at} className="mt-3 block text-xs text-stone-500 dark:text-stone-400">Sent {dateFormatter.format(new Date(report.created_at))}</time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-stone-500 dark:text-stone-400">You have not sent any reports yet.</p>
          )}
        </section>
      </div>
    </section>
  );
}
