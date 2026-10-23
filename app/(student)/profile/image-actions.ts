"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prepareProfileImage } from "@/lib/profile-images";

export type ImageState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function saveProfileImage(
  _previous: ImageState,
  form: FormData,
): Promise<ImageState> {
  const kind = form.get("kind");
  const groupId = form.get("groupId");
  const remove = form.get("remove") === "true";
  if (kind !== "avatar" && kind !== "cover")
    return { status: "error", message: "Choose a photo type." };
  if (
    groupId !== null &&
    (typeof groupId !== "string" ||
      !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(groupId))
  ) {
    return { status: "error", message: "Invalid group." };
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return { status: "error", message: "Please log in again." };
    if (groupId) {
      const { data, error } = await supabase
        .from("study_groups")
        .select("owner_id")
        .eq("id", groupId)
        .maybeSingle();
      if (error || data?.owner_id !== user.id)
        return {
          status: "error",
          message: "Only the group owner can edit its photos.",
        };
    }
    const bucket = groupId ? "study-group-avatars" : "profile-images";
    let path: string | null = null;
    if (!remove) {
      let bytes: Buffer;
      try {
        bytes = await prepareProfileImage(form.get("photo"), kind);
      } catch (error) {
        return {
          status: "error",
          message: error instanceof Error ? error.message : "Invalid photo.",
        };
      }
      path = `${user.id}/${groupId ? `${groupId}/` : ""}${crypto.randomUUID()}.webp`;
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, bytes, { contentType: "image/webp", upsert: false });
      if (error)
        return {
          status: "error",
          message:
            "Could not upload your photo. Check the image storage migration and try again.",
        };
    }
    const result = groupId
      ? await supabase.rpc("set_study_group_image", {
          p_group_id: groupId,
          p_kind: kind,
          p_path: path,
        })
      : await supabase.rpc("set_profile_image", { p_kind: kind, p_path: path });
    // A network error can occur after commit: keep the new upload on uncertain saves.
    if (result.error)
      return {
        status: "error",
        message:
          "Could not confirm the photo save. Refresh to check before retrying.",
      };
    if (typeof result.data === "string" && result.data !== path) {
      try {
        await supabase.storage.from(bucket).remove([result.data]);
      } catch {
        /* A saved photo stays usable if cleanup fails. */
      }
    }
    revalidatePath("/", "layout");
    return {
      status: "success",
      message: remove ? "Photo removed." : "Photo saved.",
    };
  } catch {
    return {
      status: "error",
      message:
        "Connection interrupted. Refresh to check your photo before retrying.",
    };
  }
}
