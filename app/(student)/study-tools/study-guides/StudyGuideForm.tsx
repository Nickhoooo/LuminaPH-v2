"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import StudyContent from "@/components/study/StudyContent";
import { useStudyPreferences } from "@/components/study/StudyPreferencesProvider";
import { Check, Copy, LoaderCircle, Pencil, X } from "lucide-react";

import { createStudyGuide, type StudyGuideState } from "./actions";

const initialState: StudyGuideState = { status: "idle", message: "" };

type SourceNote = {
  id: string;
  title: string;
  subject: string | null;
};

type StudyGuideFormProps = {
  sourceNote?: SourceNote;
};

export default function StudyGuideForm({
  sourceNote,
}: StudyGuideFormProps) {
  const preferences = useStudyPreferences();
  // Controlled fields preserve the student's inputs after an action completes.
  const [fields, setFields] = useState({
    educationLevel: preferences.educationLevel,
    academicDetails: preferences.academicDetails,
    subject: sourceNote?.subject ?? "",
    learningGoal: "",
    language: preferences.language,
  });
  const [displayedResult, setDisplayedResult] = useState<StudyGuideState | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [isEditing, setIsEditing] = useState(true);
  const [copied, setCopied] = useState(false);
  const guideBody = useRef<HTMLDivElement>(null);
  const guideTitle = useRef<HTMLHeadingElement>(null);
  const formTitle = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!displayedResult?.guide) return;
    if (isEditing) {
      formTitle.current?.focus();
    } else {
      guideTitle.current?.focus();
    }
  }, [displayedResult, isEditing]);

  const [state, formAction, pending] = useActionState(
    async (previousState: StudyGuideState, formData: FormData): Promise<StudyGuideState> => {
      let result: StudyGuideState;
      try {
        result = await createStudyGuide(previousState, formData);
      } catch {
        result = {
          status: "error",
          message: "The connection was interrupted. We could not confirm the result. Please wait before trying again; your attempt may already have been counted.",
        };
      }

      // A failed new attempt must not erase a previous guide from the screen.
      if (result.guide) {
        setDisplayedResult(result);
        setCopyMessage("");
        setCopied(false);
        setIsEditing(false);
      }
      return result;
    },
    initialState,
  );

  function updateField(name: keyof typeof fields, value: string) {
    setFields((previous) => ({ ...previous, [name]: value }));
  }

  async function copyGuide() {
    if (!displayedResult?.guide) return;
    setCopied(false);
    try {
      const readableText = guideBody.current?.innerText;
      await navigator.clipboard.writeText(readableText || displayedResult.guide.content);
      setCopied(true);
      setCopyMessage("Guide copied.");
    } catch {
      setCopyMessage("Copy was unavailable. Select the guide text and copy it manually.");
    }
  }

  let CopyIcon = Copy;
  let copyLabel = "Copy guide";
  if (copied) {
    CopyIcon = Check;
    copyLabel = "Copied";
  }

  let introduction = "Tell us what you want to learn. No personal notes required.";
  let generationNotice = "Generates a general AI study guide.";
  if (sourceNote) {
    introduction = "Create a study guide from your saved notes, tailored to your learning goal.";
    generationNotice = "Uses your selected notes as context for an AI study guide.";
  }

  let buttonLabel = "Generate study guide";
  if (displayedResult?.guide) buttonLabel = "Generate updated guide";
  let feedback = state.message;
  let feedbackClass = "text-sm text-emerald-800 dark:text-emerald-200";
  if (state.status === "error") feedbackClass = "text-sm text-red-700 dark:text-red-200";
  if (pending) {
    buttonLabel = "Generating study guide...";
    feedback = "Preparing your guide. Please keep this page open.";
    feedbackClass = "text-sm text-stone-600 dark:text-stone-300";
  }

  let saveLabel = "Save not confirmed — copy this guide before leaving.";
  if (displayedResult?.status === "success" && displayedResult.studySetId) {
    saveLabel = "Saved to your Library.";
  }
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Study Guides</h1>
        <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
          {introduction}
        </p>
      </header>

      {isEditing && (
      <form action={formAction} aria-busy={pending} className="space-y-5 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6">
        {sourceNote && (
          <div className="space-y-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 p-4">
            <input type="hidden" name="sourceNoteId" value={sourceNote.id} />
            <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
              Selected notes: {sourceNote.title}
            </p>
            <p className="text-sm text-stone-600 dark:text-stone-300">
              When you generate, the text of this note is sent to our AI provider
              to create a separate study guide. Your original note stays in your Library.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href={"/library/" + sourceNote.id} className="text-sm text-emerald-800 dark:text-emerald-200 underline">
                View original note
              </Link>
              <Link href="/study-tools/study-guides" className="text-sm text-emerald-800 dark:text-emerald-200 underline">
                Start without notes
              </Link>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-4">
          <h2 ref={formTitle} tabIndex={-1} className="text-xl font-semibold outline-none">Study details</h2>
          {displayedResult?.guide && (
            <button type="button" disabled={pending} onClick={() => setIsEditing(false)} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-50">
              <X size={16} aria-hidden="true" /> Back to guide
            </button>
          )}
        </div>
        {displayedResult?.guide && (
          <p className="text-sm text-stone-600 dark:text-stone-300">Update your details to generate a new version. This uses another attempt and saves a separate guide.</p>
        )}
        <div>
          <label htmlFor="level" className="block text-sm font-medium">
            Education level
          </label>
          <select
            id="level"
            name="educationLevel"
            value={fields.educationLevel}
            onChange={(event) => updateField("educationLevel", event.target.value)}
            required
            className="mt-2 w-full rounded-lg border border-stone-300 dark:border-stone-700 p-3"
          >
            <option value="" disabled>Select your level</option>
            <option value="junior-high">Junior High School</option>
            <option value="senior-high">Senior High School</option>
            <option value="college">College</option>
            <option value="independent">Independent learning</option>
          </select>
        </div>

        <div>
          <label htmlFor="academic-details" className="block text-sm font-medium">
            Grade/year and course or strand (optional)
          </label>
          <input
            id="academic-details"
            name="academicDetails"
            value={fields.academicDetails}
            onChange={(event) => updateField("academicDetails", event.target.value)}
            type="text"
            maxLength={120}
            placeholder="Example: First-year BSIT or Grade 11 STEM"
            className="mt-2 w-full rounded-lg border border-stone-300 dark:border-stone-700 p-3"
          />
        </div>

        <div>
          <label htmlFor="subject" className="block text-sm font-medium">
            Subject
          </label>
          <input
            id="subject"
            name="subject"
            value={fields.subject}
            onChange={(event) => updateField("subject", event.target.value)}
            type="text"
            required
            maxLength={120}
            placeholder="Example: General Mathematics"
            className="mt-2 w-full rounded-lg border border-stone-300 dark:border-stone-700 p-3"
          />
        </div>

        <div>
          <label htmlFor="learning-goal" className="block text-sm font-medium">
            What do you want to learn?
          </label>
          <textarea
            id="learning-goal"
            name="learningGoal"
            value={fields.learningGoal}
            onChange={(event) => updateField("learningGoal", event.target.value)}
            required
            rows={4}
            maxLength={1000}
            placeholder="Example: Help me understand functions, starting with the basics."
            className="mt-2 w-full rounded-lg border border-stone-300 dark:border-stone-700 p-3"
          />
        </div>

        <div>
          <label htmlFor="language" className="block text-sm font-medium">
            Explanation language
          </label>
          <select
            id="language"
            name="language"
            value={fields.language}
            onChange={(event) => updateField("language", event.target.value)}
            className="mt-2 w-full rounded-lg border border-stone-300 dark:border-stone-700 p-3"
          >
            <option value="english">English</option>
            <option value="filipino">Filipino</option>
            <option value="taglish">Taglish</option>
          </select>
        </div>

        <p className="text-sm leading-6 text-stone-600 dark:text-stone-300">
          {generationNotice} Check important facts against your
          class materials. You can make up to 5 attempts in 24 hours, with at
          least 60 seconds between attempts. Failed AI requests also count.
        </p>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-5 py-3 font-medium text-white transition-colors hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 disabled:cursor-wait disabled:opacity-50"
        >
          {pending && <LoaderCircle aria-hidden="true" size={18} className="animate-spin motion-reduce:animate-none" />}
          {buttonLabel}
        </button>

      </form>
      )}

      <p role="status" aria-live="polite" aria-atomic="true" className={feedbackClass}>
        {feedback}
      </p>

      {!isEditing && displayedResult?.guide && (
        <section aria-labelledby="generated-guide-title" className="space-y-5 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">Latest generated guide</p>
              <h2 ref={guideTitle} tabIndex={-1} id="generated-guide-title" className="mt-2 text-2xl font-semibold outline-none">
                {displayedResult.guide.title}
              </h2>
              <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">{saveLabel}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {displayedResult.status === "success" && displayedResult.studySetId && (
                <Link href={`/library/${displayedResult.studySetId}`} className="inline-flex items-center rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-900">
                  Open saved guide
                </Link>
              )}
              <button type="button" onClick={() => setIsEditing(true)} className="inline-flex items-center gap-2 rounded-lg border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800">
                <Pencil size={16} aria-hidden="true" /> Edit details
              </button>
              <button type="button" onClick={copyGuide} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950 px-4 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800">
                <CopyIcon size={16} aria-hidden="true" /> {copyLabel}
              </button>
            </div>
          </div>
          <p role="status" aria-live="polite" className="text-sm text-stone-600 dark:text-stone-300">{copyMessage}</p>
          <p className="rounded-lg bg-amber-50 dark:bg-amber-950 p-3 text-sm leading-6 text-amber-900 dark:text-amber-200">
            AI-generated study guide. Check important details against your class materials; AI can make mistakes.
          </p>
          {displayedResult.guide.sourceNote && (
            <p className="text-sm text-stone-600 dark:text-stone-300">
              Based on your notes:{" "}
              <Link href={"/library/" + displayedResult.guide.sourceNote.id} className="font-medium text-emerald-800 dark:text-emerald-200 underline">
                {displayedResult.guide.sourceNote.title}
              </Link>.
              {" "}Additional explanations and examples may use AI knowledge.
            </p>
          )}
          {/* Parse Markdown and sanitize embedded HTML before displaying it. */}
          <StudyContent content={displayedResult.guide.content} contentRef={guideBody} />
        </section>
      )}
    </section>
  );
}
