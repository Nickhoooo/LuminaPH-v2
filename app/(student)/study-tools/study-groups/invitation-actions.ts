"use server";

import { createClient } from "@/lib/supabase/server";

export type InviteMemberState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function inviteMember(
  _previous: InviteMemberState,
  form: FormData,
): Promise<InviteMemberState> {
  const groupId = form.get("groupId"),
    email = form.get("email");
  if (
    typeof groupId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      groupId,
    ) ||
    typeof email !== "string" ||
    email.trim().length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    return { status: "error", message: "Enter a valid email address." };
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return { status: "error", message: "Please log in again." };
    const { data, error } = await supabase.rpc("invite_group_member", {
      p_group_id: groupId,
      p_email: email.trim(),
    });
    if (error)
      return {
        status: "error",
        message:
          "Could not process the invitation. Only the owner can invite members.",
      };
    if (data === "rate_limited")
      return {
        status: "error",
        message: "Invitation limit reached. Try again in an hour.",
      };
    return {
      status: "success",
      message:
        "If this email belongs to a confirmed LuminaPH account that is not already a member, a pending invitation is available in their notifications. Invitations expire after seven days.",
    };
  } catch {
    return {
      status: "error",
      message: "Connection interrupted. You can safely retry this invitation.",
    };
  }
}
