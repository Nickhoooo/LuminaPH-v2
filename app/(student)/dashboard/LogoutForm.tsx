"use client";

import { useActionState } from "react";
import { LogOut } from "lucide-react";
import { logout, type LogoutState } from "./actions";

const initialState: LogoutState = { message: "" };

export default function LogoutForm({
  variant = "default",
}: {
  variant?: "default" | "sidebar";
}) {
  const [state, formAction, pending] = useActionState(logout, initialState);

  return (
    <form
      action={formAction}
      aria-busy={pending}
      className={variant === "sidebar" ? "text-left" : "text-right"}
    >
      <button
        type="submit"
        disabled={pending}
        className={
          variant === "sidebar"
            ? "flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-[13px] text-stone-500 dark:text-stone-400 transition-colors hover:bg-stone-50 dark:hover:bg-stone-800 disabled:cursor-wait disabled:opacity-60"
            : "min-h-11 rounded-xl border border-emerald-800 px-4 py-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 disabled:cursor-wait disabled:opacity-60"
        }
      >
        {variant === "sidebar" && <LogOut size={19} aria-hidden="true" />}
        {pending ? "Logging out…" : "Log out"}
      </button>
      <p
        role="status"
        aria-live="polite"
        className="mt-2 max-w-xs text-sm text-red-700 dark:text-red-200"
      >
        {state.message}
      </p>
    </form>
  );
}
