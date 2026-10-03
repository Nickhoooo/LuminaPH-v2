import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StudyContent from "@/components/study/StudyContent";

type SharedMaterialPageProps = {
  params: Promise<{ id: string; materialId: string }>;
};

export default async function SharedMaterialPage({
  params,
}: SharedMaterialPageProps) {
  const { id, materialId } = await params;
  const validId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!validId.test(id) || !validId.test(materialId)) {
    notFound();
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    redirect("/login");
  }

  // Read the group snapshot, never another user's personal Library record.
  // RLS checks current membership for every request.
  const { data: material, error } = await supabase
    .from("study_group_materials")
    .select("id, title, subject, material_type, content, shared_by_name")
    .eq("id", materialId)
    .eq("group_id", id)
    .maybeSingle();

  const groupUrl = `/study-tools/study-groups/${id}#shared-materials`;
  if (error) {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-red-700 dark:text-red-200">
          We could not load this shared material. Please try again.
        </p>
        <Link
          href={groupUrl}
          className="inline-flex rounded-xl border border-stone-300 dark:border-stone-700 px-4 py-2"
        >
          Back to group
        </Link>
      </div>
    );
  }
  if (!material) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        href={groupUrl}
        className="inline-flex rounded-xl border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800"
      >
        Back to group materials
      </Link>
      <header className="space-y-3">
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
          Shared {material.material_type === "notes" ? "note" : "study guide"}
        </p>
        <h1 className="break-words text-3xl font-semibold">{material.title}</h1>
        {material.subject && (
          <p className="break-words text-stone-600 dark:text-stone-300">{material.subject}</p>
        )}
        <p className="break-words text-sm text-stone-500 dark:text-stone-400">
          Shared by {material.shared_by_name} · name at time of sharing
        </p>
        <p className="text-sm leading-6 text-stone-600 dark:text-stone-300">
          This is a saved group copy. Changes to the original Library material
          do not update this version.
        </p>
        {material.material_type === "study_guide" && (
          <p className="text-sm text-stone-600 dark:text-stone-300">
            AI-generated content can contain mistakes. Check important details
            against your class materials.
          </p>
        )}
      </header>
      <article className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6">
        {material.material_type === "study_guide" ? (
          <StudyContent content={material.content} />
        ) : (
          <div className="whitespace-pre-wrap break-words text-sm leading-7">
            {material.content}
          </div>
        )}
      </article>
      <Link
        href={groupUrl}
        className="inline-flex rounded-xl bg-emerald-800 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-900"
      >
        Done reading · Back to group
      </Link>
    </div>
  );
}
