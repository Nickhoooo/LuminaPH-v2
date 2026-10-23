"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { AppSettings } from "@/lib/app-settings";

import { accentVariables, defaultAccent } from "@/lib/appearance";

type Theme = AppSettings["theme"];
const AppearanceContext = createContext<{
  accent: string;
  previewAccent: (color: string | null) => void;
  theme: Theme;
  previewTheme: (theme: Theme | null) => void;
}>({
  accent: defaultAccent,
  previewAccent: () => {},
  theme: "system",
  previewTheme: () => {},
});

// Saved settings come from the server. A preview lasts only while Settings is open.
export default function AppearanceProvider({
  settings,
  children,
}: {
  settings: Pick<
    AppSettings,
    "theme" | "reading_size" | "reduce_motion" | "accent_color"
  >;
  children: ReactNode;
}) {
  const [preview, previewTheme] = useState<Theme | null>(null);
  const theme = preview ?? settings.theme;
  const [colorPreview, previewAccent] = useState<string | null>(null);
  const accent = colorPreview ?? settings.accent_color ?? defaultAccent;

  useEffect(() => {
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("lumina-session")
        : null;
    if (channel)
      channel.onmessage = (event) => {
        if (event.data === "signed-out") window.location.replace("/login");
      };
    // Recheck authentication when restoring a signed-in page from browser history.
    function restore(event: PageTransitionEvent) {
      if (event.persisted) window.location.reload();
    }
    window.addEventListener("pageshow", restore);
    return () => {
      channel?.close();
      window.removeEventListener("pageshow", restore);
    };
  }, []);

  return (
    <AppearanceContext.Provider
      value={{ theme, previewTheme, accent, previewAccent }}
    >
      <div
        style={accentVariables(accent)}
        data-app-theme={theme}
        data-reading-size={settings.reading_size}
        data-reduce-motion={settings.reduce_motion}
        className="student-space min-h-dvh bg-[#f8f9f5] font-sans text-[#233d34] scheme-light dark:bg-stone-950 dark:text-stone-200 dark:scheme-dark"
      >
        {children}
      </div>
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  return useContext(AppearanceContext);
}
