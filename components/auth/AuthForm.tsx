"use client";

import { useActionState, useEffect, useRef } from "react";
import { login, type LoginState } from "@/app/login/actions";
import { signup, type SignupState } from "@/app/signup/actions";
import { requestPasswordReset, type ForgotPasswordState } from "@/app/forgot-password/actions";

export type AuthMode = "login" | "signup" | "recovery";
const loginInitial: LoginState = { status: "idle", message: "" };
const signupInitial: SignupState = { status: "idle", message: "" };
const recoveryInitial: ForgotPasswordState = { status: "idle", message: "" };

export default function AuthForm({ mode, onSwitch }: {
  mode: AuthMode;
  onSwitch: (mode: AuthMode) => void;
}) {
  const [loginState, loginAction, loginPending] = useActionState(login, loginInitial);
  const [signupState, signupAction, signupPending] = useActionState(signup, signupInitial);
  const [recoveryState, recoveryAction, recoveryPending] = useActionState(requestPasswordReset, recoveryInitial);
  const [state, action, pending] = mode === "login"
    ? [loginState, loginAction, loginPending] as const
    : mode === "signup"
      ? [signupState, signupAction, signupPending] as const
      : [recoveryState, recoveryAction, recoveryPending] as const;
  const isSignup = mode === "signup";
  const isRecovery = mode === "recovery";
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // Keep keyboard focus inside the dialog when replacing one form with another.
    heading.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="auth-content">
      <p className="auth-eyebrow">{isRecovery ? "A little help getting back" : "Your own space to learn"}</p>
      <h2 ref={heading} tabIndex={-1} id="auth-title" className="auth-title">
        {isSignup ? "Make room for curiosity." : isRecovery ? "Forgot your password?" : "Good to see you again."}
      </h2>
      <p id="auth-description" className="auth-description">
        {isSignup ? "Create your Lumina PH account. Start with a topic, go at your pace."
          : isRecovery ? "Enter your account email and request a reset link."
            : "Log in to return to your study space."}
      </p>
      <form action={action} aria-busy={pending} className="auth-form">
        {isSignup && (
          <div>
            <label htmlFor="auth-display-name">Display name</label>
            <input
              id="auth-display-name"
              name="full_name"
              autoComplete="nickname"
              required
              maxLength={80}
              aria-describedby="auth-display-name-help"
              className="auth-input"
            />
            <p id="auth-display-name-help" className="auth-hint">
              This name will appear to members of your study groups.
            </p>
          </div>
        )}
        <div>
          <label htmlFor="auth-email">Email address</label>
          <input id="auth-email" name="email" type="email" autoComplete="email"
            placeholder="you@example.com" required className="auth-input" />
        </div>
        {!isRecovery && (
          <div>
            <div className="auth-label-row">
              <label htmlFor="auth-password">Password</label>
              {!isSignup && <button type="button" className="auth-text-button" disabled={pending}
                onClick={() => onSwitch("recovery")}>Forgot password?</button>}
            </div>
            <input id="auth-password" name="password" type="password" required
              autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={isSignup ? 8 : undefined}
              aria-describedby={isSignup ? "auth-password-help" : undefined}
              className="auth-input" />
            {isSignup && <p id="auth-password-help" className="auth-hint">At least 8 characters. Make it yours.</p>}
          </div>
        )}
        <p role="status" aria-live="polite" className="auth-status" data-error={state.status === "error"}>
          {state.message}
        </p>
        <button type="submit" disabled={pending} className="auth-submit">
          <span>{pending ? "Please wait…" : isSignup ? "Create account" : isRecovery ? "Send reset link" : "Log in"}</span>
          <span aria-hidden="true">{pending ? "···" : "↗"}</span>
        </button>
        <div className="auth-switch-copy">
          {isSignup ? "Already have an account? " : isRecovery ? "Remember your password? " : "New here? "}
          <button type="button" className="auth-text-button" disabled={pending}
            onClick={() => onSwitch(isSignup || isRecovery ? "login" : "signup")}>
            {isSignup || isRecovery ? "Log in" : "Create an account"}
          </button>
        </div>
      </form>
    </div>
  );
}
