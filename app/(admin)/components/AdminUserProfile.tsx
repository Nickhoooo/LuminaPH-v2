"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { AdminUser } from "@/lib/admin-users";
import AdminUserUsage from "./AdminUserUsage";
import AdminUserAllowanceForm from "./AdminUserAllowanceForm";
import AdminUserSuspension from "./AdminUserSuspension";
import AdminUserRole from "./AdminUserRole";
import AdminUserDeletion from "./AdminUserDeletion";
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
  const router = useRouter();
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
        onClick={(event) => {
          if (event.target === event.currentTarget && !savingAllowance) closeProfile();
        }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-stone-200 bg-white p-0 text-stone-900 shadow-2xl backdrop:bg-black/45 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white/95 px-5 py-3 backdrop-blur dark:border-stone-700 dark:bg-stone-900/95">
          <p className="text-sm font-medium text-stone-600 dark:text-stone-300">User profile</p>
          <button
            type="button"
            autoFocus
            aria-label="Close user profile"
            disabled={savingAllowance}
            onClick={closeProfile}
            className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <header className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-12 shrink-0 place-items-center rounded-full bg-emerald-100 text-lg font-semibold text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100"
            >
              {initial}
            </span>
            <div className="min-w-0">
              <h2 id={titleId} className="break-words text-xl font-semibold">
                {user.displayName}
              </h2>
              <p
                id={descriptionId}
                className="mt-0.5 break-all text-sm text-stone-500 dark:text-stone-400"
              >
                {emailText}
              </p>
            </div>
          </header>

          <dl className="grid gap-x-6 gap-y-4 border-y border-stone-200 py-4 sm:grid-cols-2 dark:border-stone-700">
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

          <AdminUserDeletion
            userId={user.id}
            email={user.email}
            userName={user.displayName}
            suspended={suspensionResult?.success === true && suspensionResult.suspension.suspended}
            canDelete={roleResult?.success === true && roleResult.canManageRoles}
            savingDisabled={savingAllowance}
            onBusyChange={setSavingAllowance}
            onDeleted={() => {
              closeProfile();
              router.refresh();
            }}
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
