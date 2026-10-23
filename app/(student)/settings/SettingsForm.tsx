"use client";

import { startTransition, useActionState, useEffect } from "react";
import { Bell, Monitor, BookOpen, Sun, Moon, Check } from "lucide-react";
import { useAppearance } from "@/components/study/AppearanceProvider";
import type { AppSettings } from "@/lib/app-settings";
import { accentPresets, isAccentColor } from "@/lib/appearance";
import { saveSettings, type SettingsState } from "./actions";

const initialState: SettingsState = { status: "idle", message: "" };

export default function SettingsForm({ settings }: { settings: AppSettings }) {
  const [state, action, pending] = useActionState(
    async (previous: SettingsState, data: FormData): Promise<SettingsState> => {
      try {
        return await saveSettings(previous, data);
      } catch {
        return {
          status: "error",
          message:
            "Connection interrupted. Reload to check your saved settings before trying again.",
        };
      }
    },
    initialState,
  );
  const { theme, previewTheme, accent, previewAccent } = useAppearance();
  useEffect(
    () => () => {
      previewTheme(null);
      previewAccent(null);
    },
    [previewTheme, previewAccent],
  );
  const appearanceChanged =
    theme !== settings.theme || accent !== settings.accent_color;
  const card =
    "space-y-4 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6";
  const select =
    "mt-2 block w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-3 text-sm";
  return (
    <form
      aria-busy={pending}
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        // Keep edits after a failed save instead of automatically resetting the form.
        startTransition(() => action(data));
      }}
    >
      <fieldset
        disabled={pending}
        className="grid min-w-0 gap-5 xl:grid-cols-2"
      >
        <legend className="sr-only">Your app settings</legend>
        <section className={`${card} xl:col-span-2`}>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Monitor size={20} /> Appearance
          </h2>
          <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <legend className="sr-only">Theme</legend>
            {(
              [
                ["light", "Light", "A bright study space", Sun],
                ["dark", "Dark", "A softer screen at night", Moon],
                ["system", "System", "Follow your device", Monitor],
              ] as const
            ).map(([value, label, description, Icon]) => (
              <label key={value} className="relative cursor-pointer">
                <input
                  type="radio"
                  name="theme"
                  value={value}
                  checked={theme === value}
                  onChange={() => previewTheme(value)}
                  className="peer sr-only"
                />
                <span className="flex h-full flex-col gap-3 rounded-xl border-2 border-stone-200 p-5 transition-colors peer-checked:border-emerald-600 peer-checked:bg-emerald-50 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-emerald-600 dark:border-stone-700 dark:peer-checked:bg-emerald-950">
                  <Icon size={24} />
                  <span className="font-semibold">{label}</span>
                  <span className="text-xs text-stone-600 dark:text-stone-300">
                    {description}
                  </span>
                </span>
                {theme === value && (
                  <Check
                    size={18}
                    className="absolute right-4 top-4 text-emerald-700 dark:text-emerald-300"
                  />
                )}
              </label>
            ))}
          </fieldset>
          <fieldset className="space-y-3 border-t border-stone-200 pt-5 dark:border-stone-700">
            <legend className="pt-5 text-sm font-semibold">Accent color</legend>
            <div className="flex flex-wrap gap-2">
              {accentPresets.map((preset) => (
                <button
                  key={preset.color}
                  type="button"
                  aria-pressed={accent.toLowerCase() === preset.color}
                  onClick={() => previewAccent(preset.color)}
                  className="flex items-center gap-2 rounded-xl border border-stone-300 px-3 py-2 text-sm aria-pressed:border-emerald-600 aria-pressed:ring-2 aria-pressed:ring-emerald-600 dark:border-stone-700"
                >
                  <span
                    className="size-4 rounded-full"
                    style={{ backgroundColor: preset.color }}
                  />
                  {preset.name}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-3 text-sm">
                Custom color
                <input
                  type="color"
                  name="accent_color"
                  value={accent}
                  onChange={(event) => {
                    if (isAccentColor(event.target.value))
                      previewAccent(event.target.value);
                  }}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-stone-300 bg-transparent p-1 dark:border-stone-700"
                />
              </label>
              <span className="font-mono text-xs text-stone-500 dark:text-stone-400">
                {accent.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Applies to your app header, buttons and highlights. We adjust
              light and dark shades to keep text readable.
            </p>
          </fieldset>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Preview changes immediately. Save settings to keep your choice after
            leaving this page.
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
      {appearanceChanged && (
        <p role="status" className="text-sm text-amber-800 dark:text-amber-200">
          Appearance preview: save to keep these changes.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button
          disabled={pending}
          className="rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
        {state.message &&
          !(state.status === "success" && appearanceChanged) && (
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
