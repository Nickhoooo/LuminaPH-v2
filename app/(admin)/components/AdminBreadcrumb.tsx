"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminBreadcrumb() {
  const pathname = usePathname();
  const labels: Record<string, string> = {
    profile: "My profile",
    users: "Users",
    "ai-control": "AI Control",
    reports: "Reports & Feedback",
    "activity-log": "Activity Log",
  };
  const currentPage = labels[pathname.split("/")[2]] ?? "Overview";

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-stone-500 dark:text-stone-400">
      <Link href="/admin" className="rounded-md hover:underline">Admin</Link>
      <span aria-hidden="true" className="mx-3 text-stone-300 dark:text-stone-600">/</span>
      <span aria-current="page" className="font-medium text-stone-900 dark:text-stone-100">
        {currentPage}
      </span>
    </nav>
  );
}
