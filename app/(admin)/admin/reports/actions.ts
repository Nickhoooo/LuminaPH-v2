"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";

export type ReviewReportState = { status: "idle" | "success" | "error"; message: string };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function updateReport(_previous: ReviewReportState, formData: FormData): Promise<ReviewReportState> {
  const reportId = formData.get("reportId");
  const status = formData.get("status");
  const response = formData.get("response");
  if (typeof reportId !== "string" || !uuidPattern.test(reportId)) {
    return { status: "error", message: "This report is unavailable. Refresh the page." };
  }
  if (status !== "new" && status !== "in_review" && status !== "resolved") {
    return { status: "error", message: "Choose a valid report status." };
  }
  if (typeof response !== "string" || response.length > 2000) {
    return { status: "error", message: "The reply can contain at most 2,000 characters." };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("update_user_report", {
    p_report_id: reportId,
    p_status: status,
    p_response: response.trim() || null,
  });
  if (error) return { status: "error", message: "Could not update this report. Check your access and try again." };

  revalidatePath("/admin/reports");
  revalidatePath("/admin/activity-log");
  revalidatePath("/admin");
  revalidatePath("/feedback");
  revalidatePath("/notifications");
  return { status: "success", message: "Report updated and the user was notified." };
}
