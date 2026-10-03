"use client";

import Link from "next/link";
import { useActionState } from "react";
import LogoutForm from "@/app/(student)/dashboard/LogoutForm";
import { resetPassword, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = { status: "idle", message: "" };

export default function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(
    resetPassword,
    initialState,
  );

  if (state.status === "success") {
    return (
      <div className="mt-6 space-y-5">
        <p role="status" className="landing-muted text-sm leading-6">
          {state.message}
        </p>
        <LogoutForm />
      </div>
    );
  }

  return (
    <form action={formAction} aria-busy={pending} className="auth-form">
      <div>
        <label htmlFor="new-password">New password</label>
        <input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          aria-describedby="new-password-help"
          className="auth-input"
        />
        <p id="new-password-help" className="auth-hint">
          Use at least 8 characters.
        </p>
      </div>
      <div>
        <label htmlFor="confirm-password">Confirm new password</label>
        <input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="auth-input"
        />
      </div>
      <p
        role="status"
        aria-live="polite"
        className="auth-status"
        data-error={state.status === "error"}
      >
        {state.message}
      </p>
      <button type="submit" disabled={pending} className="auth-submit">
        <span>{pending ? "Updating password…" : "Save new password"}</span>
        <span aria-hidden="true">↗</span>
      </button>
      <Link href="/forgot-password" className="auth-text-button text-center">
        Need a new reset link?
      </Link>
    </form>
  );
}
