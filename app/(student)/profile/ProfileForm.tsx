"use client";
import { useActionState, useState } from "react";
import { BookOpen, GraduationCap, Languages, Mail, Pencil, Save } from "lucide-react";
import type { StudyPreferences } from "@/lib/study-preferences";
import { saveProfile, type ProfileState } from "./actions";

export default function ProfileForm({ profile, email }: { profile: StudyPreferences & { full_name: string }; email: string }) {
  const [fields, setFields] = useState(profile);
  const [savedProfile, setSavedProfile] = useState(profile);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const [state, action, pending] = useActionState(async (previous: ProfileState, data: FormData): Promise<ProfileState> => {
    try {
      const next = await saveProfile(previous, data);
      if (next.status === "success") {
        setSavedProfile({ ...fields, full_name: fields.full_name.trim(), academicDetails: fields.academicDetails.trim() });
        setEditing(false);
        setNotice(next.message);
      }
      return next;
    } catch {
      return { status: "error", message: "Connection interrupted. Your changes are still here; please try saving again." };
    }
  }, { status: "idle", message: "" } as ProfileState);
  const input = "mt-2 w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 p-3 focus:border-emerald-700 focus:outline-2 focus:outline-emerald-700";
  const levels: Record<string, string> = { "junior-high": "Junior High School", "senior-high": "Senior High School", college: "College", independent: "Independent learning" };
  const languages: Record<string, string> = { english: "English", filipino: "Filipino", taglish: "Taglish" };
  const initials = savedProfile.full_name.trim().split(/\s+/).slice(0, 2).map(part => part[0] ?? "").join("").toUpperCase() || "L";
  function update(name: keyof typeof fields, value: string) { setFields(previous => ({ ...previous, [name]: value })); }
  return <div className="space-y-6">
    <header className="overflow-hidden rounded-3xl border border-[#e3e8dd] dark:border-stone-700 bg-white dark:bg-stone-900">
      <div aria-hidden="true" className="flex h-24 items-center justify-end bg-[#e8eddf] dark:bg-stone-800 px-7 sm:h-32"><BookOpen size={64} strokeWidth={1} className="text-[#bcccad] dark:text-stone-200" /></div>
      <div className="px-5 pb-7 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="-mt-10 grid size-20 place-items-center rounded-2xl border-4 border-white bg-[#315b46] font-serif text-3xl text-white shadow-sm sm:size-24">{initials}</div>
          {!editing && <button type="button" onClick={() => { setFields(savedProfile); setNotice(""); setEditing(true); }} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 dark:border-stone-700 px-4 py-2.5 text-sm font-medium text-emerald-900 dark:text-emerald-200 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800"><Pencil size={16} aria-hidden="true" />Edit profile</button>}
        </div>
        <h2 className="mt-5 break-words font-serif text-3xl tracking-tight text-[#2c4a36] dark:text-stone-200">{savedProfile.full_name}</h2>
        <p className="mt-2 flex items-start gap-2 text-sm text-stone-500 dark:text-stone-400"><Mail size={16} aria-hidden="true" className="mt-0.5 shrink-0" /><span className="min-w-0 break-words">{email}</span></p>
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#f0f4eb] dark:bg-stone-800 px-3 py-1 text-xs font-medium text-[#536b48] dark:text-stone-200"><GraduationCap size={15} aria-hidden="true" />{levels[savedProfile.educationLevel] ?? "LuminaPH learner"}</span>
      </div>
    </header>
    <p role="status" className="text-sm text-emerald-800 dark:text-emerald-200">{notice}</p>
    {!editing ? <section className="grid gap-6 sm:grid-cols-[1fr_2fr]">
      <div><h3 className="text-lg font-semibold">How you study</h3><p className="mt-2 max-w-xs text-sm leading-6 text-stone-500 dark:text-stone-400">A few details that help LuminaPH start your study sessions your way.</p></div>
      <dl className="divide-y divide-stone-100 dark:divide-stone-700 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-5 sm:px-6">
        <div className="py-5"><dt className="flex items-center gap-2 text-xs font-medium text-stone-500 dark:text-stone-400"><GraduationCap size={16} aria-hidden="true" />Education level</dt><dd className="mt-2 text-sm font-medium">{levels[savedProfile.educationLevel] ?? "Choose per study session"}</dd></div>
        <div className="py-5"><dt className="flex items-center gap-2 text-xs font-medium text-stone-500 dark:text-stone-400"><BookOpen size={16} aria-hidden="true" />Grade, year & course</dt><dd className="mt-2 break-words text-sm font-medium">{savedProfile.academicDetails || "Not added yet"}</dd></div>
        <div className="py-5"><dt className="flex items-center gap-2 text-xs font-medium text-stone-500 dark:text-stone-400"><Languages size={16} aria-hidden="true" />Explanation language</dt><dd className="mt-2 text-sm font-medium">{languages[savedProfile.language] ?? "Taglish"}</dd></div>
      </dl>
    </section> : <form action={action} aria-busy={pending} className="space-y-5 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5 sm:p-7">
    <div><h3 className="text-lg font-semibold">Edit your profile</h3><p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Update your name and the defaults for your next study session.</p></div>
    <fieldset disabled={pending} className="space-y-5"><legend className="sr-only">Profile and study preferences</legend>
      <label className="block text-sm font-medium">Display name<input name="full_name" required maxLength={80} autoComplete="nickname" value={fields.full_name} onChange={e => update("full_name", e.target.value)} className={input} /></label>
      <label className="block text-sm font-medium">Education level (optional)<select name="educationLevel" value={fields.educationLevel} onChange={e => update("educationLevel", e.target.value)} className={input}><option value="">Choose per study session</option><option value="junior-high">Junior High School</option><option value="senior-high">Senior High School</option><option value="college">College</option><option value="independent">Independent learning</option></select></label>
      <label className="block text-sm font-medium">Grade/year and course or strand (optional)<input name="academicDetails" maxLength={120} placeholder="Example: Grade 11 HUMSS or First-year Nursing" value={fields.academicDetails} onChange={e => update("academicDetails", e.target.value)} className={input} /></label>
      <label className="block text-sm font-medium">Preferred explanation language<select name="language" value={fields.language} onChange={e => update("language", e.target.value)} className={input}><option value="english">English</option><option value="filipino">Filipino</option><option value="taglish">Taglish</option></select></label>
    </fieldset>
    <p className="text-xs leading-6 text-stone-500 dark:text-stone-400">These are starting defaults, editable per study session. Cards and quizzes based on a saved guide follow that guide’s level. Existing materials stay unchanged.</p>
    <p role="status" className={state.status === "error" ? "text-sm text-red-700 dark:text-red-200" : "text-sm text-emerald-800 dark:text-emerald-200"}>{state.message}</p>
    <div className="flex flex-wrap gap-3 border-t border-stone-100 dark:border-stone-700 pt-5"><button disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-900 disabled:opacity-50"><Save size={18} aria-hidden="true" />{pending ? "Saving…" : "Save changes"}</button><button type="button" disabled={pending} onClick={() => { setFields(savedProfile); setEditing(false); }} className="rounded-xl border border-stone-200 dark:border-stone-700 px-5 py-3 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-50">Cancel</button></div>
  </form>}
  </div>;
}
