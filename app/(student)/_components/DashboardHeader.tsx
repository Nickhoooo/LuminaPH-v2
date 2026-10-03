"use client";

import { ChevronRight, Menu, X } from "lucide-react";
import Link from "next/link";

import { useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Sidebar from "./Sidebar";
import NotificationBell from "../notifications/NotificationBell";
import type { GroupNavigation } from "../study-tools/study-groups/components/StudyGroupsMenu";

export default function DashboardHeader({
  displayName,
  email,
  groupNavigation,
  unreadCount,
}: {
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
  const activePage = isGroupPage
    ? "Study Groups"
    : pathname === "/study-tools" || pathname.startsWith("/study-tools/")
      ? "Study Tools"
      : pathname === "/notifications"
        ? "Notifications"
        : view === "learning"
          ? "My Learning"
          : view === "groups"
            ? "Study Groups"
            : pathname === "/library" || pathname.startsWith("/library/")
              ? "Library"
              : pathname === "/settings"
                ? "Settings"
                : pathname === "/profile"
                  ? "Profile"
                  : "Home";
  return (
    <>
      <header className="mx-auto flex h-[74px] max-w-[1240px] items-center justify-between gap-4 px-4 md:px-7 lg:h-[89px] lg:px-12">
        <div className="flex items-center gap-3 text-xs text-stone-500 dark:text-stone-400">
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
          <span className="font-medium text-[#53654e] dark:text-stone-200">
            {activePage}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-5">
          <NotificationBell
            key={unreadCount ?? "unavailable"}
            unreadCount={unreadCount}
          />

          <span className="h-6 w-px bg-stone-200 dark:bg-stone-800" />
          <Link
            href="/profile"
            aria-label="Open profile"
            title={email}
            className="flex cursor-pointer items-center gap-2.5 text-xs"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e7eddf] dark:bg-stone-800 font-serif text-lg">
              {displayName.slice(0, 1).toUpperCase()}
            </span>
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
