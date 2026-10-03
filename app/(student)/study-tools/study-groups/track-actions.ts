"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase/server";
import {
  generateLearningPathOutline,
  validateLearningPathOutline,
  type LearningPathOutline,
} from "@/lib/ai/learning-paths";

type TrackDetails = {
  subject: string;
  learningGoal: string;
  educationLevel: string;
  academicDetails: string;
  language: "english" | "filipino" | "taglish";
};

export type GroupTrackDraft = TrackDetails & {
  groupId: string;
  requestId: string;
  outline: LearningPathOutline;
};

export type GroupTrackState = {
  status: "idle" | "error" | "success";
  message: string;
  draft?: GroupTrackDraft;
  trackId?: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readId(value: unknown): string {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new Error("Invalid ID.");
  }
  return value;
}

function readDetails(value: Record<string, unknown>): TrackDetails {
  const { subject, learningGoal, educationLevel, academicDetails, language } =
    value;
  if (
    typeof subject !== "string" ||
    !subject.trim() ||
    subject.trim().length > 120 ||
    typeof learningGoal !== "string" ||
    !learningGoal.trim() ||
    learningGoal.trim().length > 1000 ||
    typeof academicDetails !== "string" ||
    academicDetails.trim().length > 120 ||
    typeof educationLevel !== "string" ||
    !["junior-high", "senior-high", "college", "independent"].includes(
      educationLevel,
    ) ||
    (language !== "english" &&
      language !== "filipino" &&
      language !== "taglish")
  ) {
    throw new Error("Invalid study details.");
  }
  return {
    subject: subject.trim(),
    learningGoal: learningGoal.trim(),
    educationLevel,
    academicDetails: academicDetails.trim(),
    language,
  };
}

// RLS verifies membership; explicitly verify ownership before spending AI quota.
async function getOwnerClient(groupId: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Authentication required.");

  const { data: group, error } = await supabase
    .from("study_groups")
    .select("id, owner_id")
    .eq("id", groupId)
    .maybeSingle();
  if (error || !group || group.owner_id !== user.id) {
    throw new Error("Group owner required.");
  }
  return supabase;
}

export async function generateGroupTrackOutline(
  _previous: GroupTrackState,
  form: FormData,
): Promise<GroupTrackState> {
  let groupId: string;
  let details: TrackDetails;
  try {
    groupId = readId(form.get("groupId"));
    details = readDetails({
      subject: form.get("subject"),
      learningGoal: form.get("learningGoal"),
      educationLevel: form.get("educationLevel"),
      academicDetails: form.get("academicDetails") ?? "",
      language: form.get("language"),
    });
  } catch {
    return {
      status: "error",
      message:
        "Check the group, subject, learning goal, education level, and language. Keep the subject under 121 characters and goal under 1,001 characters.",
    };
  }

  try {
    const supabase = await getOwnerClient(groupId);
    const { data: existing, error } = await supabase
      .from("group_study_tracks")
      .select("id")
      .eq("group_id", groupId)
      .maybeSingle();
    if (error) {
      return {
        status: "error",
        message:
          "Could not check the group's saved track. Refresh before generating.",
      };
    }
    if (existing) {
      return {
        status: "success",
        message: "This group already has a saved study track.",
        trackId: existing.id,
      };
    }
    if (!process.env.GROQ_API_KEY?.trim()) {
      return {
        status: "error",
        message: "Study track generation is temporarily unavailable.",
      };
    }

    const { data: allowance, error: allowanceError } = await supabase.rpc(
      "reserve_ai_generation",
    );
    if (allowanceError) {
      return {
        status: "error",
        message: "Could not check your generation allowance. Try again later.",
      };
    }
    if (allowance !== "allowed") {
      const messages: Record<string, string> = {
        unauthorized: "Please log in again.",
        cooldown:
          "Please wait at least 60 seconds between generation attempts.",
        user_limit:
          "You have used your 5 generation attempts in the last 24 hours.",
        app_limit:
          "LuminaPH has reached its shared allowance. Try again later.",
      };
      return {
        status: "error",
        message:
          messages[String(allowance)] ??
          "Could not confirm your generation allowance.",
      };
    }

    try {
      // Reuse the existing AI generator, fixing the shared track at five lessons.
      const generated = await generateLearningPathOutline({
        ...details,
        lessonCount: 5,
      });
      const outline = validateLearningPathOutline(generated, 5);
      return {
        status: "success",
        message:
          "Review the five-lesson outline, then save it for your group. It has not been saved yet.",
        draft: { ...details, groupId, requestId: randomUUID(), outline },
      };
    } catch (error) {
      return {
        status: "error",
        message:
          error instanceof Groq.APIError && error.status === 429
            ? "The AI provider's free allowance is unavailable. Try again later. This attempt counts toward your limit."
            : "Could not generate a complete five-lesson outline. This attempt counts toward your limit.",
      };
    }
  } catch {
    return {
      status: "error",
      message:
        "Could not complete the request. Make sure you are logged in as the group owner, then refresh before retrying. A generation attempt may have counted.",
    };
  }
}

export async function saveGroupTrackOutline(
  _previous: GroupTrackState,
  form: FormData,
): Promise<GroupTrackState> {
  let draft: GroupTrackDraft;
  try {
    const raw = form.get("draft");
    if (typeof raw !== "string" || raw.length > 20000)
      throw new Error("Invalid draft.");
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Invalid draft.");
    }
    // Browser state is untrusted. Revalidate IDs, study details and all five lessons.
    const input = value as Record<string, unknown>;
    draft = {
      ...readDetails(input),
      groupId: readId(input.groupId),
      requestId: readId(input.requestId),
      outline: validateLearningPathOutline(input.outline, 5),
    };
  } catch {
    return {
      status: "error",
      message:
        "This outline is incomplete or invalid. Review the five lessons and study details before saving.",
    };
  }

  let trackId: string;
  try {
    const supabase = await getOwnerClient(draft.groupId);
    // No AI request or quota reservation on save/retry. SQL checks ownership again.
    const { data, error } = await supabase.rpc("create_group_study_track", {
      p_request_id: draft.requestId,
      p_group_id: draft.groupId,
      p_title: draft.outline.title,
      p_subject: draft.subject,
      p_learning_goal: draft.learningGoal,
      p_education_level: draft.educationLevel,
      p_academic_details: draft.academicDetails,
      p_language: draft.language,
      p_lessons: draft.outline.lessons,
    });
    if (error || data !== draft.requestId)
      throw new Error("Save not confirmed.");
    trackId = draft.requestId;
  } catch {
    return {
      status: "error",
      message:
        "Saving was not confirmed. Keep this outline and check the group dashboard. If no track is visible and you are still the owner, retry saving this same outline without generating again.",
      draft,
    };
  }

  try {
    revalidatePath(`/study-tools/study-groups/${draft.groupId}`);
    revalidatePath("/study-tools/study-groups");
  } catch {
    return {
      status: "success",
      message: "Study track saved. Refresh the group dashboard to see it.",
      trackId,
    };
  }
  return {
    status: "success",
    message:
      "Shared study track saved with five lesson and quiz slots. Generate each activity's content separately.",
    trackId,
  };
}
