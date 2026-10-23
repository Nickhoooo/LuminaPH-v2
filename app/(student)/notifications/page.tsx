import Link from "next/link";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { MarkReadForm } from "./NotificationControls";
import NotificationCard from "./NotificationCard";
import { readReceivedInvitations } from "./invitations";
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
  const invitations = await readReceivedInvitations(
    supabase,
    user.id,
    invitationIds,
  );
  const { data: isAdmin } = await supabase.rpc("is_app_administrator");
  return (
    <section className="w-full min-w-0 space-y-6">
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
        <ul className="grid items-start gap-4 xl:grid-cols-2">
          {notifications.map((item) => (
            <li
              key={item.id}
              id={`notification-${item.id}`}
              className="scroll-mt-24"
            >
              <NotificationCard
                notification={item}
                invitation={invitations.data.find(
                  (invite) => invite.id === item.invitation_id,
                )}
                invitationError={invitations.error}
              />
            </li>
          ))}
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
