import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { ReceivedInvitation } from "./notification-types";

export async function readReceivedInvitations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  ids: string[],
): Promise<{ data: ReceivedInvitation[]; error: boolean }> {
  if (!ids.length) return { data: [], error: false };

  // Use the existing recipient-only RLS policy, without requiring another RPC.
  const { data, error } = await supabase
    .from("group_invitations")
    .select("id, group_id, status, expires_at")
    .eq("recipient_id", userId)
    .in("id", [...new Set(ids)].slice(0, 20));
  if (error) return { data: [], error: true };

  const now = Date.now();
  return {
    error: false,
    data: (data ?? []).map((invite) => ({
      id: invite.id,
      group_id: invite.group_id,
      // Display expiry here; the response RPC enforces it again using DB time.
      status:
        invite.status === "pending" && Date.parse(invite.expires_at) <= now
          ? "expired"
          : invite.status,
    })),
  };
}
