import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TutorChat from "./TutorChat";

type PageProps = {
  searchParams: Promise<{ guide?: string | string[]; page?: string }>;
};

export default async function AiTutorPage({ searchParams }: PageProps) {
  const { guide: guideId, page } = await searchParams;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login");

  const requestedPage = Number(page ?? 1);
  const currentPage = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 100000
    ? requestedPage
    : 1;
  const pageSize = 20;

  if (guideId !== undefined) {
    if (typeof guideId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guideId)) {
      return <p role="alert">Invalid guide link. <Link href="/study-tools/ai-tutor" className="underline">Choose a guide</Link></p>;
    }

    const { data: guide, error: guideError } = await supabase
      .from("study_sets")
      .select("id, title")
      .eq("id", guideId)
      .eq("user_id", user.id)
      .eq("material_type", "study_guide")
      .maybeSingle();

    if (guideError || !guide) {
      return <p role="alert">This guide could not be loaded. <Link href="/study-tools/ai-tutor" className="underline">Choose another guide</Link></p>;
    }

    // Opening a page only reads data. The send action creates a conversation when needed.
    const { data: conversation, error: conversationError } = await supabase
      .from("tutor_conversations")
      .select("id")
      .eq("study_set_id", guide.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (conversationError) {
      return <p role="alert">Could not load your conversation. Refresh before sending a message.</p>;
    }

    const history = conversation
      ? await supabase.from("tutor_turns")
          .select("id, question, answer", { count: "exact" })
          .eq("conversation_id", conversation.id)
          .order("turn_number", { ascending: false })
          .range((currentPage - 1) * pageSize, currentPage * pageSize - 1)
      : { data: [], count: 0, error: null };

    if (history.error) {
      return <p role="alert">Could not load saved messages. Refresh before sending another question.</p>;
    }

    const totalPages = Math.max(1, Math.ceil((history.count ?? 0) / pageSize));
    if (currentPage > totalPages) redirect(`/study-tools/ai-tutor?guide=${guide.id}`);

    const savedTurns = [...(history.data ?? [])].reverse().map(turn => ({ ...turn, saved: true }));

    return (
      <section className="mx-auto max-w-3xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold">AI Tutor</h1>
          <Link href="/study-tools/ai-tutor" className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-4 py-2 text-sm text-emerald-800 dark:text-emerald-200">Choose another guide</Link>
        </header>
        <TutorChat key={`${guide.id}-${currentPage}`} guide={guide} savedTurns={savedTurns} historyPage={currentPage} />
        <nav aria-label="Conversation history" className="flex flex-wrap gap-4 text-sm text-emerald-800 dark:text-emerald-200">
          {currentPage < totalPages && <Link href={`?guide=${guide.id}&page=${currentPage + 1}`}>Older messages</Link>}
          {currentPage > 1 && <Link href={`?guide=${guide.id}&page=${currentPage - 1}`}>Newer messages</Link>}
        </nav>
      </section>
    );
  }

  const { data: guides, count, error } = await supabase
    .from("study_sets")
    .select("id, title, subject", { count: "exact" })
    .eq("user_id", user.id)
    .eq("material_type", "study_guide")
    .order("created_at", { ascending: false })
    .order("id")
    .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-3xl font-semibold">AI Tutor</h1>
        <p className="mt-3 text-sm leading-6 text-stone-500 dark:text-stone-400">Choose a saved guide or path lesson to discuss. Your conversation stays connected to that material.</p>
      </header>
      {error ? <p role="alert">Could not load your guides. Please refresh.</p> : (
        <>
          {!guides?.length && <p>No guides on this page. <Link href="/study-tools/study-guides" className="text-emerald-800 dark:text-emerald-200 underline">Create a study guide</Link> to start.</p>}
          <ul className="space-y-3">
            {guides?.map(guide => (
              <li key={guide.id}>
                <Link href={"/study-tools/ai-tutor?guide=" + guide.id} className="block rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5 hover:border-emerald-700">
                  <h2 className="break-words font-semibold">{guide.title}</h2>
                  <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">{guide.subject}</p>
                  <span className="mt-3 block text-sm font-medium text-emerald-800 dark:text-emerald-200">Open conversation →</span>
                </Link>
              </li>
            ))}
          </ul>
          <nav aria-label="Guide pages" className="flex gap-4 text-sm text-emerald-800 dark:text-emerald-200">
            {currentPage > 1 && <Link href={"?page=" + (currentPage - 1)}>Previous</Link>}
            {(count ?? 0) > currentPage * pageSize && <Link href={"?page=" + (currentPage + 1)}>Next</Link>}
          </nav>
        </>
      )}
    </section>
  );
}
