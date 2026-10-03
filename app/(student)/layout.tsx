import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "./_components/Sidebar";
import DashboardHeader from "./_components/DashboardHeader";
import StudyPreferencesProvider from "@/components/study/StudyPreferencesProvider";
import { readStudyPreferences } from "@/lib/study-preferences";
import { defaultAppSettings } from "@/lib/app-settings";

// Next.js wraps every page inside (student) with this layout.
export default async function StudentLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const [settingsResult, notificationResult] = await Promise.all([
    supabase
      .from("user_settings")
      .select("theme, reading_size, reduce_motion")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null),
  ]);
  const settings = settingsResult.data ?? defaultAppSettings;

  // RLS returns only owned/joined groups. The full paginated list stays on My Groups.
  const {
    data: groups,
    count,
    error: groupsError,
  } = await supabase
    .from("study_groups")
    .select("id, name, owner_id", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(20);
  const groupNavigation = {
    groups: (groups ?? []).map((group) => ({
      id: group.id,
      name: group.name,
      owned: group.owner_id === user.id,
    })),
    total: count ?? 0,
    unavailable: Boolean(groupsError),
  };

  const metadataName =
    user.user_metadata?.full_name ?? user.user_metadata?.name;
  const displayName =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim()
      : user.email?.split("@")[0] || "Learner";

  return (
    <div
      data-app-theme={settings.theme}
      data-reading-size={settings.reading_size}
      data-reduce-motion={settings.reduce_motion}
      className="student-space min-h-dvh bg-[#f8f9f5] dark:bg-stone-950 font-sans text-[#233d34] dark:text-stone-200 scheme-light dark:scheme-dark"
    >
      <a
        href="#student-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white dark:focus:bg-stone-900 focus:p-3"
      >
        Skip to content
      </a>

      {/* LEFT: fixed sidebar. Its width matches the content margin below. */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-68 flex-col overflow-y-auto border-r border-[#e8ece4] dark:border-stone-700 bg-white dark:bg-stone-900 px-5 pb-5 pt-8 lg:flex">
        <Sidebar groupNavigation={groupNavigation} />
      </aside>

      {/* RIGHT: header and the current page. */}
      <div className="lg:ml-68">
        <DashboardHeader
          displayName={displayName}
          email={user.email ?? ""}
          groupNavigation={groupNavigation}
          unreadCount={
            notificationResult.error ? null : (notificationResult.count ?? 0)
          }
        />
        <main
          id="student-content"
          className="mx-auto max-w-[1240px] px-4 pb-8 pt-2 md:px-7 lg:px-12"
        >
          <StudyPreferencesProvider
            preferences={readStudyPreferences(user.user_metadata ?? {})}
          >
            {children}
          </StudyPreferencesProvider>
          <footer className="mt-9 flex justify-between gap-3 border-t border-[#e8ebdf] dark:border-stone-700 py-5 pr-12 text-[10px] text-stone-500 dark:text-stone-400">
            <span>A little progress, every day.</span>
            <span className="hidden sm:inline">
              LuminaPH · Your study space
            </span>
          </footer>
        </main>
      </div>

      <Link
        href="/study-tools/ai-tutor"
        aria-label="Open AI Tutor"
        className="fixed bottom-4 right-4 z-30 grid size-13 place-items-center rounded-full border-4 border-[#f8f9f5] dark:border-stone-700 bg-[#245c47] text-white shadow-lg transition-transform hover:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none sm:bottom-6 sm:right-7"
      >
        <MessageCircle size={24} />
      </Link>
    </div>
  );
}
