import Link from "next/link";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { InvitationResponse, MarkReadForm } from "./NotificationControls";
import AnnouncementForm from "./AnnouncementForm";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; unread?: string }>;
}) {
  const query = await searchParams;
  const requested = Number(query.page ?? 1);
  const page =
    Number.isSafeInteger(requested) && requested > 0 && requested <= 100000
      ? requested
      : 1;
  const unreadOnly = query.unread === "1";
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");
  let list = supabase
    .from("notifications")
    .select(
      "id, kind, title, message, href, invitation_id, read_at, created_at",
      { count: "exact" },
    )
    .eq("user_id", user.id);
  if (unreadOnly) list = list.is("read_at", null);
  const {
    data: notifications,
    error,
    count,
  } = await list
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * 20, page * 20 - 1);
  const pageHref = (number: number) =>
    `/notifications?page=${number}${unreadOnly ? "&unread=1" : ""}`;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / 20));
  if (!error && page > totalPages) redirect(pageHref(totalPages));
  const invitationIds = (notifications ?? []).flatMap((item) =>
    item.invitation_id ? [item.invitation_id] : [],
  );
  const invitations = invitationIds.length
    ? await supabase.rpc("get_received_group_invitations", { p_ids: invitationIds })
    : { data: [], error: null };
  const { data: isAdmin } = await supabase.rpc("is_app_administrator");
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Notifications</h1>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
            Invitations, study updates and account notices.
          </p>
        </div>
        <MarkReadForm />
      </header>
      <nav className="flex gap-3" aria-label="Notification filters">
        <Link
          href="/notifications"
          aria-current={!unreadOnly ? "page" : undefined}
          className="rounded-xl border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm"
        >
          All
        </Link>
        <Link
          href="/notifications?unread=1"
          aria-current={unreadOnly ? "page" : undefined}
          className="rounded-xl border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm"
        >
          Unread
        </Link>
        <Link
          href="/settings"
          className="ml-auto px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200"
        >
          Preferences
        </Link>
      </nav>
      {error ? (
        <p role="alert" className="text-red-700 dark:text-red-200">
          Could not load notifications. Please refresh.
        </p>
      ) : !notifications?.length ? (
        <p className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-8 text-stone-500 dark:text-stone-400">
          {unreadOnly ? "You’re all caught up." : "No notifications yet."}
        </p>
      ) : (
        <ul className="space-y-4">
          {notifications.map((item) => {
            const invitation = invitations.data?.find(
              (invite: { id: string; status: string }) => invite.id === item.invitation_id,
            );
            const pendingInvite =
              invitation?.status === "pending";
            // Never turn arbitrary stored text into an external redirect.
            const href =
              typeof item.href === "string" &&
              /^\/(library\/|study-tools\/study-groups\/|settings$)/.test(
                item.href,
              )
                ? item.href
                : null;
            return (
              <li
                key={item.id}
                id={`notification-${item.id}`}
                className={`scroll-mt-6 rounded-2xl border bg-white dark:bg-stone-900 p-5 ${item.read_at ? "border-stone-200 dark:border-stone-700" : "border-emerald-500"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="break-words font-semibold">{item.title}</h2>
                  {!item.read_at && (
                    <span className="rounded-full bg-emerald-50 dark:bg-emerald-950 px-2 py-1 text-xs text-emerald-800 dark:text-emerald-200">
                      New
                    </span>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-stone-600 dark:text-stone-300">
                  {item.message}
                </p>
                <time
                  dateTime={item.created_at}
                  className="mt-3 block text-xs text-stone-500 dark:text-stone-400"
                >
                  {new Date(item.created_at).toLocaleString("en-PH", {
                    timeZone: "Asia/Manila",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
                {item.kind === "group_invite" &&
                  (invitations.error ? (
                    <p
                      role="alert"
                      className="mt-3 text-sm text-red-700 dark:text-red-200"
                    >
                      Could not check this invitation. Refresh to try again.
                    </p>
                  ) : pendingInvite ? (
                    <InvitationResponse id={invitation.id} />
                  ) : (
                    <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
                      Invitation{" "}
                      {invitation?.status === "accepted"
                        ? "accepted. Find your group in Study Groups."
                        : invitation?.status === "declined"
                          ? "declined."
                          : "expired or no longer available."}
                    </p>
                  ))}
                <div className="mt-4 flex flex-wrap items-start gap-3">
                  {href && (
                    <Link
                      href={href}
                      className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white"
                    >
                      View details
                    </Link>
                  )}
                  {item.kind === "group_invite" &&
                    invitation?.status === "accepted" && (
                      <Link
                        href="/study-tools/study-groups"
                        className="rounded-xl bg-emerald-800 px-4 py-2 text-sm text-white"
                      >
                        My groups
                      </Link>
                    )}
                  {!item.read_at && <MarkReadForm id={item.id} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {!error && totalPages > 1 && (
        <nav
          className="flex items-center justify-between text-sm"
          aria-label="Notification pages"
        >
          {page > 1 ? (
            <Link href={pageHref(page - 1)}>Previous</Link>
          ) : (
            <span />
          )}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages && <Link href={pageHref(page + 1)}>Next</Link>}
        </nav>
      )}
      {isAdmin === true && <AnnouncementForm requestId={randomUUID()} />}
    </section>
  );
}
