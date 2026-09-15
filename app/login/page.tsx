"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {
  status: "idle",
  message: "",
};

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    login,
    initialState,
  );

  return (
    <main className="flex min-h-dvh items-center justify-center bg-stone-50 px-6 py-12 text-slate-950">
      <section className="w-full max-w-md">
        <Link href="/" className="font-semibold text-emerald-800">
          ← Lumina PH
        </Link>

        <h1 className="mt-10 text-3xl font-semibold tracking-tight">
          Welcome back.
        </h1>

        <p className="mt-3 text-slate-600">
          Log in to return to your study space.
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
              autoComplete="current-password"
              required
              className={inputClass}
            />
          </div>

          <p
            role="status"
            aria-live="polite"
            className="text-sm text-red-700"
          >
            {state.message}
          </p>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-emerald-800 px-4 py-3 font-semibold text-white transition-colors hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          New to Lumina PH?{" "}
          <Link
            href="/signup"
            className="font-semibold text-emerald-800 underline underline-offset-4"
          >
            Create an account
          </Link>
        </p>
      </section>
    </main>
  );
}