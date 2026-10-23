"use client";

import { ChevronRight, Menu, X } from "lucide-react";
import ProfilePhoto from "@/components/study/ProfilePhoto";
import Link from "next/link";

import { useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Sidebar from "./Sidebar";
import NotificationBell from "../notifications/NotificationBell";
import type { GroupNavigation } from "../study-tools/study-groups/components/StudyGroupsMenu";

export default function DashboardHeader({
  avatarUrl,
  displayName,
  email,
  groupNavigation,
  unreadCount,
}: {
  avatarUrl?: string;
  displayName: string;
  email: string;
  groupNavigation: GroupNavigation;
  unreadCount: number | null;
}) {
  const mobileMenu = useRef<HTMLDialogElement>(null);
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
      <header className="sticky top-0 z-40 flex h-[74px] w-full items-center justify-between gap-4 border-b border-emerald-700 bg-emerald-800 px-4 text-white shadow-sm md:px-6 xl:px-8 dark:border-emerald-900 dark:bg-emerald-950">
        <div className="flex items-center gap-3 text-xs text-emerald-100">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => mobileMenu.current?.showModal()}
            className="grid size-10 cursor-pointer place-items-center lg:hidden"
          >
            <Menu size={22} />
          </button>
          <span className="hidden sm:inline">My study space</span>
          <ChevronRight size={14} className="hidden sm:block" />
          <span className="font-medium text-white">{activePage}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-5">
          <NotificationBell unreadCount={unreadCount} />

          <span className="h-6 w-px bg-emerald-600 dark:bg-emerald-800" />
          <Link
            href="/profile"
            aria-label="Open profile"
            title={email}
            className="flex cursor-pointer items-center gap-2.5 text-xs"
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
      <dialog
        ref={mobileMenu}
        aria-label="Dashboard navigation"
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-dvh w-70 max-w-full overflow-y-auto border-0 bg-white dark:bg-stone-900 px-6 pb-6 pt-15 text-[#233d34] dark:text-stone-200 backdrop:bg-black/30 backdrop:backdrop-blur-sm open:flex open:flex-col"
      >
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => mobileMenu.current?.close()}
          className="absolute right-4 top-4 grid size-10 cursor-pointer place-items-center rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"
        >
          <X size={22} />
        </button>
        <Sidebar
          groupNavigation={groupNavigation}
          onNavigate={() => mobileMenu.current?.close()}
        />
      </dialog>
    </>
  );
}
