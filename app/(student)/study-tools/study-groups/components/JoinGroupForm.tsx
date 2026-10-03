"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { joinStudyGroup, type StudyGroupState } from "../actions";

const initialState: StudyGroupState = {
  status: "idle",
  message: "",
};

export default function JoinGroupForm() {
  const [inviteCode, setInviteCode] = useState("");

  const [state, formAction, pending] = useActionState(
    joinStudyGroup,
    initialState,
  );

  if (state.status === "success" && state.groupId) {
    return (
      <section className="rounded-2xl bg-emerald-50 dark:bg-emerald-950 p-6">
        <p role="status" className="text-sm text-emerald-900 dark:text-emerald-200">
          {state.message}
        </p>

        <Link
          href={`/study-tools/study-groups/${state.groupId}`}
          className="mt-4 inline-flex rounded-xl bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-900"
        >
          Open group
        </Link>
      </section>
    );
  }

  return (
    <form
      action={formAction}
      aria-busy={pending}
      className="space-y-4 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6"
    >
      <div>
        <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-200">
          Join a study group
        </h2>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
          Enter the six-letter code shared by your group owner.
        </p>
      </div>

      <div>
        <label
          htmlFor="join-invite-code"
          className="block text-sm font-medium text-stone-800 dark:text-stone-200"
        >
          Invite code
        </label>

        <input
          id="join-invite-code"
          name="inviteCode"
          value={inviteCode}
          onChange={(event) => {
            setInviteCode(event.target.value.toUpperCase());
          }}
          required
          maxLength={6}
          pattern="[A-Za-z]{6}"
          title="Enter exactly six letters."
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          disabled={pending}
          aria-describedby="join-code-help"
          className="mt-2 w-full rounded-xl border border-stone-300 dark:border-stone-700 px-4 py-3 font-mono text-lg tracking-widest focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
        />

        <p id="join-code-help" className="mt-2 text-xs text-stone-500 dark:text-stone-400">
          Example: KTRWPA
        </p>
      </div>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-200">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-emerald-800 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Joining…" : "Join group"}
      </button>
    </form>
  );
}
