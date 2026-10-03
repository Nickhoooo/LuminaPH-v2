"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useStudyPreferences } from "@/components/study/StudyPreferencesProvider";
import { createLearningPath, type LearningPathState } from "./actions";

export default function LearningPathForm() {


  const preferences = useStudyPreferences();
  const [fields, setFields] = useState({ ...preferences, subject: "", learningGoal: "", lessonCount: "5" });
  const heading = useRef<HTMLHeadingElement>(null);

    const [state, action, pending] = useActionState(async (previous: LearningPathState, data: FormData): Promise<LearningPathState> => {
      try { return await createLearningPath(previous, data); }
      catch { return { status: "error", message: "Connection interrupted. Check your saved paths before generating again; the attempt may have counted." }; }
    }, { status: "idle", message: "" });

        useEffect(() => { 
          if (state.outline) heading.current?.focus(); 
        }, [state.outline]);

  function update(name: keyof typeof fields, value: string) { setFields(previous => ({ ...previous, [name]: value })); }
  const input = "mt-2 w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 p-3";


  return <section className="space-y-5">
    {!state.outline && <form action={action} 
                            aria-busy={pending} 
                            className="space-y-5 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5 sm:p-7">

      <div>
        <h2 className="text-xl font-semibold">Build your study plan</h2>
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">Start with a goal. Get an ordered outline of what to learn next.
        </p>
      </div>

      <fieldset disabled={pending} 
                className="space-y-4">
      <legend className="sr-only">Learning path details</legend>

        <label 
          className="block text-sm font-medium">Subject
          <input name="subject" 
                 required maxLength={120} 
                 value={fields.subject} 
                 onChange={e => update("subject", e.target.value)} placeholder="Example: Biology, History, or Accounting" 
                 className={input} />
        </label>

        <label className="block text-sm font-medium">Learning goal
          <textarea 
            name="learningGoal" 
            required maxLength={1000} 
            rows={3} 
            value={fields.learningGoal} 
            onChange={e => update("learningGoal", e.target.value)} 
            placeholder="What would you like to understand or be able to do?" className={input} />
        </label>

        <label className="block text-sm font-medium">Education level
            <select 
              name="educationLevel" 
              required value={fields.educationLevel} 
              onChange={e => update("educationLevel", e.target.value)} 
              className={input}>
                <option value="" disabled>Select your level</option>
                <option value="junior-high">Junior High School</option>
                <option value="senior-high">Senior High School</option>
                <option value="college">College</option>
                <option value="independent">Independent learning</option>
            </select>
        </label>

        <label className="block text-sm font-medium">Grade/year and course or strand (optional)
          <input 
            name="academicDetails" 
            maxLength={120} 
            value={fields.academicDetails} 
            onChange={e => update("academicDetails", e.target.value)} 
            className={input} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Language
            <select 
              name="language" 
              value={fields.language} 
              onChange={e => update("language", e.target.value)} 
              className={input}>
                <option value="english">English</option>
                <option value="filipino">Filipino</option>
                <option value="taglish">Taglish</option>
              </select>
          </label>

          <label className="text-sm font-medium">Lessons<select 
            name="lessonCount" 
            value={fields.lessonCount} 
            onChange={e => update("lessonCount", e.target.value)} 
            className={input}>{[3,4,5,6,7,8].map(count => 
            <option key={count} value={count}>{count} lessons</option>)}
            </select>
          </label>

        </div>
      </fieldset>

      <p className="text-xs leading-6 text-stone-500 dark:text-stone-400">Generates titles and objectives only, not full lessons. All AI study tools share 5 attempts per 24 hours, at least 60 seconds apart. Failed AI requests count.</p>

      <button 
        disabled={pending} 
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-900 disabled:opacity-50">{pending && <LoaderCircle size={17} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}{pending ? "Building outline…" : "Generate learning path"}
      </button>
    </form>}

    <p role="status" className={state.status === "error" ? "text-sm text-red-700 dark:text-red-200" : "text-sm text-emerald-800 dark:text-emerald-200"}>{state.message}
    </p> {state.outline && <section className="space-y-4 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6">

      <h2 ref={heading} tabIndex={-1} className="break-words text-2xl font-semibold outline-none">{state.outline.title}</h2>

      <ol 
        className="list-decimal space-y-4 pl-5">{state.outline.lessons.map((lesson, index) => 
        <li key={index}>
          <h3 className="break-words font-medium">{lesson.title}</h3>
          <p className="mt-1 break-words text-sm leading-6 text-stone-500 dark:text-stone-400">{lesson.objective}</p>
        </li>)}
      </ol>

      {state.pathId ? 
        <Link 
          href={"/study-tools/learning-paths?path=" + state.pathId} className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-900">Open saved path <ArrowRight size={17} aria-hidden="true" />
        </Link> : <label className="block text-sm">Copy this outline before leaving. Check saved paths before retrying.<textarea readOnly rows={8} value={JSON.stringify(state.outline, null, 2)} onFocus={e => e.target.select()} className={input} /></label>}
    </section>}
  </section>;
}
