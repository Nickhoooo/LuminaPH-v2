"use server";

import { requireAdmin } from "@/lib/require-admin";

export type AdminAlerts = {
  unreadCount: number;
  users: Array<{
    id: string;
    displayName: string;
    email: string | null;
    createdAt: string;
  }>;
  activities: Array<{
    id: string;
    action: string;
    createdAt: string;
    reason: string;
  }>;
  reports: Array<{
    id: string;
    title: string;
    category: string;
    createdAt: string;
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAlertPayload(value: unknown): value is AdminAlerts {
  if (!isRecord(value) || !Number.isSafeInteger(value.unreadCount)) return false;
  if (!Array.isArray(value.users) || !Array.isArray(value.activities) || !Array.isArray(value.reports)) return false;
  const usersAreValid = value.users.every((user) => isRecord(user)
    && typeof user.id === "string"
    && typeof user.displayName === "string"
    && (user.email === null || typeof user.email === "string")
    && typeof user.createdAt === "string"
    && !Number.isNaN(Date.parse(user.createdAt)));
  const activitiesAreValid = value.activities.every((activity) => isRecord(activity)
    && typeof activity.id === "string"
    && typeof activity.action === "string"
    && typeof activity.reason === "string"
    && typeof activity.createdAt === "string"
    && !Number.isNaN(Date.parse(activity.createdAt)));
  const reportsAreValid = value.reports.every((report) => isRecord(report)
    && typeof report.id === "string"
    && typeof report.title === "string"
    && typeof report.category === "string"
    && typeof report.createdAt === "string"
    && !Number.isNaN(Date.parse(report.createdAt)));
  return usersAreValid && activitiesAreValid && reportsAreValid;
}

export async function markAdminAlertsRead(): Promise<AdminAlerts | null> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("get_admin_alerts", {
    p_mark_read: true,
  });
  if (error || !isAlertPayload(data)) return null;
  return data;
}
