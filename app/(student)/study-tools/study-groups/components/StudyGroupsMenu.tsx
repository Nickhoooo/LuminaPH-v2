"use client";

import Link from "next/link";
import { ChevronDown, Users } from "lucide-react";
import { useId, useState } from "react";

export type GroupNavigation = {
  groups: { id: string; name: string; owned: boolean }[];
  total: number;
  unavailable: boolean;
};

export default function StudyGroupsMenu({
  navigation,
  pathname,
  onNavigate,
}: {
  navigation: GroupNavigation;
  pathname: string;
  onNavigate?: () => void;
}) {
  const base = "/study-tools/study-groups";
  const active = pathname === base || pathname.startsWith(base + "/");
  const [open, setOpen] = useState(active);
  const menuId = useId();

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(!open)}
        className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[13px] ${active ? "bg-[#eaf1e5] dark:bg-stone-800 font-bold text-[#315e42] dark:text-stone-200" : "text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800"}`}
      >
        <Users size={19} />
        <span>Study Groups</span>
        <ChevronDown
          size={16}
          className={`ml-auto transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        id={menuId}
        hidden={!open}
        className="ml-6 mt-2 border-l border-stone-200 dark:border-stone-700 pl-2"
      >
        <Link
          href={base}
          onClick={onNavigate}
          aria-current={pathname === base ? "page" : undefined}
          className="block rounded-lg px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950"
        >
          All my groups{navigation.unavailable ? "" : ` (${navigation.total})`}
        </Link>
        {navigation.unavailable ? (
          <p className="px-3 py-2 text-xs text-stone-500 dark:text-stone-400">
            Could not load groups. Open All my groups to retry.
          </p>
        ) : navigation.groups.length === 0 ? (
          <p className="px-3 py-2 text-xs text-stone-500 dark:text-stone-400">
            Create or join your first group.
          </p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {navigation.groups.map((group) => {
              const href = `${base}/${group.id}`;
              const selected =
                pathname === href || pathname.startsWith(href + "/");
              return (
                <li key={group.id}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={selected ? "page" : undefined}
                    className={`block rounded-r-lg border-l-2 px-3 py-2 text-xs ${selected ? "border-emerald-700 bg-emerald-50 dark:bg-emerald-950 font-semibold text-emerald-900 dark:text-emerald-200" : "border-transparent text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800"}`}
                  >
                    <span className="block truncate">{group.name}</span>
                    <span className="mt-1 block text-[10px] font-normal text-stone-500 dark:text-stone-400">
                      {group.owned ? "Owner" : "Joined"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {navigation.total > navigation.groups.length && (
          <p className="px-3 py-2 text-[10px] text-stone-500 dark:text-stone-400">
            Showing the latest {navigation.groups.length}. See All my groups for
            the rest.
          </p>
        )}
      </div>
    </div>
  );
}
