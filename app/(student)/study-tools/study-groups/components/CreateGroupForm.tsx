"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import GroupAvatar from "./GroupAvatar";
import { createStudyGroup, type StudyGroupState } from "../actions";

const initialState: StudyGroupState = {
  status: "idle",
  message: "",
};

export default function CreateGroupForm() {
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<string>();
  const [imageError, setImageError] = useState("");
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);
  const [state, formAction, pending] = useActionState(
    createStudyGroup,
    initialState,
  );

  if (state.status === "success") {
    return (
      <div role="status" className="rounded-2xl bg-emerald-50 dark:bg-emerald-950 p-6">
        <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-200">
          Group created!
        </h2>
        <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">{state.message}</p>
        {state.groupId && (
          <Link
            href={`/study-tools/study-groups/${state.groupId}`}
            className="mt-4 inline-flex rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white"
          >
            Open group dashboard
          </Link>
        )}
      </div>
    );
  }

  return (
    <form
      action={formAction}
      aria-busy={pending}
      className="space-y-5 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6"
    >
      <div>
        <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-200">
          Create a study group
        </h2>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
          Build a study space and invite your classmates using a code.
        </p>
      </div>

      <fieldset disabled={pending} className="space-y-4">
        <legend className="sr-only">Group details</legend>
        <div className="flex items-center gap-4">
          <GroupAvatar name={name} src={preview} />
          <div className="min-w-0">
            <label
              htmlFor="group-avatar"
              className="block text-sm font-medium text-stone-800 dark:text-stone-200"
            >
              Group photo (optional)
            </label>
            <input
              id="group-avatar"
              name="avatar"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (
                  file &&
                  (file.size > 512000 ||
                    !["image/png", "image/jpeg", "image/webp"].includes(
                      file.type,
                    ))
                ) {
                  event.target.value = "";
                  setPreview(undefined);
                  setImageError(
                    "Choose a PNG, JPEG or WebP image up to 500 KB.",
                  );
                  return;
                }
                setImageError("");
                setPreview(file ? URL.createObjectURL(file) : undefined);
              }}
              className="mt-2 w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-emerald-50 dark:file:bg-emerald-950 file:px-3 file:py-2 file:text-emerald-900 dark:file:text-emerald-200"
            />
            {imageError && (
              <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-200">
                {imageError}
              </p>
            )}
            <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
              PNG, JPEG or WebP, up to 500 KB. No photo? We’ll use the first
              letter.
            </p>
          </div>
        </div>

        <div>
          <label
            htmlFor="group-name"
            className="block text-sm font-medium text-stone-800 dark:text-stone-200"
          >
            Group name
          </label>
          <input
            id="group-name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={80}
            placeholder="Biology Review"
            className="mt-2 w-full rounded-xl border border-stone-300 dark:border-stone-700 px-4 py-3 text-stone-900 dark:text-stone-200 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
          />
        </div>

        <div>
          <label
            htmlFor="group-description"
            className="block text-sm font-medium text-stone-800 dark:text-stone-200"
          >
            Description (optional)
          </label>
          <textarea
            id="group-description"
            name="description"
            maxLength={500}
            rows={3}
            placeholder="What will your group study together?"
            className="mt-2 w-full rounded-xl border border-stone-300 dark:border-stone-700 px-4 py-3 text-stone-900 dark:text-stone-200 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
          />
        </div>
      </fieldset>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-200">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-emerald-800 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Creating group…" : "Create group"}
      </button>
    </form>
  );
}
