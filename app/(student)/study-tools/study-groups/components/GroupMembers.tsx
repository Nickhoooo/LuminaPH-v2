import Link from "next/link";
import RemoveMemberForm from "./RemoveMemberForm";

export type GroupMember = {
  user_id: string;
  display_name: string;
  is_owner: boolean;
  joined_at: string;
  total_count: number;
};

export default function GroupMembers({
  groupId,
  userId,
  isOwner,
  hasDisplayName,
  members,
  hasError,
  membersPage,
  libraryPage,
  materialsPage,
}: {
  groupId: string;
  userId: string;
  isOwner: boolean;
  hasDisplayName: boolean;
  members: GroupMember[];
  hasError: boolean;
  membersPage: number;
  libraryPage?: string | string[];
  materialsPage?: string | string[];
}) {
  const membersError = hasError;
  const totalMembers = Number(members[0]?.total_count ?? 0);
  const hasNextPage = membersPage * 20 < totalMembers;
  function memberPageLink(page: number) {
    const query = new URLSearchParams({ membersPage: String(page) });
    if (typeof libraryPage === "string") query.set("libraryPage", libraryPage);
    if (typeof materialsPage === "string")
      query.set("materialsPage", materialsPage);
    return `/study-tools/study-groups/${groupId}?${query}#group-members`;
  }
  return (
    <section
      id="group-members"
      className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6"
    >
      <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-200">
        Members
        {!membersError && (
          <span className="ml-2 text-sm font-normal text-stone-500 dark:text-stone-400">
            ({totalMembers})
          </span>
        )}
      </h2>

      <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
        Everyone who has joined this group. Your account is marked “You”.
      </p>
      {!hasDisplayName && (
        <p className="mt-3 rounded-xl bg-amber-50 dark:bg-amber-950 p-3 text-sm text-amber-900 dark:text-amber-200">
          Add and save your display name so classmates can recognize you.{" "}
          <Link href="/profile" className="font-semibold underline">
            Edit my profile
          </Link>
        </p>
      )}

      {membersError ? (
        <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-200">
          We could not load the members. Please refresh the page.
        </p>
      ) : members.length === 0 ? (
        <p className="mt-4 text-sm text-stone-600 dark:text-stone-300">No members to display.</p>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-stone-100 dark:divide-stone-700">
            {members.map((member) => (
              <li key={member.user_id} className="space-y-3 py-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="min-w-0 break-words text-sm font-medium text-stone-800 dark:text-stone-200">
                    {member.display_name}
                    {member.user_id === userId && (
                      <span className="ml-2 font-normal text-stone-500 dark:text-stone-400">
                        (You)
                      </span>
                    )}
                  </p>
                  <span className="shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-950 px-3 py-1 text-xs text-emerald-800 dark:text-emerald-200">
                    {member.is_owner ? "Group owner" : "Member"}
                  </span>
                </div>
                {isOwner && !member.is_owner && (
                  <RemoveMemberForm
                    groupId={groupId}
                    memberId={member.user_id}
                    memberName={member.display_name}
                  />
                )}
              </li>
            ))}
          </ul>

          {(membersPage > 1 || hasNextPage) && (
            <nav
              aria-label="Member pages"
              className="mt-4 flex items-center gap-3"
            >
              {membersPage > 1 && (
                <Link
                  href={memberPageLink(membersPage - 1)}
                  className="rounded-lg border border-stone-300 dark:border-stone-700 px-3 py-2 text-sm hover:bg-stone-50 dark:hover:bg-stone-800"
                >
                  Previous
                </Link>
              )}
              <span className="text-sm text-stone-500 dark:text-stone-400">Page {membersPage}</span>
              {hasNextPage && (
                <Link
                  href={memberPageLink(membersPage + 1)}
                  className="rounded-lg border border-stone-300 dark:border-stone-700 px-3 py-2 text-sm hover:bg-stone-50 dark:hover:bg-stone-800"
                >
                  Next
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </section>
  );
}
