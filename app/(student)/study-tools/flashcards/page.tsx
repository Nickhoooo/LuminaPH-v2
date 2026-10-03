import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FlashcardForm from "./FlashcardForm";

export default async function FlashcardsPage({ searchParams }: {
  searchParams: Promise<{ note?: string | string[]; guide?: string | string[]; mode?: string; page?: string }>;
}) {
  const { note, guide, mode, page } = await searchParams;
  if (guide !== undefined || mode === "guide") {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) redirect("/login");
    if (guide !== undefined) {
      if (note !== undefined || typeof guide !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guide)) {
        return <p role="alert">Invalid source selection. <Link href="/study-tools/flashcards?mode=guide" className="underline">Choose a guide</Link></p>;
      }
      const { data, error } = await supabase.from("study_sets").select("id, title, subject")
        .eq("id", guide).eq("user_id", user.id).eq("material_type", "study_guide").maybeSingle();
      if (error || !data) return <p role="alert">This guide could not be loaded. <Link href="/study-tools/flashcards?mode=guide" className="underline">Choose another guide</Link></p>;
      return <FlashcardForm key={data.id} sourceGuide={data} />;
    }
    const requestedPage = Number(page ?? "1");
    const currentPage = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100000) : 1;
    const { data: guides, error, count } = await supabase.from("study_sets")
      .select("id, title, subject, created_at", { count: "exact" })
      .eq("user_id", user.id).eq("material_type", "study_guide")
      .order("created_at", { ascending: false }).order("id")
      .range((currentPage - 1) * 20, currentPage * 20 - 1);
    return <section className="mx-auto max-w-3xl space-y-5">
      <Link href="/study-tools/flashcards" className="text-sm text-emerald-800 dark:text-emerald-200 underline">Back to topic mode</Link>
      <h1 className="text-3xl font-semibold">Choose a saved study guide</h1>
      <p className="text-sm text-stone-600 dark:text-stone-300">Create a separate flashcard deck from a guide you have already saved.</p>
      {error ? <p role="alert">We could not load your guides. Please refresh to try again.</p> : <>
        {!guides?.length && <p>No guides on this page. <Link href="/study-tools/study-guides" className="text-emerald-800 dark:text-emerald-200 underline">Create a study guide</Link></p>}
        <ul className="space-y-3">{guides?.map((item) => <li key={item.id}><Link href={"/study-tools/flashcards?guide=" + item.id} className="block rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5 hover:border-emerald-700"><span className="font-semibold">{item.title}</span><span className="mt-1 block text-sm text-stone-600 dark:text-stone-300">{item.subject} · {new Date(item.created_at).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}</span></Link></li>)}</ul>
        <nav aria-label="Guide pages" className="flex gap-4 text-sm text-emerald-800 dark:text-emerald-200">
          {currentPage > 1 && <Link href={"?mode=guide&page=" + (currentPage - 1)}>Previous</Link>}
          {(count ?? 0) > currentPage * 20 && <Link href={"?mode=guide&page=" + (currentPage + 1)}>Next</Link>}
        </nav>
      </>}
    </section>;
  }
  if (note === undefined) return <FlashcardForm key="general" />;

  let problem = "";
  let sourceNote: { id: string; title: string; subject: string | null } | undefined;
  if (typeof note !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(note)) {
    problem = "This note link is invalid. Choose a personal note from your Library.";
  } else {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) redirect("/login");
    const { data, error } = await supabase.from("study_sets")
      .select("id, title, subject")
      .eq("id", note)
      .eq("user_id", user.id)
      .eq("material_type", "notes")
      .maybeSingle();
    if (error) problem = "We could not load your note. Please try again.";
    else if (!data) problem = "This note is unavailable. Choose one of your personal notes.";
    else sourceNote = data;
  }

  if (!sourceNote) {
    return <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Could not open note</h1>
      <p role="alert" className="text-sm text-stone-600 dark:text-stone-300">{problem}</p>
      <div className="flex flex-wrap gap-4 text-sm text-emerald-800 dark:text-emerald-200">
        <Link href="/library" className="underline">Back to Library</Link>
        <Link href="/study-tools/flashcards" className="underline">Start without notes</Link>
      </div>
    </section>;
  }
  return <FlashcardForm key={sourceNote.id} sourceNote={sourceNote} />;
}
