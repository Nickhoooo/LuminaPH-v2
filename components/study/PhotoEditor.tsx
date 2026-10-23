"use client";

import { useEffect, useState, useTransition } from "react";
import { Camera } from "lucide-react";
import ProfilePhoto from "./ProfilePhoto";
import {
  saveProfileImage,
  type ImageState,
} from "@/app/(student)/profile/image-actions";

const initial: ImageState = { status: "idle", message: "" };

export default function PhotoEditor({
  name,
  avatarUrl,
  coverUrl,
  groupId,
}: {
  name: string;
  avatarUrl?: string;
  coverUrl?: string;
  groupId?: string;
}) {
  const [kind, setKind] = useState<"avatar" | "cover">("avatar");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>();
  const [state, setState] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [inputKey, setInputKey] = useState(0);
  const savedUrl = kind === "avatar" ? avatarUrl : coverUrl;

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  function resetFile() {
    setFile(null);
    setPreview(undefined);
    setInputKey((key) => key + 1);
  }
  function save(remove: boolean) {
    if (pending) return;
    const form = new FormData();
    form.set("kind", kind);
    form.set("remove", String(remove));
    if (groupId) form.set("groupId", groupId);
    if (file && !remove) form.set("photo", file);
    startTransition(async () => {
      try {
        const result = await saveProfileImage(initial, form);
        setState(result);
        if (result.status === "success") resetFile();
      } catch {
        setState({
          status: "error",
          message: "Could not confirm the save. Refresh and try again.",
        });
      }
    });
  }

  return (
    <details className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900">
      <summary className="cursor-pointer text-sm font-semibold">
        <Camera size={16} className="mr-2 inline" />
        {groupId ? "Edit group photos" : "Change profile & cover photos"}
      </summary>
      <div
        className="mt-4 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
        aria-busy={pending}
      >
        <div className="overflow-hidden rounded-xl">
          <ProfilePhoto
            src={preview ?? savedUrl}
            name={name}
            cover={kind === "cover"}
          />
        </div>
        <div className="space-y-4">
          <fieldset disabled={pending} className="flex flex-wrap gap-3">
            <legend className="sr-only">Photo type</legend>
            {(["avatar", "cover"] as const).map((value) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`photo-kind-${groupId ?? "profile"}`}
                  checked={kind === value}
                  onChange={() => {
                    setKind(value);
                    resetFile();
                    setState(initial);
                  }}
                  className="accent-emerald-700"
                />
                {value === "avatar" ? "Profile photo" : "Cover photo"}
              </label>
            ))}
          </fieldset>
          <label className="block text-sm font-medium">
            Choose {kind === "avatar" ? "profile" : "cover"} photo
            <input
              key={inputKey}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={pending}
              onChange={(event) => {
                const selected = event.target.files?.[0];
                setFile(null);
                setPreview(undefined);
                setState(initial);
                if (!selected) return;
                if (
                  selected.size > 5 * 1024 * 1024 ||
                  !["image/jpeg", "image/png", "image/webp"].includes(
                    selected.type,
                  )
                ) {
                  event.target.value = "";
                  setState({
                    status: "error",
                    message: "Choose a JPEG, PNG or WebP photo up to 5 MB.",
                  });
                  return;
                }
                setFile(selected);
                setPreview(URL.createObjectURL(selected));
              }}
              className="mt-2 block w-full min-w-0 rounded-xl border border-stone-300 bg-stone-50 p-2 text-sm file:mr-3 file:rounded-lg file:bg-emerald-800 file:px-3 file:py-2 file:text-white dark:border-stone-700 dark:bg-stone-800"
            />
          </label>
          <p className="text-xs leading-5 text-stone-500 dark:text-stone-400">
            JPEG, PNG or WebP, up to 5 MB. Photos are centered and resized. Both
            are optional; removing your profile photo restores your initial.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !file}
              onClick={() => save(false)}
              className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save photo"}
            </button>
            {file && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  resetFile();
                  setState(initial);
                }}
                className="rounded-xl border border-stone-300 px-4 py-2 text-sm dark:border-stone-700"
              >
                Cancel selection
              </button>
            )}
            {savedUrl && (
              <button
                type="button"
                disabled={pending}
                onClick={() => save(true)}
                className="rounded-xl border border-stone-300 px-4 py-2 text-sm dark:border-stone-700"
              >
                Remove {kind === "avatar" ? "profile" : "cover"} photo
              </button>
            )}
          </div>
          {state.message && (
            <p
              role={state.status === "error" ? "alert" : "status"}
              className={`text-sm ${state.status === "error" ? "text-red-700 dark:text-red-300" : "text-emerald-800 dark:text-emerald-200"}`}
            >
              {state.message}
            </p>
          )}
        </div>
      </div>
    </details>
  );
}
