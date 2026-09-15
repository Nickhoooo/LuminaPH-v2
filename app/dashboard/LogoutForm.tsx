"use client";

import { useActionState } from "react";
import { logout, type LogoutState } from "./actions";

const initialState: LogoutState = { message: "" };

export default function LogoutForm() {
  const [state, formAction, pending] = useActionState(logout, initialState);

  return (
    <form action={formAction} aria-busy={pending} className="text-right">
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-xl border border-emerald-800 px-4 py-2 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Logging out…" : "Log out"}
      </button>
      <p role="status" aria-live="polite" className="mt-2 max-w-xs text-sm text-red-700">
        {state.message}
      </p>
    </form>
  );
}
