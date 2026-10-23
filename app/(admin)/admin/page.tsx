import { requireAdmin } from "@/lib/require-admin";
import { getAdminActivity } from "@/lib/admin-activity";
import Link from "next/link";

const metrics = [
  { key: "totalUsers", label: "Registered users" },
  { key: "totalStudyGroups", label: "Study groups" },
  { key: "totalMaterials", label: "Library materials" },
  { key: "materialAttempts24h", label: "Material attempts · 24h" },
  { key: "tutorAttempts24h", label: "Tutor attempts · 24h" },
] as const;

type MetricKey = (typeof metrics)[number]["key"];
type Overview = Record<MetricKey, number>;

function isOverview(value: unknown): value is Overview {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return metrics.every(({ key }) => {
    const count = record[key];

    return (
      typeof count === "number" &&
      Number.isSafeInteger(count) &&
      count >= 0
    );
  });
}

const numberFormatter = new Intl.NumberFormat("en-PH");

const actionDescriptions: Record<string, string> = {
  ban_user: "suspended",
  unban_user: "restored",
  delete_user: "deleted",
  set_usage: "changed the AI allowance for",
  grant_admin: "granted Admin access to",
  revoke_admin: "removed Admin access from",
  update_report: "updated a report from",
  delete_report: "deleted a resolved report from",
};

function timeAgo(value: string) {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000));
  if (elapsedMinutes < 1) return "just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} hr${elapsedHours === 1 ? "" : "s"} ago`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays} day${elapsedDays === 1 ? "" : "s"} ago`;
}

export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const [{ data, error }, activityPage] = await Promise.all([
    supabase.rpc("get_admin_overview"),
    getAdminActivity(1),
  ]);

  const overview = !error && isOverview(data) ? data : null;

  return (
    <section className="w-full space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Admin overview</h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
          Platform totals and recent AI activity.
        </p>
      </header>

      {overview ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {metrics.map(({ key, label }) => (
              <article
                key={key}
                className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-900"
              >
                <h2 className="text-sm font-medium text-stone-600 dark:text-stone-300">
                  {label}
                </h2>
                <p className="mt-4 text-3xl font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
                  {numberFormatter.format(overview[key])}
                </p>
              </article>
            ))}
          </div>

          <p className="text-sm leading-6 text-stone-500 dark:text-stone-400">
            AI attempts include developer testing and failed requests
            after an allowance was reserved. These counts do not
            represent successful generations or remaining model quota.
          </p>
        </>
      ) : (
        <div
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          Overview totals could not be loaded. Refresh to try again.
          If this continues, check that the admin overview migration
          was applied successfully.
        </div>
      )}

      <section className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-900 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
              Latest account and administrator changes.
            </p>
          </div>
          <Link
            href="/admin/activity-log"
            className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
          >
            View activity log
          </Link>
        </div>

        {!activityPage ? (
          <p role="status" className="text-sm text-stone-500 dark:text-stone-400">
            Recent activity is unavailable. Check that the admin activity migration has been applied.
          </p>
        ) : activityPage.items.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            No administrator actions have been recorded yet.
          </p>
        ) : (
          <ol className="divide-y divide-stone-200 dark:divide-stone-700">
            {activityPage.items.slice(0, 5).map((activity) => {
              const action = actionDescriptions[activity.action] ?? "updated";
              const target = activity.targetName
                ? ` ${activity.targetName}`
                : " an account";

              return (
                <li key={activity.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-sm leading-6">
                      <span className="font-semibold">{activity.actorName}</span>{" "}
                      {action}{target}.
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-stone-500 dark:text-stone-400">
                      Reason: {activity.reason}
                    </p>
                  </div>
                  <time
                    dateTime={activity.createdAt}
                    title={new Intl.DateTimeFormat("en-PH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Manila",
                    }).format(new Date(activity.createdAt))}
                    className="shrink-0 text-xs text-stone-500 dark:text-stone-400"
                  >
                    {timeAgo(activity.createdAt)}
                  </time>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </section>
  );
}
