"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { avatarBucket, validateGroupAvatar } from "./group-avatar";

export type StudyGroupState = {
  status: "idle" | "error" | "success";
  message: string;
  groupId?: string;
};

export type InviteCodeState = StudyGroupState & {
  inviteCode?: string;
  needsRefresh?: boolean;
};

export async function regenerateStudyGroupInvite(
  _previousState: InviteCodeState,
  formData: FormData,
): Promise<InviteCodeState> {
  let groupId: string;
  let inviteCode: string;

  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return {
        status: "error",
        message: "Please log in before changing the invite code.",
      };
    }

    const groupIdInput = formData.get("groupId");
    const validId =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof groupIdInput !== "string" || !validId.test(groupIdInput)) {
      return { status: "error", message: "Please select a valid group." };
    }

    groupId = groupIdInput;
    // The SQL function verifies ownership and replaces the code atomically.
    const { data, error } = await supabase.rpc(
      "regenerate_study_group_invite",
      {
        p_group_id: groupId,
      },
    );
    if (error || typeof data !== "string" || !/^[A-Z]{6}$/.test(data)) {
      return {
        status: "error",
        message:
          "Code change not confirmed. Reload to check the current code before sharing or trying again.",
        needsRefresh: true,
      };
    }
    inviteCode = data;
  } catch {
    return {
      status: "error",
      message:
        "Connection interrupted. Reload to check the current invite code.",
      needsRefresh: true,
    };
  }

  try {
    revalidatePath(`/study-tools/study-groups/${groupId}`);
  } catch {
    // The returned code is still valid even if refreshing the page fails.
    return {
      status: "success",
      message: "Invite code changed. Copy the new code below.",
      inviteCode,
    };
  }
  return {
    status: "success",
    message: "Invite code changed. The previous code no longer works.",
    inviteCode,
  };
}

export async function removeStudyGroupMember(
  _previousState: StudyGroupState,
  formData: FormData,
): Promise<StudyGroupState> {
  let groupId: string;

  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return {
        status: "error",
        message: "Please log in before removing a member.",
      };
    }

    const groupIdInput = formData.get("groupId");
    const memberIdInput = formData.get("memberId");
    const validId =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (
      typeof groupIdInput !== "string" ||
      typeof memberIdInput !== "string" ||
      !validId.test(groupIdInput) ||
      !validId.test(memberIdInput)
    ) {
      return {
        status: "error",
        message: "Please select a valid group and member.",
      };
    }

    groupId = groupIdInput;
    // The database verifies ownership and protects the owner's membership.
    const { error: removeError } = await supabase.rpc(
      "remove_study_group_member",
      {
        p_group_id: groupId,
        p_member_id: memberIdInput,
      },
    );

    if (removeError) {
      return {
        status: "error",
        message:
          "We could not remove this member. Only the group owner can remove other members.",
      };
    }
  } catch {
    return {
      status: "error",
      message:
        "Connection interrupted. Refresh the member list to check whether the member was removed.",
    };
  }

  try {
    revalidatePath(`/study-tools/study-groups/${groupId}`);
  } catch {
    return {
      status: "success",
      message: "Member removed. Refresh the page to update the list.",
    };
  }

  return { status: "success", message: "Member removed from the group." };
}

export async function leaveStudyGroup(
  _previousState: StudyGroupState,
  formData: FormData,
): Promise<StudyGroupState> {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return {
        status: "error",
        message: "Please log in before leaving a group.",
      };
    }

    const groupId = formData.get("groupId");
    const validId =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (typeof groupId !== "string" || !validId.test(groupId)) {
      return { status: "error", message: "Please select a valid group." };
    }

    // The database identifies the caller and prevents owners from leaving.
    const { error: leaveError } = await supabase.rpc("leave_study_group", {
      p_group_id: groupId,
    });

    if (leaveError) {
      return {
        status: "error",
        message:
          "We could not leave this group. Owners cannot leave their own group.",
      };
    }
  } catch {
    return {
      status: "error",
      message:
        "Connection interrupted. Check My Groups to confirm whether you left.",
    };
  }

  // Membership is gone: navigate in the action response before rendering
  // the now-inaccessible group page. Redirect must stay outside try/catch.
  try {
    revalidatePath("/", "layout");
  } catch {
    console.warn("Group left, but the group list could not be revalidated.");
  }
  redirect("/study-tools/study-groups", RedirectType.replace);
}

