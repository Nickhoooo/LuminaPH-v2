import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";
import { getAdminReports, type ReportFilter } from "@/lib/admin-reports";
import ReportReviewForm from "../../components/ReportReviewForm";
import DeleteReportsForm from "./DeleteReportsForm";

type ReportsPageProps = { searchParams: Promise<{ page?: string | string[]; status?: string | string[] }> };
const categories: Record<string, string> = { bug: "Bug", ai_quality: "AI quality", account: "Account", group: "Study group", suggestion: "Suggestion", other: "Other" };
const dateFormatter = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });
const buttonStyle = "rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800";

export default async function AdminReportsPage({ searchParams }: ReportsPageProps) {
  const query = await searchParams;
  const rawPage = query.page ?? "1";
  const page = typeof rawPage === "string" && /^[1-9]\d*$/.test(rawPage) ? Number(rawPage) : 1;
  const requestedStatus = typeof query.status === "string" ? query.status : "all";
  const status: ReportFilter = requestedStatus === "new" || requestedStatus === "in_review" || requestedStatus === "resolved" ? requestedStatus : "all";
  const result = await getAdminReports(page, status);

  if (!result) return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold">Reports & Feedback</h1>
      <p role="alert" className="text-red-700 dark:text-red-300">Could not load submitted reports. Check that the reports migration was applied.</p>
      <Link href="/admin/reports" className={buttonStyle}>Try again</Link>
    </section>
  );

  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));
  if (page > totalPages) redirect(`/admin/reports?status=${status}&page=${totalPages}`);

  return (
    <section className="w-full space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Reports & Feedback</h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">Review concerns users chose to submit and send status updates or replies.</p>
      </header>
      <form action="/admin/reports" method="get" className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">Filter by status
          <select name="status" defaultValue={status} className="mt-2 block min-w-48 rounded-xl border border-stone-300 bg-white px-4 py-3 dark:border-stone-700 dark:bg-stone-900">
            <option value="all">All reports</option><option value="new">New</option><option value="in_review">In review</option><option value="resolved">Resolved</option>
          </select>
        </label>
        <button className="rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900">Apply</button>
      </form>

      <DeleteReportsForm />

      {result.items.length ? <ol className="space-y-4">
        {result.items.map((report) => (
          <li key={report.id} className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-900 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    name="reportIds"
                    value={report.id}
                    form="delete-resolved-reports-form"
                    disabled={report.status !== "resolved"}
                    className="size-4 accent-emerald-700 disabled:cursor-not-allowed"
                    aria-label={`Select resolved report: ${report.title}`}
                  />
                  <span>{report.status === "resolved" ? "Select for cleanup" : "Resolve this report before cleanup"}</span>
                </label>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">{categories[report.category] ?? "Other"} · {report.status.replace("_", " ")}</p>
                <h2 className="mt-1 text-lg font-semibold">{report.title}</h2>
                <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">From {report.userName}{report.userEmail ? ` · ${report.userEmail}` : ""}</p>
              </div>
              <time dateTime={report.createdAt} className="text-xs text-stone-500 dark:text-stone-400">{dateFormatter.format(new Date(report.createdAt))}</time>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{report.message}</p>
            {report.screenshotUrl && (
              <figure className="mt-4 rounded-xl border border-stone-200 p-3 dark:border-stone-700">
                <figcaption className="mb-2 text-xs font-semibold text-stone-600 dark:text-stone-300">Attached screenshot · preview only</figcaption>
                <Image
                  src={report.screenshotUrl}
                  alt={`Screenshot attached to ${report.title}`}
                  width={1200}
                  height={900}
                  unoptimized
                  draggable={false}
                  className="max-h-96 w-auto max-w-full rounded-lg object-contain"
                />
              </figure>
            )}
            {report.screenshotUnavailable && (
              <p role="status" className="mt-4 text-sm text-amber-800 dark:text-amber-200">The screenshot could not be loaded right now.</p>
            )}
            <ReportReviewForm key={`${report.id}:${report.updatedAt}`} reportId={report.id} status={report.status} response={report.adminResponse} />
          </li>
        ))}
      </ol> : <p className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400">No reports match this status.</p>}

      <nav aria-label="Reports pagination" className="flex items-center justify-between gap-4">
        <p className="text-sm text-stone-600 dark:text-stone-300">{result.totalCount.toLocaleString("en-PH")} reports · Page {page} of {totalPages}</p>
        <div className="flex gap-3">
          {page > 1 && <Link href={`/admin/reports?status=${status}&page=${page - 1}`} className={buttonStyle}>Previous</Link>}
          {page < totalPages && page < 50000 && <Link href={`/admin/reports?status=${status}&page=${page + 1}`} className={buttonStyle}>Next</Link>}
        </div>
      </nav>
    </section>
  );
}
