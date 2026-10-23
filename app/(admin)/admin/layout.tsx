import type { ReactNode } from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import AdminNav from "../components/AdminNav";
import AdminBreadcrumb from "../components/AdminBreadcrumb";
import AdminNotificationBell from "../components/AdminNotificationBell";
import { requireAdmin } from "@/lib/require-admin";
import { defaultAppSettings } from "@/lib/app-settings";
import AppearanceProvider from "@/components/study/AppearanceProvider";
import LogoutForm from "@/app/(student)/dashboard/LogoutForm";


export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { supabase, user } = await requireAdmin();

  const { data: settings, error } = await supabase
    .from("user_settings")
    .select("theme, accent_color, reading_size, reduce_motion")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: alertData } = await supabase.rpc("get_admin_alerts", {
    p_mark_read: false,
  });
  let initialUnreadCount = 0;
  if (
    typeof alertData === "object" &&
    alertData !== null &&
    "unreadCount" in alertData &&
    typeof alertData.unreadCount === "number" &&
    Number.isSafeInteger(alertData.unreadCount) &&
    alertData.unreadCount >= 0
  ) {
    initialUnreadCount = alertData.unreadCount;
  }

  const metadataName = user.user_metadata?.full_name;

  const displayName =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim()
      : "Administrator";

  return (
    <AppearanceProvider settings={settings ?? defaultAppSettings}>
      <div className="min-h-dvh lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
        {/* LEFT: admin navigation */}
        <aside className="flex flex-col bg-emerald-800 p-5 text-white dark:bg-emerald-950 lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto">
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-xl px-2 py-3"
          >
            <GraduationCap size={34} aria-hidden="true" />

            <div>
              <p className="text-xl font-semibold">LuminaPH</p>
              <p className="mt-1 text-[10px] tracking-widest text-emerald-100">
                ADMIN CONSOLE
              </p>
            </div>
          </Link>

          <AdminNav />

          <div className="mt-auto border-t border-white/20 pt-4">
            <LogoutForm variant="admin-sidebar" />
          </div>
        </aside>

        {/* RIGHT: header and current admin page */}
        <div className="min-w-0">
          <header className="sticky top-0 z-30 flex min-h-18 items-center justify-between gap-4 border-b border-stone-200 bg-white px-5 py-4 dark:border-stone-800 dark:bg-stone-900 md:px-8">
            <AdminBreadcrumb />

            <div className="flex shrink-0 items-center gap-3">
              <AdminNotificationBell initialUnreadCount={initialUnreadCount} />
              <Link
                href="/admin/profile"
                aria-label="Open your admin profile"
                className="flex min-w-0 items-center gap-3 rounded-xl p-1"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-100 font-semibold text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">
                  {Array.from(displayName)[0]?.toUpperCase()}
                </span>

                <div className="hidden min-w-0 sm:block">
                  <p className="max-w-36 truncate text-sm font-semibold">
                    {displayName}
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Administrator
                  </p>
                </div>
              </Link>
            </div>
          </header>

          <main className="w-full min-w-0 space-y-6 p-4 md:p-6 xl:p-8">
            {error && (
              <p
                role="alert"
                className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
              >
                Your appearance settings could not be loaded.
                Showing the default theme.
              </p>
            )}

            {children}
          </main>
        </div>
      </div>
    </AppearanceProvider>
  );
}
