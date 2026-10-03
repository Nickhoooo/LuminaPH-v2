"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Sparkles } from "lucide-react";
import { useStudyPreferences } from "@/components/study/StudyPreferencesProvider";
import {
  generateGroupTrackOutline,
  saveGroupTrackOutline,
  type GroupTrackDraft,
  type GroupTrackState,
} from "../track-actions";

const initialState: GroupTrackState = { status: "idle", message: "" };
const inputStyle =
  "mt-2 w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-4 py-3 text-stone-900 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-600";
const buttonStyle =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-60";

function SaveOutline({ draft }: { draft: GroupTrackDraft }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (
      previous: GroupTrackState,
      form: FormData,
    ): Promise<GroupTrackState> => {
      try {
        return await saveGroupTrackOutline(previous, form);
      } catch {
        return {
          status: "error",
          message:
            "Connection interrupted. Check the dashboard, or retry saving this outline. No new AI generation is needed.",
          draft,
        };
      }
    },
    initialState,
  );

  if (state.trackId) {
    return (
      <div className="space-y-3">
        <p role="status" className="text-sm text-emerald-800 dark:text-emerald-200">
          {state.message}
        </p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className={buttonStyle}
        >
          <Check size={16} aria-hidden="true" /> View saved track
        </button>
      </div>
    );
  }

  return (
    <form action={action} aria-busy={pending} className="space-y-3">
      <input type="hidden" name="draft" value={JSON.stringify(draft)} />
      <p className="text-sm leading-6 text-stone-600 dark:text-stone-300">
        Saving makes this outline the shared plan for everyone in the group.
        This version supports one saved track per group.
      </p>
      <button disabled={pending} className={buttonStyle}>
        {pending && (
          <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
        )}
        {pending
          ? "Saving track…"
          : state.status === "error"
            ? "Retry saving outline"
            : "Save group track"}
      </button>
      {state.message && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-200">
          {state.message}
        </p>
      )}
    </form>
  );
}

export default function GroupTrackForm({ groupId }: { groupId: string }) {
  const preferences = useStudyPreferences();
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (
      previous: GroupTrackState,
      form: FormData,
    ): Promise<GroupTrackState> => {
      try {
        return await generateGroupTrackOutline(previous, form);
      } catch {
        return {
          status: "error",
          message:
            "Connection interrupted. Refresh the group before retrying; a generation attempt may have counted.",
        };
      }
    },
    initialState,
  );

  if (state.trackId) {
    return (
      <div className="space-y-3">
        <p role="status" className="text-sm text-stone-600 dark:text-stone-300">
          {state.message}
        </p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className={buttonStyle}
        >
          View saved track
        </button>
      </div>
    );
  }

  if (state.draft) {
    const draft = state.draft;
    return (
      <div className="space-y-5">
        <p role="status" className="text-sm text-emerald-800 dark:text-emerald-200">
          {state.message}
        </p>
        <div>
          <h3 className="break-words text-xl font-semibold text-stone-900 dark:text-stone-200">
            {draft.outline.title}
          </h3>
          <p className="mt-2 break-words text-sm text-stone-600 dark:text-stone-300">
            {draft.learningGoal}
          </p>
          <p className="mt-2 text-xs capitalize text-stone-500 dark:text-stone-400">
            {draft.subject} · {draft.language}
          </p>
        </div>
        <ol className="divide-y divide-stone-200 dark:divide-stone-700">
          {draft.outline.lessons.map((lesson, index) => (
            <li key={index} className="flex gap-4 py-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950 text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                {index + 1}
              </span>
              <div className="min-w-0">
                <h4 className="break-words font-medium text-stone-900 dark:text-stone-200">
                  {lesson.title}
                </h4>
                <p className="mt-1 break-words text-sm leading-6 text-stone-600 dark:text-stone-300">
                  {lesson.objective}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <SaveOutline key={draft.requestId} draft={draft} />
      </div>
    );
  }

  return (
    <form action={action} aria-busy={pending} className="space-y-5">
      <input type="hidden" name="groupId" value={groupId} />
      <p className="text-sm leading-6 text-stone-600 dark:text-stone-300">
        Choose what your group wants to learn. Review five AI-generated lesson
        outlines before saving. Your profile provides starting preferences;
        adjust them for the group.
      </p>
      <fieldset disabled={pending} className="space-y-4">
        <legend className="sr-only">Group learning preferences</legend>
        <label className="block text-sm font-medium text-stone-800 dark:text-stone-200">
          Subject
          <input
            name="subject"
            required
            maxLength={120}
            placeholder="Biology, Accounting, History…"
            className={inputStyle}
          />
        </label>
        <label className="block text-sm font-medium text-stone-800 dark:text-stone-200">
          What does your group want to learn?
          <textarea
            name="learningGoal"
            required
            maxLength={1000}
            rows={3}
            className={inputStyle}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-stone-800 dark:text-stone-200">
            Education level
            <select
              name="educationLevel"
              required
              defaultValue={preferences.educationLevel}
              className={inputStyle}
            >
              <option value="" disabled>
                Select a level
              </option>
              <option value="junior-high">Junior High School</option>
              <option value="senior-high">Senior High School</option>
              <option value="college">College</option>
              <option value="independent">Independent learning</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-stone-800 dark:text-stone-200">
            Explanation language
            <select
              name="language"
              defaultValue={preferences.language}
              className={inputStyle}
            >
              <option value="english">English</option>
              <option value="filipino">Filipino</option>
              <option value="taglish">Taglish</option>
            </select>
          </label>
        </div>
        <label className="block text-sm font-medium text-stone-800 dark:text-stone-200">
          Grade/year, course or strand (optional)
          <input
            name="academicDetails"
            maxLength={120}
            defaultValue={preferences.academicDetails}
            className={inputStyle}
          />
        </label>
        <p className="text-xs leading-5 text-stone-500 dark:text-stone-400">
          Uses general AI knowledge. Check important facts against your class
          materials. Generating an outline uses one of your study-tool
          generation attempts, even if the AI request fails. Saving the outline
          does not use another attempt.
        </p>
        <button className={buttonStyle} disabled={pending}>
          {pending ? (
            <LoaderCircle
              size={16}
              className="animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Sparkles size={16} aria-hidden="true" />
          )}
          {pending ? "Planning five lessons…" : "Generate group outline"}
        </button>
      </fieldset>
      {state.message && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-200">
          {state.message}
        </p>
      )}
    </form>
  );
}
