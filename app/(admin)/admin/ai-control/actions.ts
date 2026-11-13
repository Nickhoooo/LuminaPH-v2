"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import { previewAiPrompt } from "@/lib/ai/prompt-preview";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pagePath = "/admin/ai-control";
const toolKeys = new Set([
  "study_guide", "flashcards", "quiz", "group_quiz", "tutor",
  "learning_path", "group_lesson",
]);

function finish(status: "saved" | "error"): never {
  revalidatePath(pagePath);
  redirect(`${pagePath}?status=${status}`);
}

export async function addAiModel(formData: FormData) {
  const { supabase } = await requireAdmin();
  const provider = formData.get("provider");
  const modelId = formData.get("modelId");
  const displayName = formData.get("displayName");

  if (provider !== "groq" && provider !== "google") finish("error");
  if (typeof modelId !== "string" || typeof displayName !== "string") finish("error");
  const cleanModelId = modelId.trim();
  const cleanDisplayName = displayName.trim();
  if (
    cleanModelId.length < 1 || cleanModelId.length > 160 ||
    !/^[A-Za-z0-9._/-]+$/.test(cleanModelId) ||
    cleanDisplayName.length < 1 || cleanDisplayName.length > 100
  ) finish("error");

  const { error } = await supabase.rpc("add_ai_model", {
    p_provider: provider,
    p_model_id: cleanModelId,
    p_display_name: cleanDisplayName,
  });
  finish(error ? "error" : "saved");
}

export async function activateAiModel(formData: FormData) {
  const { supabase } = await requireAdmin();
  const modelId = formData.get("modelId");
  if (typeof modelId !== "string" || !UUID_PATTERN.test(modelId)) finish("error");

  const { error } = await supabase.rpc("activate_ai_model", { p_model_id: modelId });
  finish(error ? "error" : "saved");
}

export async function setAiModelEnabled(formData: FormData) {
  const { supabase } = await requireAdmin();
  const modelId = formData.get("modelId");
  const enabledValue = formData.get("enabled");
  if (typeof modelId !== "string" || !UUID_PATTERN.test(modelId)) finish("error");
  if (enabledValue !== "true" && enabledValue !== "false") finish("error");

  const { error } = await supabase.rpc("set_ai_model_enabled", {
    p_model_id: modelId,
    p_enabled: enabledValue === "true",
  });
  finish(error ? "error" : "saved");
}

export async function deleteAiModel(formData: FormData) {
  const { supabase } = await requireAdmin();
  const modelId = formData.get("modelId");
  if (typeof modelId !== "string" || !UUID_PATTERN.test(modelId)) finish("error");

  const { error } = await supabase.rpc("delete_ai_model", { p_model_id: modelId });
  finish(error ? "error" : "saved");
}

export async function setAiToolRoute(formData: FormData) {
  const { supabase } = await requireAdmin();
  const toolKey = formData.get("toolKey");
  const primaryModelId = formData.get("primaryModelId");
  const fallbackValue = formData.get("fallbackModelId");
  if (typeof toolKey !== "string" || !toolKeys.has(toolKey)) finish("error");
  if (typeof primaryModelId !== "string" || !UUID_PATTERN.test(primaryModelId)) finish("error");
  if (typeof fallbackValue !== "string") finish("error");
  if (fallbackValue !== "" && (!UUID_PATTERN.test(fallbackValue) || fallbackValue === primaryModelId)) finish("error");

  const { error } = await supabase.rpc("set_ai_tool_route", {
    p_tool_key: toolKey,
    p_primary_model_id: primaryModelId,
    p_fallback_model_id: fallbackValue || null,
  });
  finish(error ? "error" : "saved");
}

export type PromptActionState = {
  status: "idle" | "success" | "error";
  message: string;
  draftId?: string;
  version?: number;
  tested?: boolean;
  preview?: string;
  savedPrompt?: string;
};

function isPromptDraftResult(value: unknown): value is { id: string; version: number; tested: boolean } {
  return typeof value === "object" && value !== null &&
    "id" in value && typeof value.id === "string" &&
    "version" in value && typeof value.version === "number" &&
    "tested" in value && typeof value.tested === "boolean";
}

function isPromptMigrationMissing(code: string | undefined) {
  return code === "PGRST202" || code === "42883";
}

function logPromptPreviewFailure(toolKey: string, error: unknown) {
  const details = typeof error === "object" && error !== null
    ? error as { name?: unknown; message?: unknown; status?: unknown; code?: unknown }
    : {};
  const safePreviewMessages = new Set([
    "The prompt preview did not return a complete response.",
    "The prompt preview returned empty or oversized output.",
    "The preview ran, but its result could not be recorded.",
  ]);

  console.error("[AI Control] Prompt preview failed", JSON.stringify({
    toolKey,
    errorName: typeof details.name === "string" ? details.name : undefined,
    providerStatus: typeof details.status === "number" ? details.status : undefined,
    providerCode: typeof details.code === "string" ? details.code : undefined,
    safeReason: typeof details.message === "string" && safePreviewMessages.has(details.message)
      ? details.message
      : undefined,
  }));
}

