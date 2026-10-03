import Link from "next/link";
import LandingTheme from "@/components/landing/LandingTheme";
import { createClient } from "@/lib/supabase/server";
import ResetPasswordForm from "./ResetPasswordForm";

export default async function ResetPasswordPage({ searchParams }: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error: linkError } = await searchParams;
  let canReset = false;
  let message = linkError === "service"
    ? "We couldn't verify the link right now. Try opening your email link again shortly."
    : "This reset link is invalid, expired, or has already been used. Request a new one to continue.";

  if (!linkError) {
    try {
      const supabase = await createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      canReset = !error && !!user;
      if (!canReset) message = "Open the reset link from your email first. You can request a new link below.";
    } catch {
      message = "We couldn't check your session. Please refresh and try again shortly.";
    }
  }

  return (
    <LandingTheme>
      <main className="flex min-h-dvh items-center justify-center px-4 py-8">
        <section className="landing-card w-full max-w-md rounded-3xl p-6 shadow-sm sm:p-9">
          <Link href="/" className="landing-brand text-xl font-semibold">Lumina PH</Link>
          <p className="auth-eyebrow">Account recovery</p>
          <h1 className="auth-title">{canReset ? "A fresh password." : "Let's get you back in."}</h1>
          <p className="auth-description">
            {canReset ? "Choose a new password. After saving, you'll log in again with it." : message}
          </p>
          {canReset ? <ResetPasswordForm /> : (
            <div className="mt-7 space-y-4">
              <Link href="/forgot-password" className="auth-submit justify-center">Request a new reset link</Link>
              <Link href="/login" className="auth-text-button block text-center">Back to login</Link>
            </div>
          )}
        </section>
      </main>
    </LandingTheme>
  );
}
