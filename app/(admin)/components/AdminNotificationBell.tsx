"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, LoaderCircle, UserRoundPlus } from "lucide-react";
import { markAdminAlertsRead, type AdminAlerts } from "../admin/alert-actions";

const actionLabels: Record<string, string> = {
  ban_user: "Account suspended",
  unban_user: "Account restored",
  delete_user: "Account deleted",
  set_usage: "AI allowance changed",
  grant_admin: "Admin role granted",
  revoke_admin: "Admin role removed",
  update_report: "Report updated",
  delete_report: "Resolved report deleted",
};

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

export default function AdminNotificationBell({ initialUnreadCount }: { initialUnreadCount: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [alerts, setAlerts] = useState<AdminAlerts | null>(null);
  const [hasError, setHasError] = useState(false);

  async function toggleDropdown() {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    setIsOpen(true);
    setIsLoading(true);
    setHasError(false);
    const result = await markAdminAlertsRead();
    if (result) setAlerts(result);
    else setHasError(true);
    setIsLoading(false);
  }

  const unreadCount = alerts ? 0 : initialUnreadCount;
  let currentCount = initialUnreadCount;
  if (alerts) currentCount = alerts.unreadCount;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleDropdown}
        aria-label={unreadCount > 0 ? `Admin notifications, ${unreadCount} unread` : "Admin notifications"}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="relative grid size-10 place-items-center rounded-xl text-stone-700 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:text-stone-200 dark:hover:bg-stone-800"
      >
        <Bell size={20} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {unreadCount.toLocaleString("en-PH")}
          </span>
        )}
      </button>

      {isOpen && (
        <section
          aria-label="Admin notifications"
          className="absolute right-0 top-full z-50 mt-3 max-h-[min(75vh,34rem)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-4 text-stone-900 shadow-xl dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
        >
          <header className="flex items-center justify-between gap-3 border-b border-stone-200 pb-3 dark:border-stone-700">
            <div>
              <h2 className="font-semibold">Admin notifications</h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {currentCount.toLocaleString("en-PH")} new {currentCount === 1 ? "notification" : "notifications"}
              </p>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg px-2 py-1 text-sm text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800">Close</button>
          </header>

          {isLoading && <p className="flex items-center gap-2 py-6 text-sm text-stone-500"><LoaderCircle size={16} className="animate-spin" /> Loading notifications…</p>}
          {hasError && <p role="alert" className="py-5 text-sm text-red-700 dark:text-red-300">Could not load notifications. Close and try again.</p>}
          {alerts && alerts.users.length === 0 && alerts.activities.length === 0 && alerts.reports.length === 0 && (
            <p className="py-6 text-center text-sm text-stone-500 dark:text-stone-400">You are all caught up.</p>
          )}

          {alerts && alerts.users.length > 0 && (
            <div className="py-3">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400"><UserRoundPlus size={15} /> New users</h3>
              <ul className="space-y-2">
                {alerts.users.map((user) => (
                  <li key={user.id} className="rounded-xl bg-stone-50 p-3 text-sm dark:bg-stone-800">
                    <p className="font-medium">{user.displayName}</p>
                    <p className="break-all text-xs text-stone-500 dark:text-stone-400">{user.email ?? "No email"}</p>
                    <time dateTime={user.createdAt} className="mt-1 block text-[11px] text-stone-500 dark:text-stone-400">{dateFormatter.format(new Date(user.createdAt))}</time>
                  </li>
                ))}
              </ul>
              <Link href="/admin/users" onClick={() => setIsOpen(false)} className="mt-2 inline-block text-sm font-medium text-emerald-800 hover:underline dark:text-emerald-300">View users</Link>
            </div>
          )}

          {alerts && alerts.activities.length > 0 && (
            <div className="border-t border-stone-200 py-3 dark:border-stone-700">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">Admin activity</h3>
              <ul className="space-y-2">
                {alerts.activities.map((activity) => (
                  <li key={activity.id} className="rounded-xl bg-stone-50 p-3 text-sm dark:bg-stone-800">
                    <p className="font-medium">{actionLabels[activity.action] ?? activity.action}</p>
                    <p className="line-clamp-2 text-xs text-stone-500 dark:text-stone-400">{activity.reason}</p>
                    <time dateTime={activity.createdAt} className="mt-1 block text-[11px] text-stone-500 dark:text-stone-400">{dateFormatter.format(new Date(activity.createdAt))}</time>
                  </li>
                ))}
              </ul>
              <Link href="/admin/activity-log" onClick={() => setIsOpen(false)} className="mt-2 inline-block text-sm font-medium text-emerald-800 hover:underline dark:text-emerald-300">Open activity log</Link>
            </div>
          )}

          {alerts && alerts.reports.length > 0 && (
            <div className="border-t border-stone-200 py-3 dark:border-stone-700">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">New reports</h3>
              <ul className="space-y-2">
                {alerts.reports.map((report) => (
                  <li key={report.id} className="rounded-xl bg-stone-50 p-3 text-sm dark:bg-stone-800">
                    <p className="font-medium">{report.title}</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400">{report.category.replace("_", " ")}</p>
                    <time dateTime={report.createdAt} className="mt-1 block text-[11px] text-stone-500 dark:text-stone-400">{dateFormatter.format(new Date(report.createdAt))}</time>
                  </li>
                ))}
              </ul>
              <Link href="/admin/reports" onClick={() => setIsOpen(false)} className="mt-2 inline-block text-sm font-medium text-emerald-800 hover:underline dark:text-emerald-300">Review reports</Link>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
