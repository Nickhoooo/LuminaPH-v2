"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Cpu,
  MessageSquareWarning,
  History,
} from "lucide-react";

const navigation = [
  {
    label: "Overview",
    href: "/admin",
    icon: LayoutDashboard,
    available: true,
  },
  {
    label: "Users",
    href: "/admin/users",
    icon: Users,
    available: true,
  },
  {
    label: "AI Control",
    href: "/admin/ai-control",
    icon: Cpu,
    available: false,
  },
  {
    label: "Reports & Feedback",
    href: "/admin/reports",
    icon: MessageSquareWarning,
    available: true,
  },
  {
    label: "Activity Log",
    href: "/admin/activity-log",
    icon: History,
    available: true,
  },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin navigation" className="mt-7 space-y-2">
      {navigation.map((item) => {
        const Icon = item.icon;

        const isActive =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        const baseStyle =
          "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition-colors";

        if (!item.available) {
          return (
            <button
              key={item.href}
              type="button"
              disabled
              className={`${baseStyle} cursor-not-allowed text-white/50`}
            >
              <Icon size={20} aria-hidden="true" />
              {item.label}
            </button>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`${baseStyle} ${
              isActive
                ? "bg-white/15 font-semibold text-white"
                : "text-emerald-50 hover:bg-white/10"
            }`}
          >
            <Icon size={20} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
