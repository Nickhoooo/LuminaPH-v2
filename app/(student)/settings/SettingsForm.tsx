"use client";

import { useActionState } from "react";
import { Bell, Monitor, BookOpen } from "lucide-react";
import type { AppSettings } from "@/lib/app-settings";
import { saveSettings, type SettingsState } from "./actions";

const initialState: SettingsState = { status: "idle", message: "" };

export default function SettingsForm({ settings }: { settings: AppSettings }) {
  const [state, action, pending] = useActionState(saveSettings, initialState);
  const card =
    "space-y-4 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6";
  const select =
    "mt-2 block w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-3 text-sm";
  return (
    <form action={action} aria-busy={pending} className="space-y-5">
      <fieldset disabled={pending} className="space-y-5">
        <legend className="sr-only">Your app settings</legend>
        <section className={card}>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Monitor size={20} /> Appearance
          </h2>
          <label className="block text-sm font-medium">
            Theme
            <select
              name="theme"
              defaultValue={settings.theme}
              className={select}
            >
              <option value="system">Follow system</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Applies to your signed-in study space after saving. Follow system
            changes with your device’s appearance.
          </p>
        </section>
        <section className={card}>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BookOpen size={20} /> Reading and motion
          </h2>
          <label className="block text-sm font-medium">
            Lesson and guide text size
            <select
              name="reading_size"
              defaultValue={settings.reading_size}
              className={select}
            >
              <option value="normal">Normal</option>
              <option value="large">Large</option>
            </select>
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input
              name="reduce_motion"
              type="checkbox"
              defaultChecked={settings.reduce_motion}
              className="size-4 accent-emerald-700"
            />{" "}
            Reduce animations
          </label>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Your device’s reduced-motion preference is also respected.
          </p>
        </section>
        <section className={card}>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Bell size={20} /> Notifications
          </h2>
          {(
            [
              [
                "quiz_notifications",
                "Quiz results",
                "New scores and links to your own review.",
              ],
              [
                "group_notifications",
                "Group activity",
                "New shared materials and lessons or quizzes ready to study.",
              ],
              [
                "admin_notifications",
                "Announcements",
                "Updates published by a LuminaPH administrator.",
              ],
            ] as const
          ).map(([name, label, description]) => (
            <label key={name} className="flex items-start gap-3">
              <input
                name={name}
                type="checkbox"
                defaultChecked={settings[name]}
                className="mt-1 size-4 accent-emerald-700"
              />
              <span className="text-sm font-medium">
                {label}
                <span className="mt-1 block text-xs font-normal text-stone-500 dark:text-stone-400">
                  {description}
                </span>
              </span>
            </label>
          ))}
          <p className="text-xs leading-5 text-stone-500 dark:text-stone-400">
            These control future in-app notices. Existing notices remain.
            Invitations and password security notices always stay enabled.
          </p>
        </section>
      </fieldset>
      <div className="flex flex-wrap items-center gap-4">
        <button
          disabled={pending}
          className="rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
        {state.message && (
          <p
            role={state.status === "error" ? "alert" : "status"}
            className={`text-sm ${state.status === "error" ? "text-red-700 dark:text-red-200" : "text-emerald-800 dark:text-emerald-200"}`}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
