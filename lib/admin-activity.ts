import "server-only";

import { requireAdmin } from "@/lib/require-admin";

export type AdminActivity = {
  id: string;
  action: string;
  reason: string;
  createdAt: string;
  details: Record<string, unknown> | null;
  actorName: string;
  actorEmail: string | null;
  targetName: string | null;
  targetEmail: string | null;
};

export type AdminActivityPage = {
  page: number;
  pageSize: number;
  totalCount: number;
  items: AdminActivity[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isActivity(value: unknown): value is AdminActivity {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || typeof value.action !== "string") return false;
  if (typeof value.reason !== "string" || typeof value.createdAt !== "string") return false;
  if (Number.isNaN(Date.parse(value.createdAt))) return false;
  if (typeof value.actorName !== "string") return false;
  if (value.actorEmail !== null && typeof value.actorEmail !== "string") return false;
  if (value.targetName !== null && typeof value.targetName !== "string") return false;
  if (value.targetEmail !== null && typeof value.targetEmail !== "string") return false;
  if (value.details !== null && !isRecord(value.details)) return false;
  return true;
}

export async function getAdminActivity(page: number) {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("get_admin_activity_log", {
    p_page: page,
  });

  if (error || !isRecord(data)) return null;
  if (data.page !== page || typeof data.pageSize !== "number") return null;
  if (typeof data.totalCount !== "number" || !Array.isArray(data.items)) return null;
  if (!data.items.every(isActivity)) return null;

  return data as unknown as AdminActivityPage;
}
