"use client";

import Link from "next/link";
import { Bell, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getNotificationPreview } from "./actions";

export default function NotificationBell({
  unreadCount,
}: {
  unreadCount: number | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef({ version: 0, active: true });
  const [preview, setPreview] = useState<Awaited<
    ReturnType<typeof getNotificationPreview>
  > | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    const lifecycle = request.current;
    const version = ++lifecycle.version;
    setLoading(true);
    try {
      const result = await getNotificationPreview();
      if (lifecycle.active && version === lifecycle.version) setPreview(result);
    } catch {
      if (lifecycle.active && version === lifecycle.version)
        setPreview({ error: true, unread: 0, items: [] });
    } finally {
      if (lifecycle.active && version === lifecycle.version) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const lifecycle = request.current;
    lifecycle.active = true;
    // Poll only visible tabs, and refresh immediately when opening the bell.
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 60000);
    return () => {
      window.clearInterval(timer);
      lifecycle.active = false;
      lifecycle.version++;
    };
  }, [refresh]);
  const count = preview && !preview.error ? preview.unread : unreadCount;
  return (
    <>
      <button
        type="button"
        aria-label={`Notifications${count ? `, ${count} unread` : ""}`}
        onClick={() => {
          dialog.current?.showModal();
          void refresh();
        }}
        className="relative grid size-10 place-items-center rounded-lg text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
      >
        <Bell size={20} />
        {count !== null && count > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-emerald-800 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
      <dialog
        ref={dialog}
        aria-label="Notifications"
        className="fixed inset-0 m-auto max-h-[80dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl bg-white dark:bg-stone-900 p-5 text-stone-900 dark:text-stone-200 shadow-xl backdrop:bg-black/30"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Notifications</h2>
          <button
            type="button"
            aria-label="Close notifications"
            onClick={() => dialog.current?.close()}
            className="rounded-lg p-2 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <X size={20} />
          </button>
        </div>
        <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
          {count === null ? "Unread count unavailable" : `${count} unread`} ·
          Refreshes every minute while this tab is visible.
        </p>
        {loading && (
          <p
            role="status"
            className="mt-4 text-sm text-stone-500 dark:text-stone-400"
          >
            Checking for updates…
          </p>
        )}
        {preview?.error ? (
          <p
            role="alert"
            className="mt-4 text-sm text-red-700 dark:text-red-200"
          >
            Could not load notifications. Close and reopen to retry.
          </p>
        ) : preview && !preview.items.length ? (
          <p className="py-8 text-sm text-stone-500 dark:text-stone-400">
            No notifications yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-stone-100 dark:divide-stone-700">
            {preview?.items.map((item) => (
              <li key={item.id}>
                <Link
                  href="/notifications"
                  onClick={() => dialog.current?.close()}
                  className={`block rounded-lg px-2 py-4 hover:bg-stone-50 dark:hover:bg-stone-800 ${item.read_at ? "" : "border-l-2 border-emerald-500"}`}
                >
                  <span className="block text-sm font-semibold">
                    {item.title}
                  </span>
                  <span className="mt-1 block line-clamp-2 text-xs leading-5 text-stone-600 dark:text-stone-300">
                    {item.message}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/notifications"
          onClick={() => dialog.current?.close()}
          className="mt-4 block rounded-xl bg-emerald-800 px-4 py-3 text-center text-sm font-semibold text-white"
        >
          View all notifications
        </Link>
      </dialog>
    </>
  );
}
