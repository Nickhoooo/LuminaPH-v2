"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import { regenerateStudyGroupInvite, type InviteCodeState } from "../actions";

type InviteCodeProps = {
  code: string;
  groupId: string;
};

const initialState: InviteCodeState = { status: "idle", message: "" };

export default function InviteCode({ code, groupId }: InviteCodeProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (
      previous: InviteCodeState,
      data: FormData,
    ): Promise<InviteCodeState> => {
      setCopyStatus("idle");
      try {
        const result = await regenerateStudyGroupInvite(previous, data);
        if (result.status === "success") {
          setConfirming(false);
        }
        return result;
      } catch {
        return {
          status: "error",
          message:
            "Connection interrupted. Reload to check the current invite code.",
          needsRefresh: true,
        };
      }
    },
    initialState,
  );
  const currentCode = state.inviteCode ?? code;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(currentCode);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <section className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6">
      <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-200">
        Invite classmates
      </h2>

      <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-300">
        Share this code with classmates you want to join your group. They need
        to log in before joining.
      </p>

      <label
        htmlFor="group-invite-code"
        className="mt-4 block text-sm font-medium text-stone-800 dark:text-stone-200"
      >
        Invite code
      </label>

      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input
          id="group-invite-code"
          value={state.needsRefresh ? "" : currentCode}
          disabled={pending || state.needsRefresh}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-4 py-3 font-mono text-sm"
        />

        <button
          type="button"
          onClick={copyCode}
          disabled={pending || state.needsRefresh}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-900"
        >
          {copyStatus === "copied" ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <Copy size={16} aria-hidden="true" />
          )}

          {copyStatus === "copied" ? "Copied!" : "Copy code"}
        </button>
      </div>

      <p role="status" className="mt-3 text-sm text-stone-600 dark:text-stone-300">
        {copyStatus === "copied" && "Invite code copied."}
        {copyStatus === "error" &&
          "Could not copy automatically. Select the code and copy it manually."}
      </p>

      <p
        role="status"
        className={
          state.status === "error"
            ? "mt-3 text-sm text-red-700 dark:text-red-200"
            : "mt-3 text-sm text-emerald-800 dark:text-emerald-200"
        }
      >
        {state.message}
      </p>

      {state.needsRefresh ? (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-xl border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm font-medium"
        >
          Reload current code
        </button>
      ) : confirming ? (
        <form
          action={formAction}
          aria-busy={pending}
          className="mt-5 space-y-3 rounded-xl bg-amber-50 dark:bg-amber-950 p-4"
        >
          <input type="hidden" name="groupId" value={groupId} />
          <p className="text-sm leading-6 text-stone-800 dark:text-stone-200">
            Replace this invite code? The old code will stop working. Existing
            members will stay in the group.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? "Changing…" : "Yes, change code"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-4 py-2 text-sm disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-5 rounded-xl border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800"
        >
          Change invite code
        </button>
      )}
    </section>
  );
}
