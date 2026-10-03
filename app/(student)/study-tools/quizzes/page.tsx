import Link from "next/link";
import { BookOpen, PencilLine } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import QuizForm from "./QuizForm";

export default async function QuizzesPage({ searchParams }: { searchParams: Promise<{ guide?: string | string[]; mode?: string; page?: string }> }) {
  const { guide, mode, page } = await searchParams;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");
  if (guide !== undefined) {
    if (typeof guide !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guide)) return <p role="alert">Invalid guide link. <Link href="/study-tools/quizzes?mode=guide" className="underline">Choose a guide</Link></p>;
    const { data, error } = await supabase.from("study_sets").select("id, title").eq("id", guide).eq("user_id", user.id).eq("material_type", "study_guide").maybeSingle();
    if (error || !data) return <p role="alert">Guide unavailable. <Link href="/study-tools/quizzes?mode=guide" className="underline">Choose another guide</Link></p>;
    return <QuizForm key={data.id} sourceGuide={data} />;
  }
  if (mode !== "guide") return <QuizForm key="topic" />;
  const requested = Number(page ?? 1);
  const current = Number.isSafeInteger(requested) && requested > 0 && requested <= 100000 ? requested : 1;
  const { data, error, count } = await supabase.from("study_sets").select("id, title, subject", { count: "exact" })
    .eq("user_id", user.id).eq("material_type", "study_guide").order("created_at", { ascending: false }).order("id")
    .range((current - 1) * 20, current * 20 - 1);
  return <section className="mx-auto max-w-3xl space-y-5">
    <nav aria-label="Quiz source" className="grid gap-3 sm:grid-cols-2">
      <Link href="/study-tools/quizzes" className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-800/25 bg-white dark:bg-stone-900 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-200 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 motion-reduce:transition-none"><PencilLine size={18} aria-hidden="true" className="shrink-0" />Start with a topic</Link>
      <Link href="/study-tools/quizzes?mode=guide" aria-current="page" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 motion-reduce:transition-none"><BookOpen size={18} aria-hidden="true" className="shrink-0" />Use a saved study guide</Link>
    </nav>
    <h1 className="text-3xl font-semibold">Choose a guide for your quiz</h1>
    {error ? <p role="alert">Could not load guides. Please refresh to try again.</p> : <>
      {!data?.length && <p>No guides on this page. <Link href="/study-tools/study-guides" className="underline">Create a study guide</Link></p>}
      <ul className="space-y-3">{data?.map(item => <li key={item.id}><Link href={"/study-tools/quizzes?guide=" + item.id} className="block rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5 hover:border-emerald-700"><span className="font-medium">{item.title}</span><span className="mt-2 block text-sm text-stone-500 dark:text-stone-400">{item.subject}</span></Link></li>)}</ul>
      <nav aria-label="Guide pages" className="flex gap-4 text-sm text-emerald-800 dark:text-emerald-200">{current > 1 && <Link href={"?mode=guide&page=" + (current - 1)}>Previous</Link>}{(count ?? 0) > current * 20 && <Link href={"?mode=guide&page=" + (current + 1)}>Next</Link>}</nav>
    </>}
  </section>;
}
