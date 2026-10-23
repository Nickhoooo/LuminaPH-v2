import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminActivity } from "@/lib/admin-activity";

type ActivityPageProps = {
  searchParams: Promise<{ page?: string | string[] }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

const actionLabels: Record<string, string> = {
  ban_user: "Suspended account",
  unban_user: "Restored account",
  delete_user: "Deleted account",
  set_usage: "Changed AI allowance",
  grant_admin: "Granted Admin role",
  revoke_admin: "Removed Admin role",
  update_report: "Updated user report",
};

const buttonStyle =
  "rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800";

export default async function AdminActivityLogPage({ searchParams }: ActivityPageProps) {
  const query = await searchParams;
  const rawPage = query.page ?? "1";
  const page = typeof rawPage === "string" && /^[1-9]\d*$/.test(rawPage)
    ? Number(rawPage)
    : 1;
  const result = await getAdminActivity(page);

  if (!result) {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold">Activity Log</h1>
        <p role="alert" className="text-red-700 dark:text-red-300">
          Could not load administrator activity. Check that the activity log migration was applied.
        </p>
        <Link href="/admin/activity-log" className={buttonStyle}>Try again</Link>
      </section>
    );
  }

  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));
  if (page > totalPages) redirect(`/admin/activity-log?page=${totalPages}`);

  return (
    <section className="w-full space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Activity Log</h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
          Review account-management changes made by administrators. Private learning content is not shown here.
        </p>
      </header>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900">
        {result.items.length ? (
          <ol className="divide-y divide-stone-200 dark:divide-stone-700">
            {result.items.map((item) => (
              <li key={item.id} className="grid gap-3 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{actionLabels[item.action] ?? item.action}</h2>
                    {item.targetName && <span className="text-sm text-stone-600 dark:text-stone-300">· {item.targetName}</span>}
                  </div>
                  <p className="text-sm text-stone-600 dark:text-stone-300">
                    By {item.actorName}{item.actorEmail ? ` (${item.actorEmail})` : ""}
                    {item.targetEmail ? ` · ${item.targetEmail}` : ""}
                  </p>
                  <p className="text-sm"><span className="font-medium">Reason:</span> {item.reason}</p>
                  {item.details && (
                    <details className="text-sm text-stone-600 dark:text-stone-300">
                      <summary className="w-fit cursor-pointer">Change details</summary>
                      <pre className="mt-2 overflow-x-auto rounded-xl bg-stone-50 p-3 text-xs dark:bg-stone-800">
                        {JSON.stringify(item.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
                <time dateTime={item.createdAt} className="text-xs text-stone-500 dark:text-stone-400">
                  {dateFormatter.format(new Date(item.createdAt))}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="p-8 text-center text-sm text-stone-500 dark:text-stone-400">No administrator actions have been recorded yet.</p>
        )}
      </div>

      <nav aria-label="Activity log pagination" className="flex items-center justify-between gap-4">
        <p className="text-sm text-stone-600 dark:text-stone-300">Page {page} of {totalPages}</p>
        <div className="flex gap-3">
          {page > 1 && <Link href={`/admin/activity-log?page=${page - 1}`} className={buttonStyle}>Previous</Link>}
          {page < totalPages && page < 50000 && <Link href={`/admin/activity-log?page=${page + 1}`} className={buttonStyle}>Next</Link>}
        </div>
      </nav>
    </section>
  );
}
