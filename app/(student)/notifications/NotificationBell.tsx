"use client";

import Link from "next/link";
import { Bell, X, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { getNotificationPreview } from "./actions";
import NotificationCard from "./NotificationCard";

type NotificationPreview = Awaited<
  ReturnType<typeof getNotificationPreview>
> & {
  initialUnreadCount: number | null;
};

export default function NotificationBell({
  unreadCount,
}: {
  unreadCount: number | null;
}) {
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const request = useRef({ version: 0, active: true });
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<NotificationPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    const lifecycle = request.current;
    const version = ++lifecycle.version;
    setLoading(true);
    try {
      const result = await getNotificationPreview();
      if (lifecycle.active && version === lifecycle.version)
        setPreview({ ...result, initialUnreadCount: unreadCount });
    } catch {
      if (lifecycle.active && version === lifecycle.version)
        setPreview({
          error: true,
          unread: 0,
          items: [],
          invitations: [],
          invitationError: false,
          initialUnreadCount: unreadCount,
        });
    } finally {
      if (lifecycle.active && version === lifecycle.version) setLoading(false);
    }
  }, [unreadCount]);

  useEffect(() => {
    const lifecycle = request.current;
    lifecycle.active = true;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 60000);
    return () => {
      window.clearInterval(timer);
      lifecycle.active = false;
      lifecycle.version++;
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    function outside(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const count =
    preview && !preview.error && preview.initialUnreadCount === unreadCount
      ? preview.unread
      : unreadCount;
  return (
    <div
      ref={container}
      className="relative"
      onBlur={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget as Node)
        )
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={`Notifications${count ? `, ${count} unread` : ""}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen(!open);
          if (!open) void refresh();
        }}
        className="relative grid size-10 place-items-center rounded-xl text-emerald-50 hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white dark:hover:bg-emerald-900"
      >
        <Bell size={20} />
        {count !== null && count > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-white dark:bg-stone-800 dark:text-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-900">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
      {open && (
        <section
          id={panelId}
          aria-label="Notifications"
          className="fixed right-4 top-20 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-stone-200 bg-white text-stone-900 shadow-xl sm:absolute sm:right-0 sm:top-16 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
        >
          <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4 dark:border-stone-800">
            <div>
              <h2 className="font-semibold">Notifications</h2>
              <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                {count === null
                  ? "Unread count unavailable"
                  : `${count} unread`}
              </p>
            </div>
            <button
              ref={closeButton}
              type="button"
              aria-label="Close notifications"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
              className="rounded-lg p-2 hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              <X size={18} />
            </button>
          </div>
          <div
            className="max-h-[min(60dvh,28rem)] overflow-y-auto overscroll-contain"
            aria-busy={loading}
          >
            {loading && (
              <p
                role="status"
                className="px-5 py-3 text-xs text-stone-500 dark:text-stone-400"
              >
                Checking for updates…
              </p>
            )}
            {preview?.error ? (
              <div className="p-5">
                <p role="alert" className="text-sm">
                  Could not load notifications.
                </p>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  disabled={loading}
                  className="mt-3 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"
                >
                  <RefreshCw size={15} /> Retry
                </button>
              </div>
            ) : preview && !preview.items.length ? (
              <p className="px-5 py-8 text-sm text-stone-500 dark:text-stone-400">
                No notifications yet.
              </p>
            ) : (
              <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                {preview?.items.map((item) => (
                  <li key={item.id}>
                    <NotificationCard
                      notification={item}
                      compact
                      invitation={preview.invitations.find(
                        (invite) => invite.id === item.invitation_id,
                      )}
                      invitationError={preview.invitationError}
                      onUpdated={refresh}
                      onNavigate={() => setOpen(false)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-stone-100 px-5 py-4 text-center text-sm font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-stone-800 dark:text-emerald-300 dark:hover:bg-emerald-950"
          >
            View all notifications
          </Link>
        </section>
      )}
    </div>
  );
}