export async function manageAiPrompt(
  _previousState: PromptActionState,
  formData: FormData,
): Promise<PromptActionState> {
  const { supabase } = await requireAdmin();
  const toolKey = formData.get("toolKey");
  const intent = formData.get("intent");
  if (typeof toolKey !== "string" || !toolKeys.has(toolKey)) {
    return { status: "error", message: "Choose a valid AI tool." };
  }
  if (typeof intent !== "string" || !["save", "test", "publish", "rollback"].includes(intent)) {
    return { status: "error", message: "Choose a valid prompt action." };
  }

  if (intent === "save" || intent === "test") {
    const promptText = formData.get("prompt");
    if (typeof promptText !== "string") {
      return { status: "error", message: "Enter prompt guidance before saving." };
    }
    const cleanPrompt = promptText.trim();
    if (cleanPrompt.length < 1 || cleanPrompt.length > 6000) {
      return { status: "error", message: "Prompt guidance must contain 1 to 6000 characters." };
    }

    const { data, error } = await supabase.rpc("save_ai_prompt_draft", {
      p_tool_key: toolKey,
      p_prompt_text: cleanPrompt,
    });
    if (error) {
      return {
        status: "error",
        message: isPromptMigrationMissing(error.code)
          ? "Prompt versioning is not installed yet. Apply the new prompt versioning migration."
          : "Could not save the prompt draft. Check Super Admin access and try again.",
      };
    }
    if (!isPromptDraftResult(data)) {
      return { status: "error", message: "The saved draft could not be confirmed. Refresh and check the prompt versions." };
    }

    if (intent === "save") {
      revalidatePath(pagePath);
      return {
        status: "success",
        message: `Saved draft version ${data.version}. Test it before publishing.`,
        draftId: data.id,
        version: data.version,
        tested: false,
        savedPrompt: cleanPrompt,
      };
    }

    let previewResult: Awaited<ReturnType<typeof previewAiPrompt>>;
    try {
      previewResult = await previewAiPrompt(toolKey as import("@/lib/ai/groq").AiToolKey, cleanPrompt);
    } catch (previewError) {
      logPromptPreviewFailure(toolKey, previewError);
      await supabase.rpc("mark_ai_prompt_test", {
        p_tool_key: toolKey,
        p_version_id: data.id,
        p_passed: false,
      });
      revalidatePath(pagePath);
      return {
        status: "error",
        message: "The prompt preview failed or could not be recorded. The draft remains unpublished; try again later.",
        draftId: data.id,
        version: data.version,
        tested: false,
        savedPrompt: cleanPrompt,
      };
    }

    const { error: markError } = await supabase.rpc("mark_ai_prompt_test", {
      p_tool_key: toolKey,
      p_version_id: data.id,
      p_passed: true,
      p_model: previewResult.model,
    });
    if (markError) {
      logPromptPreviewFailure(toolKey, {
        name: "PromptTestRecordError",
        message: "The preview ran, but its result could not be recorded.",
        code: markError.code,
      });
      revalidatePath(pagePath);
      return {
        status: "error",
        message: "The preview ran, but Supabase could not record it. The draft remains unpublished.",
        draftId: data.id,
        version: data.version,
        tested: false,
        savedPrompt: cleanPrompt,
      };
    }
    revalidatePath(pagePath);
    return {
      status: "success",
      message: `Draft version ${data.version} passed its sample preview using ${previewResult.model}.`,
      draftId: data.id,
      version: data.version,
      tested: true,
      preview: previewResult.preview,
      savedPrompt: cleanPrompt,
    };
  }

  if (intent === "publish") {
    const versionId = formData.get("versionId");
    if (typeof versionId !== "string" || !UUID_PATTERN.test(versionId)) {
      return { status: "error", message: "Save and test a draft before publishing." };
    }
    const { data, error } = await supabase.rpc("publish_ai_prompt", {
      p_tool_key: toolKey,
      p_version_id: versionId,
    });
    if (error) {
      return {
        status: "error",
        message: isPromptMigrationMissing(error.code)
          ? "Prompt versioning is not installed yet. Apply the new prompt versioning migration."
          : "Only a successfully tested draft can be published.",
      };
    }
    revalidatePath(pagePath);
    return { status: "success", message: `Published prompt version ${data}.` };
  }

  const { data, error } = await supabase.rpc("rollback_ai_prompt", { p_tool_key: toolKey });
  if (error) {
    return {
      status: "error",
      message: isPromptMigrationMissing(error.code)
        ? "Prompt versioning is not installed yet. Apply the new prompt versioning migration."
        : "There is no previous published version to restore.",
    };
  }
  revalidatePath(pagePath);
  return { status: "success", message: `Restored prompt version ${data}.` };
}
