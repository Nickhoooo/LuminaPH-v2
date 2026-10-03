"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { studyTools } from "../study-tools/_components/study-tools";
import {
  BookOpen,
  ChevronDown,
  GraduationCap,
  Home,
  Layers,
  Library,
  Users,
  Settings,
} from "lucide-react";
import LogoutForm from "../dashboard/LogoutForm";
import StudyGroupsMenu, {
  type GroupNavigation,
} from "../study-tools/study-groups/components/StudyGroupsMenu";

// Kept in this file because this menu belongs to the sidebar.
function StudyToolsMenu({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const isActive =
    pathname === "/study-tools" ||
    studyTools.some((tool) => {
      return pathname === tool.href || pathname.startsWith(tool.href + "/");
    });
  const [open, setOpen] = useState(isActive);
  const menuId = useId();

  let parentStyle = "text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800";
  if (isActive) parentStyle = "bg-[#eaf1e5] dark:bg-stone-800 font-bold text-[#315e42] dark:text-stone-200";

  const toolLinks = [
    { name: "All Study Tools", href: "/study-tools", icon: Layers },
    ...studyTools.filter((tool) => tool.href.startsWith("/study-tools/")),
  ];

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((previous) => !previous)}
        className={
          "flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 motion-reduce:transition-none " +
          parentStyle
        }
      >
        <Layers size={19} aria-hidden="true" />
        <span>Study Tools</span>
        {isActive && <span className="sr-only"> ? current section</span>}
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={
            "ml-auto transition-transform motion-reduce:transition-none " +
            (open ? "rotate-180" : "")
          }
        />
      </button>

      <ul
        id={menuId}
        hidden={!open}
        className="ml-6 mt-2 space-y-1 border-l border-stone-200 dark:border-stone-700 pl-2"
      >
        {toolLinks.map(({ name, href, icon: Icon }) => {
          let selected = pathname === href;
          if (href !== "/study-tools" && pathname.startsWith(href + "/")) {
            selected = true;
          }
          let itemStyle =
            "border-transparent text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 hover:text-stone-800 dark:hover:text-stone-200";
          if (selected)
            itemStyle =
              "border-emerald-700 bg-emerald-50 dark:bg-emerald-950 font-semibold text-emerald-900 dark:text-emerald-200";

          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={selected ? "page" : undefined}
                className={
                  "flex min-h-10 items-center gap-2 rounded-r-lg border-l-2 px-2.5 py-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 motion-reduce:transition-none " +
                  itemStyle
                }
              >
                <Icon size={15} aria-hidden="true" className="shrink-0" />
                <span>{name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Sidebar({
  onNavigate,
  groupNavigation,
}: {
  onNavigate?: () => void;
  groupNavigation: GroupNavigation;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view");

  let activePage;

  if (pathname === "/settings") {
    activePage = "Settings";
  } else if (pathname === "/notifications") {
    activePage = "Notifications";
  } else if (pathname === "/profile") {
    activePage = "Profile";
  } else if (pathname === "/library" || pathname.startsWith("/library/")) {
    activePage = "Library";
  } else if (
    pathname === "/study-tools/study-groups" ||
    pathname.startsWith("/study-tools/study-groups/")
  ) {
    activePage = "Study Groups";
  } else if (
    pathname === "/study-tools" ||
    pathname.startsWith("/study-tools/")
  ) {
    activePage = "Study Tools";
  } else if (view === "learning") {
    activePage = "My Learning";
  } else if (view === "groups") {
    activePage = "Study Groups";
  } else {
    activePage = "Home";
  }

  const links = [
    { name: "Home", href: "/dashboard", icon: Home },
    { name: "My Learning", href: "/dashboard?view=learning", icon: BookOpen },
    { name: "Study Tools", href: "/study-tools", icon: Layers },
    { name: "Study Groups", href: "/study-tools/study-groups", icon: Users },
    { name: "Library", href: "/library", icon: Library },
  ];

  return (
    <>
      <Link
        href="/dashboard"
        className="flex items-center gap-2 text-[22px] font-bold tracking-tight"
      >
        <span className="mr-0.5 grid size-9 place-items-center rounded-xl bg-[#edf3e9] dark:bg-stone-800">
          <GraduationCap size={23} />
        </span>
        <span>
          Lumina<span className="text-[#63957a] dark:text-stone-200">PH</span>
        </span>
      </Link>
      <p className="mb-4 mt-12 px-3 text-[9px] font-bold tracking-[1.8px] text-stone-500 dark:text-stone-400">
        YOUR STUDY SPACE
      </p>
      <nav aria-label="Dashboard navigation" className="grid gap-2">
        {links.map(({ name, href, icon: Icon }) => {
          if (name === "Study Groups") {
            return (
              <StudyGroupsMenu
                key={`groups-${pathname}`}
                navigation={groupNavigation}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            );
          }
          if (name === "Study Tools") {
            // A new route resets expansion: tool routes open automatically.
            return (
              <StudyToolsMenu
                key={pathname}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            );
          }
          return (
            <Link
              key={name}
              href={href}
              onClick={onNavigate}
              aria-current={activePage === name ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-3 text-[13px] transition-colors motion-reduce:transition-none ${activePage === name ? "bg-[#eaf1e5] dark:bg-stone-800 font-bold text-[#315e42] dark:text-stone-200" : "text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800"}`}
            >
              <Icon size={19} />
              <span>{name}</span>
              {activePage === name && (
                <span className="ml-auto size-1.5 rounded-full bg-[#527b41]" />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto pt-8">
        <div className="border-t border-stone-100 dark:border-stone-700 px-3 py-6">
          <span className="text-[8px] tracking-widest text-stone-500 dark:text-stone-400">
            ONE STEP AT A TIME
          </span>
          <p className="mt-3 font-serif text-xl leading-relaxed text-[#617355] dark:text-stone-200">
            A little learning
            <br />
            goes a long way.
          </p>
        </div>
        <div className="grid gap-1 border-t border-stone-100 dark:border-stone-700 pt-3">
          <Link
            href="/settings"
            onClick={onNavigate}
            aria-current={activePage === "Settings" ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-3 text-[13px] transition-colors motion-reduce:transition-none ${activePage === "Settings" ? "bg-[#eaf1e5] dark:bg-stone-800 font-bold text-[#315e42] dark:text-stone-200" : "text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800"}`}
          >
            <Settings size={19} aria-hidden="true" /> Settings
          </Link>
          <LogoutForm variant="sidebar" />
        </div>
      </div>
    </>
  );
}
