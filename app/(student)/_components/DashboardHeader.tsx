"use client";

import { ChevronRight } from "lucide-react";
import ProfilePhoto from "@/components/study/ProfilePhoto";
import Link from "next/link";

import { usePathname, useSearchParams } from "next/navigation";
import NotificationBell from "../notifications/NotificationBell";

export default function DashboardHeader({
  avatarUrl,
  displayName,
  email,
  unreadCount,
}: {
  avatarUrl?: string;
  displayName: string;
  email: string;
  unreadCount: number | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const isGroupPage =
    pathname === "/study-tools/study-groups" ||
    pathname.startsWith("/study-tools/study-groups/");
  let activePage = "Home";
  if (pathname === "/feedback") {
    activePage = "Reports & Feedback";
  } else if (isGroupPage || view === "groups") {
    activePage = "Study Groups";
  } else if (pathname === "/study-tools" || pathname.startsWith("/study-tools/")) {
    activePage = "Study Tools";
  } else if (pathname === "/notifications") {
    activePage = "Notifications";
  } else if (view === "learning") {
    activePage = "My Learning";
  } else if (pathname === "/library" || pathname.startsWith("/library/")) {
    activePage = "Library";
  } else if (pathname === "/settings") {
    activePage = "Settings";
  } else if (pathname === "/profile") {
    activePage = "Profile";
  }
  return (
    <>
      <header className="sticky top-0 z-40 flex h-[74px] w-full items-center justify-between gap-4 border-b border-emerald-950/20 bg-emerald-900/90 px-4 text-white shadow-sm backdrop-blur-xl md:px-6 xl:px-8 dark:border-white/10 dark:bg-emerald-950/90">
        <div className="flex items-center gap-3 text-xs text-emerald-100">
          <span className="hidden sm:inline">My study space</span>
          <ChevronRight size={14} className="hidden sm:block" />
          <span className="font-medium text-white">{activePage}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-5">
          <NotificationBell unreadCount={unreadCount} />

          <span className="hidden h-6 w-px bg-emerald-600 dark:bg-emerald-800 lg:block" />
          <Link
            href="/profile"
            aria-label="Open profile"
            title={email}
            className="hidden cursor-pointer items-center gap-2.5 text-xs lg:flex"
          >
            <ProfilePhoto
              src={avatarUrl}
              name={displayName}
              className="size-9! rounded-full! text-lg!"
            />
            <span className="max-w-20 truncate sm:max-w-32">{displayName}</span>
          </Link>
        </div>
      </header>
    </>
  );
}
