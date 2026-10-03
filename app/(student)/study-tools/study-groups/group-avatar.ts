import "server-only";
import { createClient } from "@/lib/supabase/server";

export const avatarBucket = "study-group-avatars";

export async function validateGroupAvatar(value: FormDataEntryValue | null) {
  if (value === null || (value instanceof File && value.size === 0))
    return null;
  if (!(value instanceof File) || value.size > 512000) {
    throw new Error("Choose an image smaller than 500 KB.");
  }
  const bytes = Buffer.from(await value.arrayBuffer());
  const isPng = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const isWebp =
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP";
  if (isPng && value.type === "image/png")
    return { bytes, extension: "png", contentType: value.type };
  if (isJpeg && value.type === "image/jpeg")
    return { bytes, extension: "jpg", contentType: value.type };
  if (isWebp && value.type === "image/webp")
    return { bytes, extension: "webp", contentType: value.type };
  throw new Error("Choose a PNG, JPEG or WebP image.");
}

export async function getGroupAvatarUrls(paths: (string | null)[]) {
  const uniquePaths = [
    ...new Set(paths.filter((path): path is string => Boolean(path))),
  ];
  const urls = new Map<string, string>();
  if (!uniquePaths.length) return urls;
  try {
    const supabase = await createClient();
    const { data } = await supabase.storage
      .from(avatarBucket)
      .createSignedUrls(uniquePaths, 3600);
    for (const image of data ?? []) {
      if (image.path && image.signedUrl) urls.set(image.path, image.signedUrl);
    }
  } catch {
    // The group remains usable when image storage is unavailable.
  }
  return urls;
}
