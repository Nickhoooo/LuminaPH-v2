"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type NotificationState = {
  status: "idle" | "success" | "error";
  message: string;
};
const validId =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getNotificationPreview() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return { error: true, unread: 0, items: [] };
    const [count, recent] = await Promise.all([
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null),
      supabase
        .from("notifications")
        .select("id, title, message, read_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(5),
    ]);
    return {
      error: Boolean(count.error || recent.error),
      unread: count.count ?? 0,
      items: recent.data ?? [],
    };
  } catch {
    return { error: true, unread: 0, items: [] };
  }
}

export async function markNotificationsRead(
  _previous: NotificationState,
  form: FormData,
): Promise<NotificationState> {
  const id = form.get("id");
  if (id !== "all" && (typeof id !== "string" || !validId.test(id)))
    return { status: "error", message: "Invalid notification." };
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return { status: "error", message: "Please log in again." };
    let query = supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    if (id !== "all") query = query.eq("id", id);
    const { error } = await query;
    if (error)
      return { status: "error", message: "Could not update notifications." };
    revalidatePath("/", "layout");
    return {
      status: "success",
      message:
        id === "all" ? "All notifications marked as read." : "Marked as read.",
    };
  } catch {
    return {
      status: "error",
      message: "Connection interrupted. Please retry.",
    };
  }
}

export async function respondToInvitation(
  _previous: NotificationState,
  form: FormData,
): Promise<NotificationState> {
  const id = form.get("invitationId");
  const decision = form.get("decision");
  if (
    typeof id !== "string" ||
    !validId.test(id) ||
    !["accept", "decline"].includes(String(decision))
  ) {
    return {
      status: "error",
      message: "Choose a valid invitation and response.",
    };
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return { status: "error", message: "Please log in again." };
    const { data, error } = await supabase.rpc("respond_group_invitation", {
      p_invitation_id: id,
      p_accept: decision === "accept",
    });
    if (error)
      return {
        status: "error",
        message: "Could not confirm your response. Refresh before retrying.",
      };
    revalidatePath("/", "layout");
    if (data === "accepted")
      return {
        status: "success",
        message:
          "Invitation accepted. Your group is available in Study Groups.",
      };
    if (data === "declined")
      return { status: "success", message: "Invitation declined." };
    return {
      status: "error",
      message: "This invitation has expired or is no longer available.",
    };
  } catch {
    return {
      status: "error",
      message: "Connection interrupted. Refresh to check the invitation.",
    };
  }
}

export async function publishAnnouncement(
  _previous: NotificationState,
  form: FormData,
): Promise<NotificationState> {
  const id = form.get("requestId"),
    title = form.get("title"),
    message = form.get("message");
  if (
    typeof id !== "string" ||
    !validId.test(id) ||
    typeof title !== "string" ||
    !title.trim() ||
    title.trim().length > 160 ||
    typeof message !== "string" ||
    !message.trim() ||
    message.trim().length > 2000
  )
    return {
      status: "error",
      message: "Enter a title and message within the limits.",
    };
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return { status: "error", message: "Please log in again." };
    const { error } = await supabase.rpc("publish_admin_announcement", {
      p_id: id,
      p_title: title.trim(),
      p_message: message.trim(),
    });
    if (error)
      return {
        status: "error",
        message:
          "Could not publish. Administrator access is required. Retry with the same message if the connection was interrupted.",
      };
    revalidatePath("/", "layout");
    return {
      status: "success",
      message: "Announcement published to accounts with announcements enabled.",
    };
  } catch {
    return {
      status: "error",
      message: "Could not confirm publishing. Retry with the same message.",
    };
  }
}
