"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup, type SignupState } from "./actions";

const initialState: SignupState = {
  status: "idle",
  message: "",
};

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(
    signup,
    initialState,
  );

  return (
    <main className="flex min-h-dvh items-center justify-center bg-stone-50 px-6 py-12 text-slate-950">
      <section className="w-full max-w-md">
        <Link href="/" className="font-semibold text-emerald-800">
          ← Lumina PH
        </Link>

        <h1 className="mt-10 text-3xl font-semibold tracking-tight">
          Your next chapter starts here.
        </h1>

        <p className="mt-3 text-slate-600">
          Create an account to save your materials and study at your pace.
        </p>

        <form
          action={formAction}
          aria-busy={pending}
          className="mt-8 space-y-5"
        >
          <div>
            <label htmlFor="email" className="text-sm font-medium">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              aria-describedby="password-help"
              required
              className={inputClass}
            />
            <p id="password-help" className="mt-2 text-sm text-slate-600">
              Use at least 8 characters.
            </p>
          </div>

          <p
            role="status"
            aria-live="polite"
            className={
              state.status === "error"
                ? "text-sm text-red-700"
                : "text-sm text-emerald-800"
            }
          >
            {state.message}
          </p>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-emerald-800 px-4 py-3 font-semibold text-white transition-colors hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Creating your account…" : "Create account"}
          </button>
        </form>
      </section>
    </main>
  );
}