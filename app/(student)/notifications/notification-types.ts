export type InvitationStatus = "pending" | "accepted" | "declined" | "expired";

export type ReceivedInvitation = {
  id: string;
  group_id: string;
  status: InvitationStatus;
};

export type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  message: string;
  href: string | null;
  invitation_id: string | null;
  read_at: string | null;
  created_at: string;
};
