"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LoaderCircle, Pencil } from "lucide-react";
import FlashcardReview from "@/components/study/FlashcardReview";
import { useStudyPreferences } from "@/components/study/StudyPreferencesProvider";
import { createFlashcards, type FlashcardState } from "./actions";

type SourceNote = { id: string; title: string; subject: string | null };
const initialState: FlashcardState = { status: "idle", message: "" };

export default function FlashcardForm({ sourceNote, sourceGuide }: { sourceNote?: SourceNote; sourceGuide?: SourceNote }) {
  const preferences = useStudyPreferences();
  const [fields, setFields] = useState({ ...preferences, subject: sourceNote?.subject ?? "", learningGoal: "", cardCount: "5" });
  const [result, setResult] = useState<FlashcardState | null>(null);
  const [editing, setEditing] = useState(true);
  const [revision, setRevision] = useState(0);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const formHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!result?.deck) return;
    if (editing) formHeading.current?.focus();
    else resultHeading.current?.focus();
  }, [editing, result]);

  const [state, formAction, pending] = useActionState(
    async (previous: FlashcardState, formData: FormData): Promise<FlashcardState> => {
      let next: FlashcardState;
      try {
        next = await createFlashcards(previous, formData);
      } catch {
        return { status: "error", message: "The connection was interrupted. We could not confirm the result. Wait before retrying; the attempt may have been counted." };
      }
      if (next.deck) {
        setResult(next);
        setRevision((value) => value + 1);
        setEditing(false);
      }
      return next;
    }, initialState,
  );

  function update(name: keyof typeof fields, value: string) {
    setFields((previous) => ({ ...previous, [name]: value }));
  }

  let feedback = state.message;
  let feedbackStyle = "text-sm text-emerald-800 dark:text-emerald-200";
  if (state.status === "error") feedbackStyle = "text-sm text-red-700 dark:text-red-200";
  if (pending) { feedback = "Creating your flashcards. Please keep this page open."; feedbackStyle = "text-sm text-stone-600 dark:text-stone-300"; }
  let saveLabel = "Save not confirmed. Copy all cards before leaving.";
  if (result?.status === "success" && result.studySetId) saveLabel = "Saved to your Library.";
  const inputStyle = "mt-2 w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 p-3";

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header><h1 className="font-serif text-3xl sm:text-4xl">Flashcards</h1><p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-300">Start with a topic or turn a saved study guide into recall practice. Personal notes can also be opened from your Library.</p></header>
      {editing && (
        <form action={formAction} aria-busy={pending} className="space-y-5 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 ref={formHeading} tabIndex={-1} className="text-xl font-semibold outline-none">Deck details</h2>
            {result?.deck && <button type="button" disabled={pending} onClick={() => setEditing(false)} className="text-sm text-emerald-800 dark:text-emerald-200 underline disabled:opacity-50">Back to previous deck</button>}
          </div>
          {result?.deck && <p className="text-sm text-stone-600 dark:text-stone-300">Generating again uses another attempt and creates a separate deck.</p>}
          <nav aria-label="Flashcard source" className="grid gap-3 sm:grid-cols-2">
            <Link href="/study-tools/flashcards" aria-current={!sourceGuide && !sourceNote ? "page" : undefined} className="rounded-xl border border-stone-200 dark:border-stone-700 p-4 font-medium aria-[current=page]:border-emerald-700 aria-[current=page]:bg-emerald-50 dark:[current=page]:bg-emerald-950">Start with a topic</Link>
            <Link href="/study-tools/flashcards?mode=guide" aria-current={sourceGuide ? "page" : undefined} className="rounded-xl border border-stone-200 dark:border-stone-700 p-4 font-medium aria-[current=page]:border-emerald-700 aria-[current=page]:bg-emerald-50 dark:[current=page]:bg-emerald-950">Use a saved study guide</Link>
          </nav>
          {sourceGuide && <div className="space-y-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 p-4 text-sm">
            <input type="hidden" name="sourceGuideId" value={sourceGuide.id} />
            <input type="hidden" name="educationLevel" value="independent" />
            <input type="hidden" name="academicDetails" value="" />
            <input type="hidden" name="subject" value={sourceGuide.subject || sourceGuide.title} />
            <input type="hidden" name="learningGoal" value="Recall the key concepts in the selected study guide." />
            <p className="font-medium">Using your study guide: {sourceGuide.title}</p>
            <p>The guide content will be sent to our AI provider. Your original guide stays unchanged; the new deck uses a generation attempt.</p>
            <Link href={"/library/" + sourceGuide.id} className="text-emerald-800 dark:text-emerald-200 underline">View guide</Link>
          </div>}
          {sourceNote && <div className="space-y-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 p-4 text-sm">
            <input type="hidden" name="sourceNoteId" value={sourceNote.id} />
            <p className="font-medium">Using your notes: {sourceNote.title}</p>
            <p>The saved text is sent to our AI provider when you generate. Your original note stays in your Library.</p>
            <div className="flex flex-wrap gap-4"><Link href={"/library/" + sourceNote.id} className="text-emerald-800 dark:text-emerald-200 underline">View note</Link><Link href="/study-tools/flashcards" className="text-emerald-800 dark:text-emerald-200 underline">Start without notes</Link></div>
          </div>}
          <fieldset disabled={pending} className="space-y-5 disabled:opacity-60">
            <legend className="sr-only">Flashcard generation preferences</legend>
            {!sourceGuide && <>
            <div><label htmlFor="flash-level" className="text-sm font-medium">Education level</label><select id="flash-level" name="educationLevel" required value={fields.educationLevel} onChange={(e) => update("educationLevel", e.target.value)} className={inputStyle}><option value="" disabled>Select your level</option><option value="junior-high">Junior High School</option><option value="senior-high">Senior High School</option><option value="college">College</option><option value="independent">Independent learning</option></select></div>
            <div><label htmlFor="flash-academic" className="text-sm font-medium">Grade/year and course or strand (optional)</label><input id="flash-academic" name="academicDetails" value={fields.academicDetails} onChange={(e) => update("academicDetails", e.target.value)} maxLength={120} placeholder="Example: Grade 11 HUMSS or First-year Nursing" className={inputStyle} /></div>
            <div><label htmlFor="flash-subject" className="text-sm font-medium">Subject</label><input id="flash-subject" name="subject" required maxLength={120} value={fields.subject} onChange={(e) => update("subject", e.target.value)} placeholder="Example: Biology" className={inputStyle} /></div>
            <div><label htmlFor="flash-goal" className="text-sm font-medium">What do you want to remember?</label><textarea id="flash-goal" name="learningGoal" required maxLength={1000} rows={4} value={fields.learningGoal} onChange={(e) => update("learningGoal", e.target.value)} placeholder="Example: Key terms and processes in photosynthesis" className={inputStyle} /></div>
            </>}
            <div className="grid gap-5 sm:grid-cols-2">
              <div><label htmlFor="flash-language" className="text-sm font-medium">Language</label><select id="flash-language" name="language" value={fields.language} onChange={(e) => update("language", e.target.value)} className={inputStyle}><option value="english">English</option><option value="filipino">Filipino</option><option value="taglish">Taglish</option></select></div>
              <div><label htmlFor="flash-count" className="text-sm font-medium">Number of cards</label><select id="flash-count" name="cardCount" value={fields.cardCount} onChange={(e) => update("cardCount", e.target.value)} className={inputStyle}><option value="5">5 cards</option><option value="10">10 cards</option></select></div>
            </div>
          </fieldset>
          <p className="text-sm leading-6 text-stone-600 dark:text-stone-300">Study guides and flashcards share 5 attempts per 24 hours, with at least 60 seconds between attempts. Failed AI requests also count. Reviewing saved decks uses no attempts.</p>
          <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-5 py-3 font-medium text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 disabled:cursor-wait disabled:opacity-50">{pending && <LoaderCircle size={18} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}Generate flashcards</button>
        </form>
      )}
      <p role="status" aria-live="polite" className={feedbackStyle}>{feedback}</p>
      {!editing && result?.deck && <section className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 ref={resultHeading} tabIndex={-1} className="break-words text-2xl font-semibold outline-none">{result.deck.title}</h2><p className="mt-2 text-sm text-stone-600 dark:text-stone-300">{saveLabel}</p></div>
          <div className="flex flex-wrap gap-3">
            {result.status === "success" && result.studySetId && <Link href={"/library/" + result.studySetId} className="rounded-lg bg-emerald-800 px-4 py-2 text-sm text-white hover:bg-emerald-900">Open saved deck</Link>}
            <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-4 py-2 text-sm"><Pencil size={16} aria-hidden="true" />Edit details</button>
          </div>
        </div>
        {result.deck.sourceNote && <p className="text-sm text-stone-600 dark:text-stone-300">Based on your notes: <Link href={"/library/" + result.deck.sourceNote.id} className="text-emerald-800 dark:text-emerald-200 underline">{result.deck.sourceNote.title}</Link>.</p>}
        {result.deck.sourceGuide && <p className="text-sm text-stone-600 dark:text-stone-300">Based on your study guide: <Link href={"/library/" + result.deck.sourceGuide.id} className="text-emerald-800 dark:text-emerald-200 underline">{result.deck.sourceGuide.title}</Link>.</p>}
        <FlashcardReview key={revision} cards={result.deck.cards} />
      </section>}
    </section>
  );
}
