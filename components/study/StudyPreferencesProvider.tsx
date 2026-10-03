"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { StudyPreferences } from "@/lib/study-preferences";

const StudyPreferencesContext = createContext<StudyPreferences>({ educationLevel: "", academicDetails: "", language: "taglish" });

// The student layout supplies account defaults; forms copy them into editable state.
export default function StudyPreferencesProvider({ preferences, children }: { preferences: StudyPreferences; children: ReactNode }) {
  return <StudyPreferencesContext.Provider value={preferences}>{children}</StudyPreferencesContext.Provider>;
}
export function useStudyPreferences() { return useContext(StudyPreferencesContext); }
