"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  Ellipsis,
  Home,
  Layers,
  MessageSquareWarning,
  Settings,
  UserRound,
  UsersRound,
  Bell,
} from "lucide-react";
import LogoutForm from "../dashboard/LogoutForm";

const items = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Tools", href: "/study-tools", icon: Layers },
  { label: "Groups", href: "/study-tools/study-groups", icon: UsersRound },
  { label: "Library", href: "/library", icon: BookOpen },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive =
    pathname === "/feedback" ||
    pathname === "/notifications" ||
    pathname === "/settings" ||
    pathname === "/profile" ||
    (pathname === "/dashboard" && searchParams.get("view") === "learning");

  return (
    <nav
      aria-label="Student navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-950/10 bg-white/90 text-[#20342c] shadow-[0_-8px_24px_rgb(24_52_42/0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-stone-950/90 dark:text-stone-100 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        id="mobile-more-menu"
        hidden={!moreOpen}
        className="absolute inset-x-3 bottom-[calc(100%+0.5rem)] mx-auto max-w-lg rounded-2xl border border-stone-200 bg-white p-2 text-[#20342c] shadow-xl dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
      >
        <ul className="grid gap-1">
          {[
            { label: "My Learning", href: "/dashboard?view=learning", icon: BookOpen },
            { label: "Notifications", href: "/notifications", icon: Bell },
            { label: "Reports & Feedback", href: "/feedback", icon: MessageSquareWarning },
            { label: "Profile", href: "/profile", icon: UserRound },
            { label: "Settings", href: "/settings", icon: Settings },
          ].map(({ label, href, icon: Icon }) => {
            const active =
              (href === "/dashboard?view=learning" && pathname === "/dashboard" && searchParams.get("view") === "learning") ||
              href === pathname;
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-800 dark:hover:bg-stone-800"
                >
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </Link>
              </li>
            );
          })}
          <li className="border-t border-stone-100 pt-1 dark:border-stone-700">
            <LogoutForm variant="sidebar" />
          </li>
        </ul>
      </div>
      <ul className="mx-auto grid max-w-lg grid-cols-5 gap-1 px-2 pt-2">
        {items.map(({ label, href, icon: Icon }) => {
          const active =
            (pathname === href &&
              !(href === "/dashboard" && searchParams.get("view") === "learning")) ||
            (href === "/study-tools" &&
              (pathname === "/study-tools" ||
                (pathname.startsWith("/study-tools/") &&
                  !pathname.startsWith("/study-tools/study-groups")))) ||
            (href === "/study-tools/study-groups" &&
              pathname.startsWith("/study-tools/study-groups/"));
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setMoreOpen(false)}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 motion-reduce:transition-none",
                  active
                    ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100"
                    : "text-stone-500 hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-white/5",
                ].join(" ")}
              >
                <Icon
                  size={19}
                  strokeWidth={active ? 2.2 : 1.8}
                  aria-hidden="true"
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls="mobile-more-menu"
            onClick={() => setMoreOpen((open) => !open)}
            className={[
              "flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 motion-reduce:transition-none",
              moreOpen || moreActive
                ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100"
                : "text-stone-500 hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-white/5",
            ].join(" ")}
          >
            <Ellipsis size={19} aria-hidden="true" />
            <span>More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
