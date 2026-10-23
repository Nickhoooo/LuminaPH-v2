import "server-only";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";

export async function prepareProfileImage(
  file: FormDataEntryValue | null,
  kind: "avatar" | "cover",
) {
  if (!(file instanceof File) || !file.size || file.size > 5 * 1024 * 1024) {
    throw new Error("Choose a photo up to 5 MB.");
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPEG, PNG or WebP photo.");
  }
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 25000000,
    });
    const metadata = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(metadata.format ?? "") ||
      (metadata.pages ?? 1) > 1
    ) {
      throw new Error("Unsupported photo.");
    }
    // Decode, orient and re-encode; strip metadata and keep uploads small.
    const bytes = await image
      .rotate()
      .resize(kind === "avatar" ? 512 : 1600, kind === "avatar" ? 512 : 600, {
        fit: "cover",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();
    if (bytes.length > 512000) throw new Error("Photo too detailed.");
    return bytes;
  } catch {
    throw new Error(
      "Could not process this photo. Choose a smaller, non-animated JPEG, PNG or WebP image.",
    );
  }
}

export async function getProfileImages(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_profile_images")
    .select("avatar_path, cover_path")
    .eq("user_id", userId)
    .maybeSingle();
  const paths = [data?.avatar_path, data?.cover_path].filter(
    (path): path is string => Boolean(path),
  );
  const urls = new Map<string, string>();
  let unavailable = Boolean(error);
  if (paths.length) {
    const result = await supabase.storage
      .from("profile-images")
      .createSignedUrls(paths, 3600);
    unavailable ||= Boolean(result.error);
    for (const image of result.data ?? []) {
      if (image.path && image.signedUrl) urls.set(image.path, image.signedUrl);
    }
  }
  return {
    avatarUrl: urls.get(data?.avatar_path),
    coverUrl: urls.get(data?.cover_path),
    unavailable,
  };
}
