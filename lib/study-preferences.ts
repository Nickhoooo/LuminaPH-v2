export type StudyPreferences = { educationLevel: string; academicDetails: string; language: string };

// Account metadata is user-editable. Normalize it before using it as form defaults.
export function readStudyPreferences(metadata: Record<string, unknown>): StudyPreferences {
  return {
    educationLevel: typeof metadata.educationLevel === "string" && ["junior-high", "senior-high", "college", "independent"].includes(metadata.educationLevel) ? metadata.educationLevel : "",
    academicDetails: typeof metadata.academicDetails === "string" ? metadata.academicDetails.slice(0, 120) : "",
    language: typeof metadata.language === "string" && ["english", "filipino", "taglish"].includes(metadata.language) ? metadata.language : "taglish",
  };
}
