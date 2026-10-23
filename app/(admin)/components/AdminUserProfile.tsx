"use client";

import { useId, useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import type { AdminUser } from "@/lib/admin-users";
import AdminUserUsage from "./AdminUserUsage";
import AdminUserAllowanceForm from "./AdminUserAllowanceForm";
import AdminUserSuspension from "./AdminUserSuspension";
import AdminUserRole from "./AdminUserRole";
import {
  loadAdminUserUsage,
  type UsageResult,
} from "../admin/users/usage-actions";
import {
  loadAdminUserSuspension,
  type AccountSuspensionResult,
} from "../admin/users/suspension-actions";
import {
  loadAdminRole,
  type AdminRole,
  type AdminRoleResult,
} from "../admin/users/admin-role-actions";
const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

function formatDate(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  } else {
    return dateFormatter.format(date);
  }
}

export default function AdminUserProfile({ user }: { user: AdminUser }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [isAdmin, setIsAdmin] = useState(user.isAdmin);
  const nameLetters = Array.from(user.displayName.trim());
  let initial = "?";
  if (nameLetters.length > 0) {
    initial = nameLetters[0].toUpperCase();
  }

  let emailText = "No email";
  if (user.email !== null) {
    emailText = user.email;
  }

  let verificationText = "Unconfirmed";
  if (user.emailConfirmed) {
    verificationText = "Confirmed";
  }

  let accessText = "User";
  if (isAdmin) {
    accessText = "Administrator";
  }

  const details = [
    { label: "Email", value: emailText },
    {
      label: "Email verification",
      value: verificationText,
    },
    { label: "Access", value: accessText },
    { label: "Registered", value: formatDate(user.createdAt) },
    { label: "Last sign-in", value: formatDate(user.lastSignInAt) },
    { label: "Account ID", value: user.id },
  ];
  const [usageResult, setUsageResult] = useState<UsageResult | null>(null);
  const [suspensionResult, setSuspensionResult] =
    useState<AccountSuspensionResult | null>(null);
  const [roleResult, setRoleResult] = useState<AdminRoleResult | null>(null);
  const [usagePending, startUsageTransition] = useTransition();
  const [savingAllowance, setSavingAllowance] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  function refreshUsage() {
    if (usagePending) {
      return;
    }

    // Si React ang magse-set ng usagePending habang kinukuha ang data.
    startUsageTransition(async () => {
      try {
        const [usage, suspension, role] = await Promise.all([
          loadAdminUserUsage(user.id),
          loadAdminUserSuspension(user.id),
          loadAdminRole(user.id),
        ]);
        setUsageResult(usage);
        setSuspensionResult(suspension);
        setRoleResult(role);
      } catch {
        setUsageResult({
          success: false,
          message: "Could not load usage. Try again or sign in again.",
        });
        setSuspensionResult({
          success: false,
          message: "Could not load account status. Please try again.",
        });
        setRoleResult({
          success: false,
          message: "Could not load administrator access. Please try again.",
        });
      }
    });
  }

  function openProfile() {
    if (dialog.current !== null) {
      dialog.current.showModal();
    }
    refreshUsage();
  }

  function closeProfile() {
    if (dialog.current !== null) {
      dialog.current.close();
    }
  }

  function handleAllowanceSaved() {
    setSaveMessage("Allowance saved.");
    refreshUsage();
  }

  function handleSuspensionSaved(message: string) {
    setSaveMessage(message);
    refreshUsage();
  }

  function handleRoleSaved(role: AdminRole, message: string) {
    setIsAdmin(role === "admin" || role === "super_admin");
    setRoleResult((current) => {
      if (!current?.success) {
        return current;
      }
      return { ...current, role };
    });
    setSaveMessage(message);
  }

  // Ipakita lang ang form kung tapos na ang loading at valid ang response.
  let allowanceForm = null;
  if (!usagePending && usageResult !== null && usageResult.success) {
    const usage = usageResult.usage;
    allowanceForm = (
      <AdminUserAllowanceForm
        key={user.id + ":" + usage.checkedAt}
        userId={user.id}
        userName={user.displayName}
        currentMode={usage.mode}
        materialLimit={usage.materials.limit}
        tutorLimit={usage.tutor.limit}
        canEdit={usage.canEdit}
        editReason={usage.editReason}
        onBusyChange={setSavingAllowance}
        onSaved={handleAllowanceSaved}
      />
    );
  }

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={openProfile}
        className="flex items-center gap-3 rounded-xl text-left font-medium text-emerald-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600 dark:text-emerald-300"
      >
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100"
        >
          {initial}
        </span>
        <span className="break-words">{user.displayName}</span>
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onCancel={(event) => {
          if (savingAllowance) {
            event.preventDefault();
          }
        }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-3xl border border-stone-200 bg-white p-0 text-stone-900 shadow-2xl backdrop:bg-black/50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
      >
        <div className="flex items-center justify-between bg-emerald-800 px-6 py-5 text-white dark:bg-emerald-950">
          <p className="text-sm font-medium">User profile</p>
          <button
            type="button"
            autoFocus
            aria-label="Close user profile"
            disabled={savingAllowance}
            onClick={closeProfile}
            className="rounded-xl p-2 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-6 p-6 sm:p-8">
          <header className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="grid size-16 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-2xl font-semibold text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100"
            >
              {initial}
            </span>
            <div className="min-w-0">
              <h2 id={titleId} className="break-words text-2xl font-semibold">
                {user.displayName}
              </h2>
              <p
                id={descriptionId}
                className="mt-1 text-sm text-stone-500 dark:text-stone-400"
              >
                Basic account information
              </p>
            </div>
          </header>

          <dl className="grid gap-6 border-t border-stone-200 pt-6 sm:grid-cols-2 dark:border-stone-700">
            {details.map(({ label, value }) => (
              <div key={label} className="min-w-0">
                <dt className="text-sm text-stone-500 dark:text-stone-400">
                  {label}
                </dt>
                <dd className="mt-1 break-words text-sm font-medium">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <AdminUserUsage
            result={usageResult}
            pending={usagePending}
            refreshingDisabled={savingAllowance}
            onRefresh={refreshUsage}
          />

          <AdminUserSuspension
            userId={user.id}
            userName={user.displayName}
            result={suspensionResult}
            loading={usagePending}
            savingDisabled={savingAllowance}
            onBusyChange={setSavingAllowance}
            onSaved={handleSuspensionSaved}
            onRefresh={refreshUsage}
          />

          <AdminUserRole
            userId={user.id}
            userName={user.displayName}
            result={roleResult}
            loading={usagePending}
            savingDisabled={savingAllowance}
            onBusyChange={setSavingAllowance}
            onSaved={handleRoleSaved}
          />

          {saveMessage && (
            <p
              role="status"
              className="text-sm text-emerald-700 dark:text-emerald-300"
            >
              {saveMessage}
            </p>
          )}
          {allowanceForm}
        </div>
      </dialog>
    </>
  );
}
