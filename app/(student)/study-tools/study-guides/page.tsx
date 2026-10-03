import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StudyGuideForm from "./StudyGuideForm";

type PageProps = {
  searchParams: Promise<{
    note?: string | string[];
  }>;
};

export default async function StudyGuidesPage({
  searchParams,
}: PageProps) {
  const { note } = await searchParams;

  // Normal visit: no selected note.
  if (note === undefined) {
    return <StudyGuideForm key="general" />;
  }

  const validId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (typeof note !== "string" || !validId.test(note)) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Invalid note link</h1>
        <Link href="/library" className="text-emerald-800 dark:text-emerald-200 underline">
          Back to Library
        </Link>
      </section>
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: sourceNote, error } = await supabase
    .from("study_sets")
    .select("id, title, subject")
    .eq("id", note)
    .eq("user_id", user.id)
    .eq("material_type", "notes")
    .maybeSingle();

  if (error || !sourceNote) {
    let message = "This note is unavailable. Choose a saved personal note.";

    if (error) {
      message = "We could not load your note. Please try again.";
    }

    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Could not open note</h1>
        <p role="alert" className="text-sm text-stone-600 dark:text-stone-300">
          {message}
        </p>
        <Link href="/library" className="text-emerald-800 dark:text-emerald-200 underline">
          Back to Library
        </Link>
      </section>
    );
  }

  return (
    <StudyGuideForm
      key={sourceNote.id}
      sourceNote={sourceNote}
    />
  );
}
