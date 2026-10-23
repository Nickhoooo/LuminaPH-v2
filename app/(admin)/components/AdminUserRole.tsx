"use client";

import { useRef, useState } from "react";
import {
  saveAdminRole,
  type AdminRole,
  type AdminRoleResult,
} from "../admin/users/admin-role-actions";

type AdminUserRoleProps = {
  userId: string;
  userName: string;
  result: AdminRoleResult | null;
  loading: boolean;
  savingDisabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onSaved: (role: AdminRole, message: string) => void;
};

export default function AdminUserRole({
  userId,
  userName,
  result,
  loading,
  savingDisabled,
  onBusyChange,
  onSaved,
}: AdminUserRoleProps) {
  const [confirming, setConfirming] = useState(false);
  const [grantAdmin, setGrantAdmin] = useState(false);
  const [reason, setReason] = useState("");
  const [requestId, setRequestId] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const inFlight = useRef(false);

  function startAction(shouldGrant: boolean) {
    setGrantAdmin(shouldGrant);
    setReason("");
    setRequestId(crypto.randomUUID());
    setErrorMessage("");
    setConfirming(true);
  }

  function cancelAction() {
    if (saving) {
      return;
    }

    setConfirming(false);
    setReason("");
    setRequestId("");
    setErrorMessage("");
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
      const saved = await saveAdminRole({
        targetUserId: userId,
        grantAdmin,
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
        saved.role,
        saved.duplicate
          ? "This role change was already saved."
          : "Admin access updated.",
      );
    } catch {
      setErrorMessage("Could not confirm the change. Retry with the same request.");
    } finally {
      inFlight.current = false;
      setSaving(false);
      onBusyChange(false);
    }
  }

  const role = result?.success === true ? result.role : null;
  let status = "Could not load role.";
  if (loading) {
    status = "Loading role…";
  } else if (result?.success) {
    if (role === "super_admin") {
      status = "Super Admin (protected)";
    } else if (role === "admin") {
      status = "Admin";
    } else {
      status = "User";
    }
  } else if (result !== null) {
    status = result.message;
  }

  const canManage =
    !loading &&
    result?.success === true &&
    result.canManageRoles &&
    role !== "super_admin";

  return (
    <section className="space-y-4 rounded-2xl border border-stone-200 p-4 dark:border-stone-700">
      <div>
        <h3 className="text-sm font-semibold">Administrator role</h3>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
          Current role: <span className="font-semibold">{status}</span>
        </p>
        {result?.success && !result.canManageRoles && (
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            Only a Super Admin can change administrator roles.
          </p>
        )}
        {result?.success && role === "super_admin" && (
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            Super Admin access cannot be changed here.
          </p>
        )}
        {result?.success && role === "admin" && (
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            {userName} can manage the admin area with regular Admin access.
          </p>
        )}
      </div>

      {canManage && !confirming && (
        <button
          type="button"
          disabled={savingDisabled}
          onClick={() => startAction(role !== "admin")}
          className={
            role === "admin"
              ? "rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:hover:bg-stone-800"
              : "rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          }
        >
          {role === "admin" ? "Remove Admin access" : "Grant Admin access"}
        </button>
      )}

      {!loading && result !== null && !result.success && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {result.message}
        </p>
      )}

      {confirming && (
        <div className="space-y-3 rounded-xl bg-stone-50 p-4 dark:bg-stone-800/70">
          <h4 className="font-semibold">
            {grantAdmin ? "Grant regular Admin access?" : "Remove Admin access?"}
          </h4>
          <p className="text-sm leading-6 text-stone-600 dark:text-stone-300">
            {grantAdmin
              ? userName + " will be able to open the Admin area."
              : userName + " will lose access to the Admin area."}
            {" "}Super Admin access cannot be granted or removed here.
          </p>
          <label
            className="block text-sm font-medium"
            htmlFor={"admin-role-reason-" + userId}
          >
            Reason
            <textarea
              id={"admin-role-reason-" + userId}
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
              className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving
                ? "Saving…"
                : grantAdmin
                  ? "Confirm and grant"
                  : "Confirm and remove"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
