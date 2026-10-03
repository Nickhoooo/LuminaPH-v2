import Link from "next/link";
import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { defaultAppSettings } from "@/lib/app-settings";
import SettingsForm from "./SettingsForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");
  const { data, error } = await supabase
    .from("user_settings")
    .select(
      "theme, reading_size, reduce_motion, quiz_notifications, group_notifications, admin_notifications",
    )
    .eq("user_id", user.id)
    .maybeSingle();
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
          Manage your account security and app preferences.
        </p>
      </header>
      {error ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-200"
        >
          Could not load settings. Refresh to try again.
        </p>
      ) : (
        <SettingsForm
          settings={data ?? defaultAppSettings}
        />
      )}
      <section className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <KeyRound size={20} /> Password
        </h2>
        <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-300">
          Request a password reset link through the account recovery form.
        </p>
        <Link
          href="/forgot-password"
          className="mt-4 inline-flex rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-900"
        >
          Reset password
        </Link>
      </section>
    </section>
  );
}
