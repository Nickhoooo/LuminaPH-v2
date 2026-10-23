"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";

export type DeleteReportsState = { status: "idle" | "success" | "error"; message: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isDeleteResult(value: unknown): value is { deletedCount: number; screenshotPaths: string[] } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  return Number.isSafeInteger(result.deletedCount)
    && Array.isArray(result.screenshotPaths)
    && result.screenshotPaths.every((path) => typeof path === "string");
}

export async function deleteResolvedReports(_previous: DeleteReportsState, formData: FormData): Promise<DeleteReportsState> {
  const reportIds = formData.getAll("reportIds");
  if (reportIds.length < 1 || reportIds.length > 20 || !reportIds.every((id) => typeof id === "string" && uuidPattern.test(id))) {
    return { status: "error", message: "Select between 1 and 20 resolved reports, then try again." };
  }

  const uniqueReportIds = [...new Set(reportIds as string[])];
  if (uniqueReportIds.length !== reportIds.length) {
    return { status: "error", message: "A report was selected more than once. Refresh and try again." };
  }

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("delete_resolved_user_reports", {
    p_report_ids: uniqueReportIds,
  });
  if (error) {
    console.error("Admin report deletion failed", { code: error.code, message: error.message });

    if (error.code === "PGRST202" || error.message.includes("delete_resolved_user_reports")) {
      return { status: "error", message: "The report deletion setup is missing. Apply migration 202610180009_delete_resolved_reports.sql, then refresh the page." };
    }
    if (error.message.includes("Only reports marked resolved")) {
      return { status: "error", message: "Only resolved reports can be deleted. Refresh the page and try again." };
    }
    if (error.message.includes("Suspended administrators")) {
      return { status: "error", message: "A suspended administrator account cannot delete reports." };
    }
    if (error.message.includes("Administrator access required")) {
      return { status: "error", message: "Administrator access is required. Sign in again with your admin account." };
    }

    const detail = process.env.NODE_ENV === "development" ? ` (${error.code}: ${error.message})` : "";
    return { status: "error", message: `Could not delete the selected reports. Please refresh and try again${detail}.` };
  }
  if (!isDeleteResult(data)) {
    console.error("Admin report deletion returned an unexpected response.");
    return { status: "error", message: "The server returned an unexpected deletion result. Refresh the page and try again." };
  }

  let cleanupWarning = "";
  if (data.screenshotPaths.length > 0) {
    const { error: cleanupError } = await supabase.storage
      .from("user-report-screenshots")
      .remove(data.screenshotPaths);
    if (cleanupError) cleanupWarning = " Attached screenshots could not all be removed from storage.";
  }

  revalidatePath("/admin/reports");
  revalidatePath("/admin/activity-log");
  revalidatePath("/admin");
  revalidatePath("/admin/alerts");

  return {
    status: "success",
    message: `${data.deletedCount} resolved report${data.deletedCount === 1 ? " was" : "s were"} deleted.${cleanupWarning}`,
  };
}
