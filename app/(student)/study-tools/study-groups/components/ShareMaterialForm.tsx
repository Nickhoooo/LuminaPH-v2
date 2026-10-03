"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  shareGroupMaterial,
  type MaterialShareState,
} from "../material-actions";

type LibraryOption = { id: string; title: string; material_type: string };
const initialState: MaterialShareState = { status: "idle", message: "" };

export default function ShareMaterialForm({
  groupId,
  materials,
}: {
  groupId: string;
  materials: LibraryOption[];
}) {
  const [state, action, pending] = useActionState(
    async (
      previous: MaterialShareState,
      data: FormData,
    ): Promise<MaterialShareState> => {
      try {
        return await shareGroupMaterial(previous, data);
      } catch {
        return {
          status: "error",
          message:
            "Connection interrupted. Refresh the shared materials list to check whether your copy was saved.",
        };
      }
    },
    initialState,
  );

  return (
    <form action={action} aria-busy={pending} className="space-y-4">
      <input type="hidden" name="groupId" value={groupId} />
      <fieldset disabled={pending} className="space-y-4">
        <legend className="sr-only">Share from your Library</legend>
        <label className="block text-sm font-medium">
          Choose your note or study guide
          <select
            name="studySetId"
            required
            defaultValue=""
            className="mt-2 w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 p-3"
          >
            <option value="" disabled>
              Select a material
            </option>
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.title} —{" "}
                {material.material_type === "notes" ? "Note" : "Study guide"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-start gap-3 text-sm leading-6 text-stone-600 dark:text-stone-300">
          <input
            type="checkbox"
            name="confirmShare"
            required
            className="mt-1 accent-emerald-800"
          />
          <span>
            I agree to share a copy with this group. It stays here if I leave or
            change my original. My private chats and study results are not
            shared.
          </span>
        </label>
      </fieldset>
      <button
        disabled={pending}
        className="rounded-xl bg-emerald-800 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-900 disabled:opacity-60"
      >
        {pending ? "Sharing…" : "Share selected material"}
      </button>
      <p
        role="status"
        className={
          state.status === "error"
            ? "text-sm text-red-700 dark:text-red-200"
            : "text-sm text-emerald-800 dark:text-emerald-200"
        }
      >
        {state.message}
      </p>
      {state.status === "success" && state.materialId && (
        <Link
          href={`/study-tools/study-groups/${groupId}/materials/${state.materialId}`}
          className="inline-flex rounded-xl border border-emerald-800/30 px-4 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-200"
        >
          Open group copy
        </Link>
      )}
    </form>
  );
}