export async function createStudyGroup(
  _previousState: StudyGroupState,
  formData: FormData,
): Promise<StudyGroupState> {
  try {
    const supabase = await createClient();

    const { data, error: authError } = await supabase.auth.getUser();

    if (authError || !data.user) {
      return {
        status: "error",
        message: "Please log in before creating a study group.",
      };
    }

    const nameInput = formData.get("name");
    const descriptionInput = formData.get("description") ?? "";

    if (typeof nameInput !== "string" || typeof descriptionInput !== "string") {
      return {
        status: "error",
        message: "Please provide valid group details.",
      };
    }

    const name = nameInput.trim();
    const description = descriptionInput.trim();
    let avatar: Awaited<ReturnType<typeof validateGroupAvatar>>;
    try {
      avatar = await validateGroupAvatar(formData.get("avatar"));
    } catch (error) {
      return {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Please choose a valid image.",
      };
    }

    if (name.length < 1 || name.length > 80) {
      return {
        status: "error",
        message: "Group name must contain 1–80 characters.",
      };
    }

    if (description.length > 500) {
      return {
        status: "error",
        message: "Description must not exceed 500 characters.",
      };
    }

    const { data: groupId, error: createError } = await supabase.rpc(
      "create_study_group",
      {
        p_name: name,
        p_description: description,
      },
    );

    if (createError || typeof groupId !== "string") {
      return {
        status: "error",
        message:
          "We could not confirm creation. Check your groups before trying again.",
      };
    }

    let imageSaved = true;
    if (avatar) {
      const path = `${data.user.id}/${groupId}/${crypto.randomUUID()}.${avatar.extension}`;
      try {
        const { error: uploadError } = await supabase.storage
          .from(avatarBucket)
          .upload(path, avatar.bytes, { contentType: avatar.contentType });
        if (uploadError) throw uploadError;
        const { error: saveError } = await supabase.rpc(
          "set_study_group_avatar",
          { p_group_id: groupId, p_path: path },
        );
        if (saveError) {
          await supabase.storage.from(avatarBucket).remove([path]);
          throw saveError;
        }
      } catch {
        imageSaved = false;
      }
    }

    try {
      revalidatePath("/", "layout");
    } catch {
      return {
        status: "success",
        message:
          "Your group was created. Refresh the page to update your list.",
        groupId,
      };
    }

    return {
      status: "success",
      message: imageSaved
        ? "Your study group is ready."
        : "Group created, but the image could not be saved. Your group uses its initial instead.",
      groupId,
    };
  } catch {
    return {
      status: "error",
      message: "Connection interrupted. Check your groups before trying again.",
    };
  }
}

export async function joinStudyGroup(
  _previousState: StudyGroupState,
  formData: FormData,
): Promise<StudyGroupState> {
  try {
    const supabase = await createClient();

    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return {
        status: "error",
        message: "Please log in before joining a study group.",
      };
    }

    const codeInput = formData.get("inviteCode");

    if (typeof codeInput !== "string") {
      return {
        status: "error",
        message: "Please enter an invite code.",
      };
    }

    const inviteCode = codeInput.trim().toUpperCase();

    if (!/^[A-Z]{6}$/.test(inviteCode)) {
      return {
        status: "error",
        message: "Enter the six-letter invite code.",
      };
    }

    const { data: result, error: joinError } = await supabase.rpc(
      "join_study_group",
      {
        p_invite_code: inviteCode,
      },
    );

    if (joinError || !result || typeof result !== "object") {
      return {
        status: "error",
        message: "We could not confirm your request. Check your groups.",
      };
    }

    if (result.status === "unauthorized") {
      return {
        status: "error",
        message: "Please log in again.",
      };
    }

    if (result.status === "rate_limited") {
      return {
        status: "error",
        message: "Too many incorrect codes. Please try again in 15 minutes.",
      };
    }

    if (result.status === "invalid_code") {
      return {
        status: "error",
        message: "Code not found. Check the code with your group owner.",
      };
    }

    if (result.status !== "success" || typeof result.groupId !== "string") {
      return {
        status: "error",
        message: "We could not confirm your membership. Check your groups.",
      };
    }

    try {
      revalidatePath("/", "layout");
    } catch {
      return {
        status: "success",
        message: "You are a member. Refresh the page to update your groups.",
        groupId: result.groupId,
      };
    }

    return {
      status: "success",
      message: "You are now a member of this group.",
      groupId: result.groupId,
    };
  } catch {
    return {
      status: "error",
      message: "Connection interrupted. Check your groups before retrying.",
    };
  }
}

export async function deleteStudyGroup(
  _previousState: StudyGroupState,
  formData: FormData,
): Promise<StudyGroupState> {
  const groupId = formData.get("groupId");
  const confirmation = formData.get("confirmation");
  if (
    typeof groupId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      groupId,
    ) ||
    typeof confirmation !== "string" ||
    !confirmation ||
    confirmation.length > 80
  ) {
    return {
      status: "error",
      message: "Enter the group name to confirm deletion.",
    };
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return { status: "error", message: "Please log in again." };
    const { data: group, error: loadError } = await supabase
      .from("study_groups")
      .select("name, owner_id, avatar_path")
      .eq("id", groupId)
      .maybeSingle();
    if (loadError)
      return {
        status: "error",
        message: "Could not check this group. Please retry.",
      };
    if (group && (group.owner_id !== user.id || group.name !== confirmation)) {
      return {
        status: "error",
        message: "Only the owner can delete this group. Type its name exactly.",
      };
    }
    const { error } = await supabase.rpc("delete_study_group", {
      p_group_id: groupId,
      p_confirmation: confirmation,
    });
    if (error)
      return {
        status: "error",
        message: "Could not confirm deletion. Check My Groups before retrying.",
      };
    // Database deletion has succeeded. Storage cleanup must not undo navigation.
    if (group?.avatar_path) {
      try {
        const { error: cleanupError } = await supabase.storage
          .from(avatarBucket)
          .remove([group.avatar_path]);
        if (cleanupError)
          console.warn("Group deleted; avatar cleanup needs retry.");
      } catch {
        console.warn("Group deleted; avatar cleanup needs retry.");
      }
    }
  } catch {
    return {
      status: "error",
      message: "Connection interrupted. Check My Groups to confirm deletion.",
    };
  }
  try {
    revalidatePath("/", "layout");
  } catch {
    console.warn("Group deleted, but navigation data could not be refreshed.");
  }
  redirect("/study-tools/study-groups", RedirectType.replace);
}
