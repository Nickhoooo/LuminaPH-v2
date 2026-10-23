"use client";

import { useActionState, useId, useRef } from "react";
import { LogOut } from "lucide-react";
import { logout, type LogoutState } from "./actions";

function clearTemporaryStorage(storage: Storage) {
  for (const key of Object.keys(storage)) {
    if (key.startsWith("lumina:") || key.startsWith("lumina-"))
      storage.removeItem(key);
  }
}

export default function LogoutForm({
  variant = "default",
}: {
  variant?: "default" | "sidebar" | "admin-sidebar";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, action, pending] = useActionState(
    async (): Promise<LogoutState> => {
      try {
        const result = await logout();
        if (!result.success) return result;
        // Supabase clears auth cookies on the server. Clear only our app's drafts here.
        try {
          clearTemporaryStorage(window.sessionStorage);
          clearTemporaryStorage(window.localStorage);
        } catch {
          /* Storage may be disabled; signing out still succeeds. */
        }
        try {
          const channel = new BroadcastChannel("lumina-session");
          channel.postMessage("signed-out");
          channel.close();
        } catch {
          /* A full navigation still clears this tab's in-memory state. */
        }
        window.location.replace("/login");
        return result;
      } catch {
        return { message: "Could not confirm logout. Please try again." };
      }
    },
    { message: "" },
  );

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={
          variant === "admin-sidebar"
            ? "flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-medium text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            : variant === "sidebar"
            ? "flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[13px] text-stone-500 hover:bg-stone-50 dark:text-stone-400 dark:hover:bg-stone-800"
            : "rounded-xl border border-emerald-700 px-4 py-3 text-sm font-semibold text-emerald-800 dark:text-emerald-200"
        }
      >
        {variant !== "default" && <LogOut size={19} aria-hidden="true" />} Log
        out
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-6 text-left text-stone-900 shadow-xl backdrop:bg-black/40 dark:bg-stone-900 dark:text-stone-100"
      >
        <h2 id={titleId} className="text-xl font-semibold">
          Log out of LuminaPH?
        </h2>
        <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-300">
          This ends your session in this browser and clears temporary drafts.
          Your saved materials and progress will stay in your account.
        </p>
        <form action={action} aria-busy={pending} className="mt-6 space-y-4">
          {state.message && (
            <p role="status" className="text-sm text-red-700 dark:text-red-300">
              {state.message}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              autoFocus
              disabled={pending}
              onClick={() => dialog.current?.close()}
              className="rounded-xl border border-stone-300 px-4 py-2.5 text-sm dark:border-stone-700 disabled:opacity-50"
            >
              Stay signed in
            </button>
            <button
              disabled={pending || state.success}
              className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Logging out…" : "Yes, log out"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
