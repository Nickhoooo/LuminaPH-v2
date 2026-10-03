import CreateGroupForm from "./components/CreateGroupForm";
import JoinGroupForm from "./components/JoinGroupForm";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import GroupAvatar from "./components/GroupAvatar";
import { getGroupAvatarUrls } from "./group-avatar";

export default async function StudyGroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const query = await searchParams;
  let page = 1;
  if (typeof query.page === "string" && /^\d+$/.test(query.page)) {
    const requestedPage = Number(query.page);
    if (
      Number.isSafeInteger(requestedPage) &&
      requestedPage > 0 &&
      requestedPage <= 100000
    ) {
      page = requestedPage;
    }
  }
  const pageSize = 20;
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    redirect("/login");
  }

  // RLS limits both the rows and total count to groups the learner belongs to.
  const {
    data: groups,
    error: groupsError,
    count,
  } = await supabase
    .from("study_groups")
    .select("id, name, description, owner_id, avatar_path", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const totalGroups = count ?? 0;
  const avatarUrls = await getGroupAvatarUrls(
    (groups ?? []).map((group) => group.avatar_path),
  );
  const totalPages = Math.max(1, Math.ceil(totalGroups / pageSize));
  // A group may have been removed since this page was bookmarked.
  if (!groupsError && page > totalPages) {
    redirect(`/study-tools/study-groups?page=${totalPages}#my-groups`);
  }

  return (
    <main className="space-y-7">
      <div className="w-auto  sm:px-8 lg:px-10">
        {/* Header */}
        <header className="border-b border-stone-200 dark:border-stone-700 pb-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            {/* Title */}
            <div className="max-w-2xl">
              <div className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-950 px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                Learn together
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-200 sm:text-4xl">
                Study Groups
              </h1>

              <p className="mt-3 text-base leading-7 text-stone-600 dark:text-stone-300">
                Learn with classmates, share ideas, and stay motivated together.
              </p>
            </div>

            {/* Create / Join Buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                popoverTarget="create-group-modal"
                className="inline-flex items-center justify-center rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900"
              >
                <span className="mr-2 text-lg leading-none">+</span>
                Create Group
              </button>

              <button
                type="button"
                popoverTarget="join-group-modal"
                className="inline-flex items-center justify-center rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-4 py-2.5 text-sm font-semibold text-stone-700 dark:text-stone-200 shadow-sm transition hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 hover:text-emerald-800 dark:hover:text-emerald-200"
              >
                Join Group
              </button>
            </div>
          </div>
        </header>

        {/* =========================
            CREATE GROUP MODAL
        ========================== */}
        <div
          id="create-group-modal"
          popover="auto"
          className="m-auto w-[calc(100%-2rem)] max-h-[85dvh] max-w-lg overflow-y-auto rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-0 shadow-2xl"
        >
          <div className="flex items-start justify-between border-b border-stone-100 dark:border-stone-700 px-6 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                Study Groups
              </p>

              <h2 className="mt-1 text-xl font-bold text-stone-900 dark:text-stone-200">
                Create a study group
              </h2>

              <p className="mt-1 text-sm leading-5 text-stone-500 dark:text-stone-400">
                Create a space where you and your classmates can learn together.
              </p>
            </div>

            <button
              type="button"
              popoverTarget="create-group-modal"
              popoverTargetAction="hide"
              aria-label="Close"
              className="ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl text-stone-400 transition hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-700 dark:hover:text-stone-200"
            >
              ×
            </button>
          </div>

          <div className="px-6 py-6">
            <CreateGroupForm />
          </div>
        </div>

        {/* =========================
            JOIN GROUP MODAL
        ========================== */}
        <div
          id="join-group-modal"
          popover="auto"
          className="m-auto w-[calc(100%-2rem)] max-h-[85dvh] max-w-lg overflow-y-auto rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-0 shadow-2xl"
        >
          <div className="flex items-start justify-between border-b border-stone-100 dark:border-stone-700 px-6 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                Study Groups
              </p>

              <h2 className="mt-1 text-xl font-bold text-stone-900 dark:text-stone-200">
                Join a study group
              </h2>

              <p className="mt-1 text-sm leading-5 text-stone-500 dark:text-stone-400">
                Enter an invite code to join your classmates.
              </p>
            </div>

            <button
              type="button"
              popoverTarget="join-group-modal"
              popoverTargetAction="hide"
              aria-label="Close"
              className="ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl text-stone-400 transition hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-700 dark:hover:text-stone-200"
            >
              ×
            </button>
          </div>

          <div className="px-6 py-6">
            <JoinGroupForm />
          </div>
        </div>

        {/* Groups */}
        <section
          id="my-groups"
          aria-labelledby="my-groups-heading"
          className="mt-10"
        >
          {/* Section Header */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-200">
                Your learning spaces
              </p>

              <h2
                id="my-groups-heading"
                className="mt-1 text-2xl font-bold text-stone-900 dark:text-stone-200"
              >
                My Groups
              </h2>

              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                Pick a group and continue learning.
              </p>
            </div>

            {!groupsError && (
              <span className="text-sm text-stone-500 dark:text-stone-400">
                {totalGroups} {totalGroups === 1 ? "group" : "groups"}
              </span>
            )}
          </div>

          {/* Group List */}
          <div className="mt-6">
            {groupsError ? (
              <div
                role="alert"
                className="rounded-2xl border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-950 p-5 text-sm text-red-700 dark:text-red-200"
              >
                We could not load your groups. Please refresh the page.
              </div>
            ) : !groups?.length ? (
              <div className="rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-6 py-16 text-center">
                <div className="mx-auto max-w-md">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-2xl text-emerald-700 dark:text-emerald-200">
                    +
                  </div>

                  <h3 className="mt-5 text-lg font-semibold text-stone-900 dark:text-stone-200">
                    No study groups yet
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-stone-500 dark:text-stone-400">
                    Start learning with others by creating your first study
                    group or joining one with an invite code.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {groups.map((group) => {
                  const isOwner = group.owner_id === authData.user.id;

                  return (
                    <li
                      key={group.id}
                      className="group flex min-h-[230px] flex-col rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-emerald-200 dark:hover:border-emerald-700 hover:shadow-md"
                    >
                      {/* Role */}
                      <div className="flex items-center justify-between gap-3">
                        <GroupAvatar
                          name={group.name}
                          src={avatarUrls.get(group.avatar_path)}
                        />
                        <span className="rounded-full bg-emerald-50 dark:bg-emerald-950 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-200">
                          {isOwner ? "Owner" : "Member"}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="mt-5 flex-1">
                        <h3 className="break-words text-lg font-bold text-stone-900 dark:text-stone-200">
                          {group.name}
                        </h3>

                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-stone-600 dark:text-stone-300">
                          {group.description ||
                            "A space to learn and study together."}
                        </p>
                      </div>

                      {/* Action */}
                      <div className="mt-5 border-t border-stone-100 dark:border-stone-700 pt-4">
                        <Link
                          href={`/study-tools/study-groups/${group.id}`}
                          className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900"
                        >
                          Open group
                          <span className="ml-2 transition-transform duration-200 group-hover:translate-x-1">
                            →
                          </span>
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {!groupsError && totalPages > 1 && (
            <nav
              aria-label="My Groups pages"
              className="mt-6 flex flex-wrap items-center justify-between gap-3"
            >
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Page {page} of {totalPages} · Showing{" "}
                {(page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, totalGroups)} of {totalGroups} groups
              </p>
              <div className="flex gap-3">
                {page > 1 && (
                  <Link
                    href={`/study-tools/study-groups?page=${page - 1}#my-groups`}
                    className="rounded-xl border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800"
                  >
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/study-tools/study-groups?page=${page + 1}#my-groups`}
                    className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-900"
                  >
                    Next
                  </Link>
                )}
              </div>
            </nav>
          )}
        </section>
      </div>
    </main>
  );
}
