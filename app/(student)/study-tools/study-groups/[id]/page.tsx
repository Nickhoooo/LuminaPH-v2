import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InviteCode from "../components/InviteCode";
import InviteMemberForm from "../components/InviteMemberForm";
import LeaveGroupForm from "../components/LeaveGroupForm";
import GroupMembers, { type GroupMember } from "../components/GroupMembers";
import SharedMaterials from "../components/SharedMaterials";
import GroupDashboard from "../components/GroupDashboard";
import GroupAvatar from "../components/GroupAvatar";
import DeleteGroupForm from "../components/DeleteGroupForm";
import { getGroupAvatarUrls } from "../group-avatar";

type GroupPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    membersPage?: string | string[];
    libraryPage?: string | string[];
    materialsPage?: string | string[];
  }>;
};

export default async function GroupPage({
  params,
  searchParams,
}: GroupPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const requestedPage =
    typeof query.membersPage === "string" ? Number(query.membersPage) : 1;
  const membersPage =
    Number.isInteger(requestedPage) &&
    requestedPage >= 1 &&
    requestedPage <= 50000
      ? requestedPage
      : 1;

  const validId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!validId.test(id)) {
    notFound();
  }

  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    redirect("/login");
  }

  const { data: group, error: groupError } = await supabase
    .from("study_groups")
    .select("id, name, description, owner_id, avatar_path")
    .eq("id", id)
    .maybeSingle();

  if (groupError) {
    return (
      <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950 p-5 text-red-700 dark:text-red-200">
        We could not load this group. Please refresh the page.
      </div>
    );
  }

  if (!group) {
    notFound();
  }

  const isOwner = group.owner_id === authData.user.id;
  const avatarUrls = await getGroupAvatarUrls([group.avatar_path]);
  const hasDisplayName = [
    authData.user.user_metadata?.full_name,
    authData.user.user_metadata?.name,
  ].some((name) => typeof name === "string" && name.trim().length > 0);

  const { data: memberData, error: membersError } = await supabase.rpc(
    "list_study_group_members",
    { p_group_id: group.id, p_page: membersPage },
  );
  const members: GroupMember[] = memberData ?? [];
  const groupUrl = `/study-tools/study-groups/${group.id}`;

  function memberPageLink(page: number) {
    const parameters = new URLSearchParams({ membersPage: String(page) });
    for (const field of ["libraryPage", "materialsPage"] as const) {
      const value = query[field];
      if (typeof value === "string") {
        parameters.set(field, value);
      }
    }
    return `${groupUrl}?${parameters}#group-members`;
  }

  if (!membersError && membersPage > 1 && members.length === 0) {
    redirect(memberPageLink(1));
  }

  const totalMembers = Number(members[0]?.total_count ?? 0);

  let inviteCode: string | null = null;
  let inviteError = false;

  if (isOwner) {
    const { data: code, error } = await supabase.rpc("get_study_group_invite", {
      p_group_id: group.id,
    });

    if (error || typeof code !== "string") {
      inviteError = true;
    } else {
      inviteCode = code;
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <Link
        href="/study-tools/study-groups"
        className="inline-flex rounded-xl border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm font-medium hover:bg-stone-100 dark:hover:bg-stone-800"
      >
        Study Groups / {group.name}
      </Link>

      <header className="flex items-start gap-4 border-b border-stone-200 dark:border-stone-700 pb-5 sm:gap-5">
        <GroupAvatar
          name={group.name}
          src={avatarUrls.get(group.avatar_path)}
        />
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-semibold text-stone-900 dark:text-stone-200 sm:text-3xl">
            {group.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="rounded-full bg-emerald-50 dark:bg-emerald-950 px-3 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-200">
              {isOwner ? "Your role: Group owner" : "Your role: Member"}
            </span>
            {!membersError && (
              <span className="text-xs text-stone-500 dark:text-stone-400">
                {totalMembers} {totalMembers === 1 ? "member" : "members"}
              </span>
            )}
          </div>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-stone-600 dark:text-stone-300">
            {group.description || "No description yet."}
          </p>
        </div>
      </header>
      <nav
        aria-label="Group dashboard sections"
        className="flex flex-wrap gap-2"
      >
        <a
          href="#group-track"
          className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-900"
        >
          Study track
        </a>
        <a
          href="#group-progress"
          className="rounded-xl border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm font-medium hover:bg-stone-100 dark:hover:bg-stone-800"
        >
          Group progress
        </a>
        <a
          href="#shared-materials"
          className="rounded-xl border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm font-medium hover:bg-stone-100 dark:hover:bg-stone-800"
        >
          Shared materials
        </a>
        <a
          href="#group-members"
          className="rounded-xl border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm font-medium hover:bg-stone-100 dark:hover:bg-stone-800"
        >
          Members
        </a>
      </nav>
      {isOwner && (
        <details className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            Invite members +
          </summary>
          <div className="mt-4">
            {inviteError ? (
              <p role="alert" className="text-sm text-red-700 dark:text-red-200">
                Could not load your invite code. Refresh to try again.
              </p>
            ) : (
              inviteCode !== null && (
                <InviteCode
                  key={inviteCode}
                  code={inviteCode}
                  groupId={group.id}
                />
              )
            )}
          </div>
          <InviteMemberForm groupId={group.id} />
        </details>
      )}
      <GroupDashboard
        groupId={group.id}
        userId={authData.user.id}
        isOwner={isOwner}
        membersPage={membersPage}
        libraryPage={query.libraryPage}
        materialsPage={query.materialsPage}
      />
      <SharedMaterials
        groupId={group.id}
        userId={authData.user.id}
        isOwner={isOwner}
        membersPage={membersPage}
        libraryPage={query.libraryPage}
        materialsPage={query.materialsPage}
      />

      <GroupMembers
        groupId={group.id}
        userId={authData.user.id}
        isOwner={isOwner}
        hasDisplayName={hasDisplayName}
        members={members}
        hasError={Boolean(membersError)}
        membersPage={membersPage}
        libraryPage={query.libraryPage}
        materialsPage={query.materialsPage}
      />

      {!isOwner && <LeaveGroupForm groupId={group.id} />}
      {isOwner && <DeleteGroupForm groupId={group.id} groupName={group.name} />}
    </div>
  );
}
