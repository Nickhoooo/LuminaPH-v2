"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ReportState = { status: "idle" | "success" | "error"; message: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const categories = ["bug", "ai_quality", "account", "group", "suggestion", "other"];
const screenshotTypes = ["image/jpeg", "image/png", "image/webp"];
const screenshotLimit = 5 * 1024 * 1024;

export async function submitReport(_previous: ReportState, formData: FormData): Promise<ReportState> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { status: "error", message: "Please log in again before sending feedback." };

  const requestId = formData.get("requestId");
  const category = formData.get("category");
  const title = formData.get("title");
  const message = formData.get("message");
  const screenshotValue = formData.get("screenshot");
  let screenshot: File | null = null;
  if (screenshotValue !== null && !(screenshotValue instanceof File)) {
    return { status: "error", message: "Choose a valid image file." };
  }
  if (screenshotValue instanceof File && screenshotValue.size > 0) {
    if (!screenshotTypes.includes(screenshotValue.type)) {
      return { status: "error", message: "Screenshots must be JPG, PNG, or WebP images." };
    }
    if (screenshotValue.size > screenshotLimit) {
      return { status: "error", message: "The screenshot must be 5 MB or smaller." };
    }
    screenshot = screenshotValue;
  }
  if (typeof requestId !== "string" || !uuidPattern.test(requestId)) {
    return { status: "error", message: "Refresh the page and try again." };
  }
  if (typeof category !== "string" || !categories.includes(category)) {
    return { status: "error", message: "Choose a valid category." };
  }
  if (typeof title !== "string" || title.trim().length < 4 || title.length > 120) {
    return { status: "error", message: "The title must contain 4 to 120 characters." };
  }
  if (typeof message !== "string" || message.trim().length < 10 || message.length > 4000) {
    return { status: "error", message: "Details must contain 10 to 4,000 characters." };
  }

  const { data: reportId, error } = await supabase.rpc("submit_user_report", {
    p_request_id: requestId,
    p_category: category,
    p_title: title.trim(),
    p_message: message.trim(),
  });
  if (error) {
    if (error.message.includes("wait a minute")) return { status: "error", message: "Please wait a minute before sending another report." };
    if (error.message.includes("limit for today")) return { status: "error", message: "You have reached the report limit for today." };
    if (error.message.includes("suspended")) return { status: "error", message: "This account cannot submit feedback right now." };
    return { status: "error", message: "We could not send your feedback. Please try again." };
  }

  if (typeof reportId !== "string" || !uuidPattern.test(reportId)) {
    return { status: "error", message: "Your report may have been saved. Refresh and check your report history." };
  }

  if (screenshot) {
    const { data: savedReport, error: lookupError } = await supabase
      .from("user_reports")
      .select("screenshot_path")
      .eq("id", reportId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (lookupError || !savedReport) {
      return { status: "error", message: "Your report was saved, but we could not attach its screenshot. Retry to finish the upload." };
    }

    if (!savedReport.screenshot_path) {
      const screenshotPath = `${user.id}/${reportId}/screenshot`;
      const { error: uploadError } = await supabase.storage
        .from("user-report-screenshots")
        .upload(screenshotPath, screenshot, {
          contentType: screenshot.type,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        // A retry may find the same file already uploaded before a timeout.
        const { error: attachError } = await supabase.rpc("attach_user_report_screenshot", {
          p_report_id: reportId,
          p_screenshot_path: screenshotPath,
        });
        if (attachError) {
          return { status: "error", message: "Your report was saved, but its screenshot did not upload. Retry to try the screenshot again." };
        }
      } else {
        const { error: attachError } = await supabase.rpc("attach_user_report_screenshot", {
          p_report_id: reportId,
          p_screenshot_path: screenshotPath,
        });
        if (attachError) {
          await supabase.storage.from("user-report-screenshots").remove([screenshotPath]);
          return { status: "error", message: "Your report was saved, but we could not attach the screenshot. Retry to try again." };
        }
      }
    }
  }

  revalidatePath("/feedback");
  let successMessage = "Thanks. Your feedback was sent to the LuminaPH team.";
  if (screenshot) successMessage = "Thanks. Your report and screenshot were sent to the LuminaPH team.";
  return { status: "success", message: successMessage };
}
