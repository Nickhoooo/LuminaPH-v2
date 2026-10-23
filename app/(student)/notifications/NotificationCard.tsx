"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  markNotificationsRead,
  respondToInvitation,
  type NotificationState,
} from "./actions";
import type {
  NotificationItem,
  ReceivedInvitation,
  InvitationStatus,
} from "./notification-types";

const initial: NotificationState = { status: "idle", message: "" };

export default function NotificationCard({
  notification,
  invitation,
  invitationError = false,
  compact = false,
  onUpdated,
  onNavigate,
}: {
  notification: NotificationItem;
  invitation?: ReceivedInvitation;
  invitationError?: boolean;
  compact?: boolean;
  onUpdated?: () => Promise<void>;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [markedRead, setMarkedRead] = useState(false);
  const [response, setResponse] = useState<InvitationStatus | null>(null);
  const [feedback, setFeedback] = useState(initial);
  const isRead = Boolean(notification.read_at) || markedRead;
  const isInvitation = notification.kind === "group_invite";
  const status = response ?? invitation?.status;
  const href =
    notification.href &&
    /^\/(library\/|study-tools\/study-groups\/|settings$)/.test(
      notification.href,
    )
      ? notification.href
      : null;

  async function openNotification(destination: string | null) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      if (!isRead) {
        const form = new FormData();
        form.set("id", notification.id);
        const result = await markNotificationsRead(initial, form);
        setFeedback(result);
        if (result.status !== "success") return;
        setMarkedRead(true);
        await onUpdated?.();
      }
      if (destination) {
        onNavigate?.();
        router.push(destination);
      }
    } catch {
      setFeedback({
        status: "error",
        message: "Could not mark this notification as read. Please retry.",
      });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function respond(decision: "accept" | "decline") {
    if (!invitation || status !== "pending" || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("invitationId", invitation.id);
      form.set("decision", decision);
      const result = await respondToInvitation(initial, form);
      setFeedback(result);
      if (result.invitationStatus) setResponse(result.invitationStatus);
      if (result.status === "success") setMarkedRead(true);
      // Refresh both the status and count; responding never navigates away.
      await onUpdated?.();
    } catch {
      setFeedback({
        status: "error",
        message:
          "Could not confirm your response. Refresh notifications before retrying.",
      });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <article
      aria-busy={busy}
      className={
        compact
          ? `px-5 py-4 ${isRead ? "" : "border-l-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30"}`
          : `rounded-2xl border bg-white p-5 dark:bg-stone-900 ${isRead ? "border-stone-200 dark:border-stone-700" : "border-emerald-500"}`
      }
    >
      <button
        type="button"
        disabled={busy}
        onClick={() => void openNotification(isInvitation ? null : href)}
        className="block w-full rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600 disabled:cursor-wait"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="break-words text-sm font-semibold">
            {notification.title}
          </span>
          {!isRead && (
            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">
              New
            </span>
          )}
        </span>
        <span
          className={`mt-2 block break-words leading-5 text-stone-600 dark:text-stone-300 ${compact ? "text-xs" : "text-sm"}`}
        >
          {notification.message}
        </span>
        <span className="mt-2 block text-xs text-emerald-800 dark:text-emerald-300">
          {!isInvitation && href
            ? "Open details"
            : isRead
              ? "Read"
              : "Mark as read"}
        </span>
      </button>

      {isInvitation &&
        (invitationError ? (
          <div className="mt-3 text-xs text-red-700 dark:text-red-300">
            <p role="alert">Could not load this invitation.</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (onUpdated) void onUpdated();
                else router.refresh();
              }}
              className="mt-2 underline"
            >
              Retry
            </button>
          </div>
        ) : status === "pending" ? (
          <div className="mt-3 flex gap-2" aria-label="Invitation actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => void respond("accept")}
              className="rounded-lg bg-emerald-800 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Saving…" : "Accept"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void respond("decline")}
              className="rounded-lg border border-stone-300 px-4 py-2 text-xs font-medium dark:border-stone-600 disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        ) : (
          <div className="mt-3 text-xs text-stone-600 dark:text-stone-300">
            <p>
              {status === "accepted"
                ? "Invitation accepted."
                : status === "declined"
                  ? "Invitation declined."
                  : "Invitation expired or no longer available."}
            </p>
            {status === "accepted" && invitation && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void openNotification(
                    `/study-tools/study-groups/${invitation.group_id}`,
                  )
                }
                className="mt-2 rounded-lg bg-emerald-800 px-3 py-2 font-semibold text-white disabled:opacity-50"
              >
                Open group
              </button>
            )}
          </div>
        ))}
      {!href &&
        !isInvitation &&
        (notification.kind === "group_update" ||
          notification.kind === "quiz_result") && (
          <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
            This material or group is no longer available.
          </p>
        )}
      {!compact && (
        <time
          dateTime={notification.created_at}
          className="mt-3 block text-xs text-stone-500 dark:text-stone-400"
        >
          {new Date(notification.created_at).toLocaleString("en-PH", {
            timeZone: "Asia/Manila",
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </time>
      )}
      {feedback.message && (
        <p
          role={feedback.status === "error" ? "alert" : "status"}
          className={`mt-3 text-xs ${feedback.status === "error" ? "text-red-700 dark:text-red-300" : "text-emerald-800 dark:text-emerald-300"}`}
        >
          {feedback.message}
        </p>
      )}
    </article>
  );
}
