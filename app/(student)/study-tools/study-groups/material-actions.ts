"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type MaterialShareState = {
  status: "idle" | "error" | "success";
  message: string;
  materialId?: string;
};

const validId =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function shareGroupMaterial(
  _previous: MaterialShareState,
  form: FormData,
): Promise<MaterialShareState> {
  let groupId: string;
  let materialId: string;

  try {
    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError || !data.user) {
      return { status: "error", message: "Please log in to share a material." };
    }

    const groupInput = form.get("groupId");
    const sourceInput = form.get("studySetId");
    if (
      typeof groupInput !== "string" ||
      !validId.test(groupInput) ||
      typeof sourceInput !== "string" ||
      !validId.test(sourceInput) ||
      form.get("confirmShare") !== "on"
    ) {
      return {
        status: "error",
        message: "Choose a material and confirm sharing a copy.",
      };
    }

    groupId = groupInput;
    // SQL checks membership and source ownership; the browser sends no content.
    const { data: savedId, error } = await supabase.rpc(
      "share_study_group_material",
      {
        p_group_id: groupId,
        p_study_set_id: sourceInput,
      },
    );
    if (error || typeof savedId !== "string" || !validId.test(savedId)) {
      return {
        status: "error",
        message:
          "Sharing was not confirmed. Check the group's materials before trying again.",
      };
    }
    materialId = savedId;
  } catch {
    return {
      status: "error",
      message:
        "Connection interrupted. Check the group's materials before trying again.",
    };
  }

  try {
    revalidatePath(`/study-tools/study-groups/${groupId}`);
  } catch {
    return {
      status: "success",
      message: "Your group copy is available. Refresh to update the list.",
      materialId,
    };
  }
  return {
    status: "success",
    message:
      "Your group copy is available. If already shared, the existing copy was kept.",
    materialId,
  };
}

export async function removeGroupMaterial(
  _previous: MaterialShareState,
  form: FormData,
): Promise<MaterialShareState> {
  let groupId: string;
  let materialId: string;

  try {
    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError || !data.user) {
      return {
        status: "error",
        message: "Please log in to remove a shared material.",
      };
    }
    const groupInput = form.get("groupId");
    const materialInput = form.get("materialId");
    if (
      typeof groupInput !== "string" ||
      !validId.test(groupInput) ||
      typeof materialInput !== "string" ||
      !validId.test(materialInput)
    ) {
      return { status: "error", message: "Choose a valid group material." };
    }
    groupId = groupInput;
    materialId = materialInput;
    const { error } = await supabase.rpc("remove_study_group_material", {
      p_group_id: groupId,
      p_material_id: materialId,
    });
    if (error) {
      return {
        status: "error",
        message:
          "Could not remove this copy. Only its sharer or the group owner can remove it.",
      };
    }
  } catch {
    return {
      status: "error",
      message:
        "Connection interrupted. Refresh the materials list to check the removal.",
    };
  }

  try {
    revalidatePath(`/study-tools/study-groups/${groupId}`);
    revalidatePath(
      `/study-tools/study-groups/${groupId}/materials/${materialId}`,
    );
  } catch {
    return {
      status: "success",
      message: "Group copy removed. Refresh to update the list.",
    };
  }
  return {
    status: "success",
    message: "Group copy removed. Your original Library material is unchanged.",
  };
}
