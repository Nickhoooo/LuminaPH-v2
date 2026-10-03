"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, History, LoaderCircle, PencilLine } from "lucide-react";
import QuizPractice from "@/components/study/QuizPractice";
import { useStudyPreferences } from "@/components/study/StudyPreferencesProvider";
import { createQuiz, type QuizState } from "./actions";

export default function QuizForm({ sourceGuide }: { sourceGuide?: { id: string; title: string } }) {
  const [state, action, pending] = useActionState(async (previous: QuizState, data: FormData) => {
    try { return await createQuiz(previous, data); }
    catch { return { status: "error" as const, message: "Connection interrupted. Check your Library before generating again; the attempt may have counted." }; }
  }, { status: "idle", message: "" } as QuizState);
  const preferences = useStudyPreferences();
  const [fields, setFields] = useState({ ...preferences, subject: "", learningGoal: "", questionCount: "5" });
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (state.quiz) heading.current?.focus(); }, [state.quiz]);
  const input = "mt-2 w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 p-3";
  const button = "rounded-lg bg-emerald-800 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-900 disabled:opacity-50";
  function update(name: keyof typeof fields, value: string) { setFields(previous => ({ ...previous, [name]: value })); }

  return <section className="mx-auto max-w-3xl space-y-6">
    <header><h1 className="text-3xl font-semibold">Quizzes</h1><p className="mt-2 text-sm text-stone-600 dark:text-stone-300">Practice with multiple-choice questions, then review your score and explanations.</p></header>
    {!state.quiz && <form action={action} aria-busy={pending} className="space-y-5 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6">
      {!pending && <nav aria-label="Quiz source" className="grid gap-3 sm:grid-cols-2">
        <Link href="/study-tools/quizzes" aria-current={!sourceGuide ? "page" : undefined} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-800/25 bg-white dark:bg-stone-900 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-200 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950 aria-[current=page]:border-emerald-800 aria-[current=page]:bg-emerald-800 aria-[current=page]:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 motion-reduce:transition-none"><PencilLine size={18} aria-hidden="true" className="shrink-0" />Start with a topic</Link>
        <Link href="/study-tools/quizzes?mode=guide" aria-current={sourceGuide ? "page" : undefined} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-800/25 bg-white dark:bg-stone-900 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-200 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950 aria-[current=page]:border-emerald-800 aria-[current=page]:bg-emerald-800 aria-[current=page]:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 motion-reduce:transition-none"><BookOpen size={18} aria-hidden="true" className="shrink-0" />Use a saved study guide</Link>
      </nav>}
      {sourceGuide && <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950 p-4"><input type="hidden" name="sourceGuideId" value={sourceGuide.id} /><p className="font-medium">Using: {sourceGuide.title}</p><p className="mt-2 text-sm">The guide content is sent to our AI provider. Your original guide stays unchanged.</p></div>}
      <fieldset disabled={pending} className="space-y-4">
        <legend className="sr-only">Quiz details</legend>
        {!sourceGuide && <>
          <label className="block text-sm font-medium">Education level<select name="educationLevel" required value={fields.educationLevel} onChange={e => update("educationLevel", e.target.value)} className={input}><option value="" disabled>Select your level</option><option value="junior-high">Junior High School</option><option value="senior-high">Senior High School</option><option value="college">College</option><option value="independent">Independent learning</option></select></label>
          <label className="block text-sm font-medium">Grade/year and course or strand (optional)<input name="academicDetails" maxLength={120} value={fields.academicDetails} onChange={e => update("academicDetails", e.target.value)} className={input} /></label>
          <label className="block text-sm font-medium">Subject<input name="subject" required maxLength={120} value={fields.subject} onChange={e => update("subject", e.target.value)} className={input} /></label>
          <label className="block text-sm font-medium">What do you want to practice?<textarea name="learningGoal" required maxLength={1000} rows={3} value={fields.learningGoal} onChange={e => update("learningGoal", e.target.value)} className={input} /></label>
        </>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Language<select name="language" value={fields.language} onChange={e => update("language", e.target.value)} className={input}><option value="english">English</option><option value="filipino">Filipino</option><option value="taglish">Taglish</option></select></label>
          <label className="text-sm font-medium">Questions<select name="questionCount" value={fields.questionCount} onChange={e => update("questionCount", e.target.value)} className={input}><option value="5">5 questions</option><option value="10">10 questions</option></select></label>
        </div>
      </fieldset>
      <p className="text-xs leading-6 text-stone-500 dark:text-stone-400">All AI study tools share 5 generation attempts per 24 hours, at least 60 seconds apart. Failed AI requests count. Answering or retaking a saved quiz uses no AI attempts.</p>
      <button disabled={pending} className={button + " inline-flex items-center gap-2"}>{pending && <LoaderCircle size={17} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}{pending ? "Generating…" : "Generate quiz"}</button>
    </form>}
    <p role="status" className={state.status === "error" ? "text-sm text-red-700 dark:text-red-200" : "text-sm text-emerald-800 dark:text-emerald-200"}>{state.message}</p>
    {state.quiz && <>
      <h2 ref={heading} tabIndex={-1} className="text-2xl font-semibold outline-none">{state.quiz.title}</h2>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {state.quiz.sourceGuide && <Link href={"/library/" + state.quiz.sourceGuide.id} className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl border border-emerald-800/25 bg-white dark:bg-stone-900 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-200 transition-colors hover:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 motion-reduce:transition-none"><BookOpen size={18} aria-hidden="true" className="shrink-0" /><span className="min-w-0 break-words">Source guide: {state.quiz.sourceGuide.title}</span></Link>}
        {state.studySetId && <Link href={"/library/" + state.studySetId} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 motion-reduce:transition-none"><History size={18} aria-hidden="true" className="shrink-0" />Open saved quiz and attempt history</Link>}
      </div>
      {state.studySetId ? <>
        <QuizPractice key={state.studySetId} studySetId={state.studySetId} questions={state.quiz.questions.map(({ question, choices }) => ({ question, choices }))} />
      </> : <label className="block text-sm">Save was not confirmed. Copy this quiz backup before leaving; scored attempts require a saved quiz.<textarea readOnly rows={12} value={JSON.stringify(state.quiz, null, 2)} className={input} onFocus={e => e.target.select()} /></label>}
    </>}
  </section>;
}
