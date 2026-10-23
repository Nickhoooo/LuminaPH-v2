"use client";

import { useId, useRef, useState } from "react";
import {
  saveAdminUserAllowance,
  type AllowanceMode,
} from "../admin/users/usage-actions";

type Props = {
  userId: string;
  userName: string;
  currentMode: AllowanceMode;
  materialLimit: number | null;
  tutorLimit: number | null;
  canEdit: boolean;
  editReason: string | null;
  onBusyChange: (busy: boolean) => void;
  onSaved: () => void;
};

// Tinitingnan kung buong numero na 1 hanggang 1000 ang tinype
function parseLimit(text: string): number | null {
  const value = Number(text);

  if (!Number.isInteger(value)) {
    return null;
  }
  if (value < 1) {
    return null;
  }
  if (value > 1000) {
    return null;
  }
  return value;
}

function limitToText(limit: number | null, defaultLimit: number) {
  if (limit === null) {
    return String(defaultLimit);
  } else {
    return String(limit);
  }
}

export default function AdminUserAllowanceForm({
  userId,
  userName,
  currentMode,
  materialLimit,
  tutorLimit,
  canEdit,
  editReason,
  onBusyChange,
  onSaved,
}: Props) {
  // Mga laman ng form
  const [mode, setMode] = useState<AllowanceMode>(currentMode);
  const [materialText, setMaterialText] = useState(
    limitToText(materialLimit, 5),
  );
  const [tutorText, setTutorText] = useState(limitToText(tutorLimit, 20));
  const [reason, setReason] = useState("");

  // "edit" = nagta-type pa, "confirm" = nagko-confirm na
  const [step, setStep] = useState<"edit" | "confirm">("edit");

  // Isang bagong ID kada bubuksan ang confirm. Kapag nag-retry, pareho ang ID.
  const [requestId, setRequestId] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const modeGroup = useId();
  const inFlight = useRef(false);

  // Kapag hindi pwedeng mag-edit, ito lang ang ipakita
  if (!canEdit) {
    let readOnlyMessage = "This account's allowance cannot be changed here.";
    if (editReason !== null) {
      readOnlyMessage = editReason;
    }
    return (
      <p className="rounded-xl border border-zinc-200 p-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        {readOnlyMessage}
      </p>
    );
  }

  // Pindot sa "Review change": i-check ang form, tapos pumunta sa confirm
  function handleReview() {
    setError("");
    setSuccess("");

    if (mode === "custom") {
      if (parseLimit(materialText) === null || parseLimit(tutorText) === null) {
        setError("Custom limits must be whole numbers from 1 to 1000.");
        return;
      }
    }

    if (reason.trim().length === 0) {
      setError("Please enter a reason.");
      return;
    }

    if (Array.from(reason.trim()).length > 1000) {
      setError("The reason is too long (max 1000).");
      return;
    }

    setRequestId(crypto.randomUUID());
    setStep("confirm");
  }

  // Pindot sa "Confirm and save": ipadala sa server
  async function handleConfirm() {
    // Ang ref ay agad nagbabago para maiwasan ang dobleng save sa mabilis na click.
    if (inFlight.current || !requestId) {
      return;
    }
    inFlight.current = true;
    onBusyChange(true);
    setError("");
    setSaving(true);

    let materialLimit: number | null = null;
    let tutorLimit: number | null = null;

    if (mode === "custom") {
      materialLimit = parseLimit(materialText);
      tutorLimit = parseLimit(tutorText);
    }

    try {
      const result = await saveAdminUserAllowance({
        targetUserId: userId,
        mode: mode,
        materialLimit: materialLimit,
        tutorLimit: tutorLimit,
        reason: reason,
        requestId: requestId,
      });

      if (!result.success) {
        // Nasa confirm pa rin tayo, para pwedeng mag-retry gamit ang parehong ID
        setError(result.message);
        return;
      }

      if (result.duplicate) {
        setSuccess("This change was already saved.");
      } else {
        setSuccess("Allowance saved.");
      }

      setReason("");
      setRequestId("");
      setStep("edit");
      onSaved();
    } catch {
      setError(
        "Could not confirm the save. Retry with the same request, or refresh usage to check.",
      );
    } finally {
      // Laging alisin ang busy state, successful man o failed ang request.
      inFlight.current = false;
      setSaving(false);
      onBusyChange(false);
    }
  }

  // Bumalik sa pag-edit
  function handleBack() {
    setError("");
    setStep("edit");
  }

  const isEditing = step === "edit";
  let saveButtonText = "Confirm and save";
  if (saving) {
    saveButtonText = "Saving...";
  }

  let confirmationDetails = "";
  if (mode === "custom") {
    confirmationDetails =
      " (" + materialText + " materials, " + tutorText + " tutor messages)";
  }

  return (
    <section
      aria-busy={saving}
      className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700"
    >
      <h3 className="text-sm font-semibold">Usage allowance</h3>

      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Setting for {userName}, per rolling 24 hours. Existing attempts stay in
        the count. Unlimited removes the personal cap; cooldowns and shared app
        and provider limits still apply.
      </p>

      {/* Pagpili ng mode */}
      <div className="mt-3 space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={modeGroup}
            checked={mode === "default"}
            disabled={!isEditing}
            onChange={() => setMode("default")}
          />
          Default limits
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={modeGroup}
            checked={mode === "custom"}
            disabled={!isEditing}
            onChange={() => setMode("custom")}
          />
          Custom limits
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={modeGroup}
            checked={mode === "unlimited"}
            disabled={!isEditing}
            onChange={() => setMode("unlimited")}
          />
          Unlimited
        </label>
      </div>

      {/* Mga limit: lalabas lang kapag custom */}
      {mode === "custom" && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Study material generations
            <input
              type="number"
              min={1}
              max={1000}
              value={materialText}
              disabled={!isEditing}
              onChange={(e) => setMaterialText(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-600"
            />
          </label>

          <label className="text-sm">
            Tutor messages
            <input
              type="number"
              min={1}
              max={1000}
              value={tutorText}
              disabled={!isEditing}
              onChange={(e) => setTutorText(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-600"
            />
          </label>
        </div>
      )}

      {/* Reason */}
      <label className="mt-3 block text-sm">
        Reason (saved in the activity log)
        <textarea
          rows={2}
          maxLength={1000}
          value={reason}
          disabled={!isEditing}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-600"
        />
      </label>

      {/* Mga mensahe */}
      {error !== "" && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {success !== "" && (
        <p
          role="status"
          className="mt-3 text-sm text-emerald-600 dark:text-emerald-400"
        >
          {success}
        </p>
      )}

      {/* Mga button */}
      {isEditing && (
        <button
          type="button"
          onClick={handleReview}
          className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Review change
        </button>
      )}

      {!isEditing && (
        <div className="mt-3 rounded-xl bg-zinc-100 p-3 dark:bg-zinc-800">
          <p className="text-sm">
            Change {userName} to <strong>{mode}</strong>
            {confirmationDetails}?
          </p>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saveButtonText}
            </button>

            <button
              type="button"
              onClick={handleBack}
              disabled={saving}
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
