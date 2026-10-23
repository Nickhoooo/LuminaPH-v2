"use client";

import { useRef, useState } from "react";
import {
  saveAdminUserSuspension,
  type AccountSuspensionResult,
  type SuspensionDuration,
} from "../admin/users/suspension-actions";

type AdminUserSuspensionProps = {
  userId: string;
  userName: string;
  result: AccountSuspensionResult | null;
  loading: boolean;
  savingDisabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onSaved: (message: string) => void;
  onRefresh: () => void;
};

export default function AdminUserSuspension({
  userId,
  userName,
  result,
  loading,
  savingDisabled,
  onBusyChange,
  onSaved,
  onRefresh,
}: AdminUserSuspensionProps) {
  const [confirming, setConfirming] = useState(false);
  const [nextSuspended, setNextSuspended] = useState(false);
  const [duration, setDuration] = useState<SuspensionDuration>("3d");
  const [reason, setReason] = useState("");
  const [requestId, setRequestId] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const inFlight = useRef(false);

  function startAction(suspendAccount: boolean) {
    setNextSuspended(suspendAccount);
    setDuration("3d");
    setRequestId(crypto.randomUUID());
    setReason("");
    setErrorMessage("");
    setConfirming(true);
  }

  function cancelAction() {
    if (saving) {
      return;
    }
    setConfirming(false);
    setErrorMessage("");
    setRequestId("");
  }

  async function saveChange() {
    if (inFlight.current || !requestId) {
      return;
    }

    const cleanReason = reason.trim();
    if (cleanReason.length === 0 || Array.from(cleanReason).length > 1000) {
      setErrorMessage("Enter a reason between 1 and 1000 characters.");
      return;
    }

    inFlight.current = true;
    setSaving(true);
    onBusyChange(true);
    setErrorMessage("");

    try {
      const saved = await saveAdminUserSuspension({
        targetUserId: userId,
        suspended: nextSuspended,
        duration: nextSuspended ? duration : null,
        reason: cleanReason,
        requestId,
      });

      if (!saved.success) {
        setErrorMessage(saved.message);
        return;
      }

      setConfirming(false);
      setReason("");
      setRequestId("");
      onSaved(
        saved.duplicate
          ? "This account change was already saved."
          : nextSuspended
            ? "Account suspended " + formatDuration(duration) + "."
            : "Account access restored.",
      );
    } catch {
      setErrorMessage("Could not confirm the change. Retry with the same request.");
    } finally {
      inFlight.current = false;
      setSaving(false);
      onBusyChange(false);
    }
  }

  let statusMessage = "Account status could not be loaded.";
  if (loading) {
    statusMessage = "Loading account status…";
  } else if (result?.success) {
    if (result.suspension.suspended) {
      statusMessage = "Suspended";
    } else {
      statusMessage = "Active";
    }
  } else if (result !== null) {
    statusMessage = result.message;
  }

  const canShowActions = !loading && result?.success === true;
  const currentlySuspended =
    result?.success === true && result.suspension.suspended;

  return (
    <section className="space-y-4 rounded-2xl border border-stone-200 p-4 dark:border-stone-700">
      <div>
        <h3 className="text-sm font-semibold">Account access</h3>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
          Current status: <span className="font-semibold">{statusMessage}</span>
        </p>
        {result?.success && result.suspension.suspended && (
          <div className="mt-2 text-xs text-stone-500 dark:text-stone-400">
            <p>Reason: {result.suspension.reason}</p>
            {result.suspension.suspendedAt && (
              <p>Changed: {formatSuspensionDate(result.suspension.suspendedAt)}</p>
            )}
            <p>
              {result.suspension.suspendedUntil
                ? "Expires: " + formatSuspensionDate(result.suspension.suspendedUntil)
                : "Duration: permanent"}
            </p>
          </div>
        )}
        {result?.success && result.suspension.expired && (
          <div className="mt-2 text-xs text-stone-500 dark:text-stone-400">
            <p>Previous suspension expired automatically.</p>
            {result.suspension.reason && <p>Previous reason: {result.suspension.reason}</p>}
            {result.suspension.suspendedUntil && (
              <p>Expired: {formatSuspensionDate(result.suspension.suspendedUntil)}</p>
            )}
          </div>
        )}
      </div>

      {canShowActions && !confirming && (
        <button
          type="button"
          disabled={savingDisabled}
          onClick={() => startAction(!currentlySuspended)}
          className={
            currentlySuspended
              ? "rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:hover:bg-stone-800"
              : "rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
          }
        >
          {currentlySuspended ? "Restore account access" : "Suspend account"}
        </button>
      )}

      {!loading && result !== null && !result.success && (
        <button
          type="button"
          disabled={savingDisabled}
          onClick={onRefresh}
          className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:hover:bg-stone-800"
        >
          Retry status check
        </button>
      )}

      {confirming && (
        <div className="space-y-3 rounded-xl bg-stone-50 p-4 dark:bg-stone-800/70">
          <h4 className="font-semibold">
            {nextSuspended ? "Suspend this account?" : "Restore this account?"}
          </h4>
          <p className="text-sm leading-6 text-stone-600 dark:text-stone-300">
            {nextSuspended
              ? duration === "permanent"
                ? userName + " will lose access to LuminaPH until an Admin restores it."
                : userName + " will lose access to LuminaPH until the selected time expires."
              : userName + " will be able to use LuminaPH again."}
          </p>
          {nextSuspended && (
            <label className="block text-sm font-medium" htmlFor={"suspension-duration-" + userId}>
              Suspension length
              <select
                id={"suspension-duration-" + userId}
                value={duration}
                onChange={(event) => setDuration(event.target.value as SuspensionDuration)}
                disabled={saving}
                className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900"
              >
                <option value="1h">1 hour</option>
                <option value="6h">6 hours</option>
                <option value="12h">12 hours</option>
                <option value="1d">1 day</option>
                <option value="3d">3 days</option>
                <option value="7d">7 days</option>
                <option value="30d">30 days</option>
                <option value="permanent">Permanent</option>
              </select>
            </label>
          )}
          <label
            className="block text-sm font-medium"
            htmlFor={"suspension-reason-" + userId}
          >
            Reason
            <textarea
              id={"suspension-reason-" + userId}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={1000}
              rows={3}
              required
              disabled={saving}
              className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900"
            />
          </label>
          {errorMessage && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              {errorMessage}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={cancelAction}
              className="rounded-xl border border-stone-300 px-4 py-2 text-sm dark:border-stone-600 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || savingDisabled}
              onClick={saveChange}
              className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
            >
              {saving
                ? "Saving…"
                : nextSuspended
                  ? "Confirm suspension"
                  : "Confirm restore"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

const suspensionDateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

function formatSuspensionDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }
  return suspensionDateFormatter.format(date);
}

function formatDuration(value: SuspensionDuration) {
  if (value === "permanent") {
    return "permanently";
  }
  if (value === "1h") {
    return "for 1 hour";
  }
  if (value === "6h") {
    return "for 6 hours";
  }
  if (value === "12h") {
    return "for 12 hours";
  }
  if (value === "1d") {
    return "for 1 day";
  }
  if (value === "3d") {
    return "for 3 days";
  }
  if (value === "7d") {
    return "for 7 days";
  }
  return "for 30 days";
}
