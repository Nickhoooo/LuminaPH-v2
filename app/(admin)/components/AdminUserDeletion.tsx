"use client";

import { useRef, useState } from "react";
import { permanentlyDeleteAdminUser } from "../admin/users/delete-actions";

type AdminUserDeletionProps = {
  userId: string;
  email: string | null;
  userName: string;
  suspended: boolean;
  canDelete: boolean;
  savingDisabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onDeleted: () => void;
};

export default function AdminUserDeletion({
  userId,
  email,
  userName,
  suspended,
  canDelete,
  savingDisabled,
  onBusyChange,
  onDeleted,
}: AdminUserDeletionProps) {
  const [confirming, setConfirming] = useState(false);
  const [typedEmail, setTypedEmail] = useState("");
  const [reason, setReason] = useState("");
  const [requestId, setRequestId] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const inFlight = useRef(false);

  if (!suspended || !canDelete || !email) return null;

  function cancel() {
    if (saving) return;
    setConfirming(false);
    setTypedEmail("");
    setReason("");
    setRequestId("");
    setErrorMessage("");
  }

  async function removeAccount() {
    if (inFlight.current || typedEmail.trim().toLowerCase() !== email.toLowerCase()) {
      setErrorMessage("Enter the account email exactly to confirm.");
      return;
    }
    if (!requestId) {
      setRequestId(crypto.randomUUID());
      setErrorMessage("Review the confirmation and select delete again.");
      return;
    }
    inFlight.current = true;
    setSaving(true);
    onBusyChange(true);
    setErrorMessage("");
    try {
      const result = await permanentlyDeleteAdminUser({
        targetUserId: userId,
        reason,
        requestId,
      });
      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }
      onDeleted();
    } catch {
      setErrorMessage("Could not confirm the deletion. Review the account before retrying.");
    } finally {
      inFlight.current = false;
      setSaving(false);
      onBusyChange(false);
    }
  }

  return (
    <section className="space-y-3 border-t border-stone-200 pt-5 dark:border-stone-700">
      <div>
        <h3 className="text-sm font-semibold">Permanent deletion</h3>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
          Suspended account. Permanent deletion removes its sign-in and account data.
        </p>
      </div>
      {!confirming ? (
        <button
          type="button"
          disabled={savingDisabled}
          onClick={() => {
            setRequestId(crypto.randomUUID());
            setConfirming(true);
          }}
          className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
        >
          Permanently delete account
        </button>
      ) : (
        <div className="space-y-3 rounded-xl bg-stone-50 p-4 dark:bg-stone-800/60">
          <p className="text-sm leading-5 text-stone-700 dark:text-stone-200">
            This cannot be undone. Account: <span className="font-medium">{userName}</span>
          </p>
          <label className="block text-sm font-medium" htmlFor={`delete-email-${userId}`}>
            Type {email} to confirm
            <input
              id={`delete-email-${userId}`}
              value={typedEmail}
              onChange={(event) => setTypedEmail(event.target.value)}
              autoComplete="off"
              disabled={saving}
              className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900"
            />
          </label>
          <label className="block text-sm font-medium" htmlFor={`delete-reason-${userId}`}>
            Reason
            <textarea
              id={`delete-reason-${userId}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={1000}
              rows={2}
              disabled={saving}
              className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900"
            />
          </label>
          {errorMessage && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" disabled={saving} onClick={cancel} className="rounded-lg border border-stone-300 px-3 py-2 text-sm dark:border-stone-600">Cancel</button>
            <button
              type="button"
              disabled={saving || savingDisabled || typedEmail.trim().toLowerCase() !== email.toLowerCase() || reason.trim().length === 0}
              onClick={removeAccount}
              className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
            >
              {saving ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
