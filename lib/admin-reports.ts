import "server-only";

import { requireAdmin } from "@/lib/require-admin";

export type ReportStatus = "new" | "in_review" | "resolved";
export type AdminReport = {
  id: string;
  userId: string;
  category: string;
  title: string;
  message: string;
  status: ReportStatus;
  adminResponse: string | null;
  screenshotUrl: string | null;
  screenshotUnavailable: boolean;
  createdAt: string;
  updatedAt: string;
  userName: string;
  userEmail: string | null;
};
export type AdminReportPage = { page: number; pageSize: number; totalCount: number; items: AdminReport[] };
export type ReportFilter = "all" | ReportStatus;
type AdminReportRow = Omit<AdminReport, "screenshotUrl" | "screenshotUnavailable"> & {
  screenshotPath: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isReport(value: unknown): value is AdminReportRow {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || typeof value.userId !== "string") return false;
  if (typeof value.category !== "string" || typeof value.title !== "string" || typeof value.message !== "string") return false;
  if (value.status !== "new" && value.status !== "in_review" && value.status !== "resolved") return false;
  if (value.adminResponse !== null && typeof value.adminResponse !== "string") return false;
  if (value.screenshotPath !== null && typeof value.screenshotPath !== "string") return false;
  if (typeof value.createdAt !== "string" || Number.isNaN(Date.parse(value.createdAt))) return false;
  if (typeof value.updatedAt !== "string" || Number.isNaN(Date.parse(value.updatedAt))) return false;
  if (typeof value.userName !== "string") return false;
  if (value.userEmail !== null && typeof value.userEmail !== "string") return false;
  return true;
}

export async function getAdminReports(page: number, status: ReportFilter) {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("get_admin_reports", {
    p_page: page,
    p_status: status,
  });
  if (error || !isRecord(data)) return null;
  if (data.page !== page || typeof data.pageSize !== "number") return null;
  if (typeof data.totalCount !== "number" || !Array.isArray(data.items)) return null;
  if (!data.items.every(isReport)) return null;

  const reportRows = data.items as AdminReportRow[];
  const items = await Promise.all(reportRows.map(async (report) => {
    let screenshotUrl: string | null = null;
    if (report.screenshotPath) {
      const { data: signedImage } = await supabase.storage
        .from("user-report-screenshots")
        .createSignedUrl(report.screenshotPath, 300);
      screenshotUrl = signedImage?.signedUrl ?? null;
    }

    const { screenshotPath, ...reportDetails } = report;
    return {
      ...reportDetails,
      screenshotUrl,
      screenshotUnavailable: screenshotPath !== null && screenshotUrl === null,
    };
  }));

  return {
    page: data.page,
    pageSize: data.pageSize,
    totalCount: data.totalCount,
    items,
  };
}
