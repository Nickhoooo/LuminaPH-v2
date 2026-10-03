import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, NotebookPen, Share2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ShareMaterialForm from "./ShareMaterialForm";
import RemoveSharedMaterialForm from "./RemoveSharedMaterialForm";

type SharedMaterialsProps = {
  groupId: string;
  userId: string;
  isOwner: boolean;
  membersPage: number;
  libraryPage?: string | string[];
  materialsPage?: string | string[];
};

function readPage(value: string | string[] | undefined) {
  const page = typeof value === "string" ? Number(value) : 1;
  return Number.isInteger(page) && page >= 1 && page <= 50000 ? page : 1;
}

export default async function SharedMaterials(props: SharedMaterialsProps) {
  const libraryPage = readPage(props.libraryPage);
  const materialsPage = readPage(props.materialsPage);
  const pageSize = 20;
  const groupUrl = `/study-tools/study-groups/${props.groupId}`;
  const supabase = await createClient();

  // Fetch titles only for the lists. Full text is loaded on the reader page.
  const [library, shared] = await Promise.all([
    supabase
      .from("study_sets")
      .select("id, title, material_type", { count: "exact" })
      .eq("user_id", props.userId)
      .in("material_type", ["notes", "study_guide"])
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range((libraryPage - 1) * pageSize, libraryPage * pageSize - 1),
    supabase
      .from("study_group_materials")
      .select("id, title, subject, material_type, shared_by, shared_by_name", {
        count: "exact",
      })
      .eq("group_id", props.groupId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range((materialsPage - 1) * pageSize, materialsPage * pageSize - 1),
  ]);

  function pageLink(nextLibraryPage: number, nextMaterialsPage: number) {
    const query = new URLSearchParams({
      membersPage: String(props.membersPage),
      libraryPage: String(nextLibraryPage),
      materialsPage: String(nextMaterialsPage),
    });
    return `${groupUrl}?${query}#shared-materials`;
  }

  const libraryOutOfRange =
    !library.error && libraryPage > 1 && !library.data?.length;
  const sharedOutOfRange =
    !shared.error && materialsPage > 1 && !shared.data?.length;
  if (libraryOutOfRange || sharedOutOfRange) {
    redirect(
      pageLink(
        libraryOutOfRange ? 1 : libraryPage,
        sharedOutOfRange ? 1 : materialsPage,
      ),
    );
  }

  const linkStyle =
    "rounded-lg border border-stone-300 dark:border-stone-700 px-3 py-2 text-sm hover:bg-stone-50 dark:hover:bg-stone-800";

  return (
    <section
      id="shared-materials"
      aria-labelledby="shared-materials-heading"
      className="space-y-5 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6"
    >
      <div>
        <h2
          id="shared-materials-heading"
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <BookOpen size={20} aria-hidden="true" /> Shared materials
          {!shared.error && (
            <span className="text-sm font-normal text-stone-500 dark:text-stone-400">
              ({shared.count ?? 0})
            </span>
          )}
        </h2>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
          Notes and study guides shared with this group. Each is a separate
          saved copy.
        </p>
      </div>

      <details
        open={libraryPage > 1 || undefined}
        className="rounded-xl border border-stone-200 dark:border-stone-700 p-4"
      >
        <summary className="cursor-pointer text-sm font-semibold text-emerald-800 dark:text-emerald-200">
          <Share2 size={16} aria-hidden="true" className="mr-2 inline" /> Share
          from my Library
        </summary>
        <div className="mt-4 space-y-4">
          {library.error ? (
            <p role="alert" className="text-sm text-red-700 dark:text-red-200">
              We could not load your Library. Refresh to try again.
            </p>
          ) : !library.data?.length ? (
            <p className="text-sm text-stone-600 dark:text-stone-300">
              No notes or study guides to share yet.{" "}
              <Link
                href="/library"
                className="font-medium text-emerald-800 dark:text-emerald-200 underline"
              >
                Open my Library
              </Link>
            </p>
          ) : (
            <>
              <ShareMaterialForm
                key={libraryPage}
                groupId={props.groupId}
                materials={library.data}
              />
              {(libraryPage > 1 ||
                libraryPage * pageSize < (library.count ?? 0)) && (
                <nav
                  aria-label="Library selection pages"
                  className="flex flex-wrap items-center gap-3"
                >
                  {libraryPage > 1 && (
                    <Link
                      href={pageLink(libraryPage - 1, materialsPage)}
                      className={linkStyle}
                    >
                      Previous choices
                    </Link>
                  )}
                  <span className="text-sm">Library page {libraryPage}</span>
                  {libraryPage * pageSize < (library.count ?? 0) && (
                    <Link
                      href={pageLink(libraryPage + 1, materialsPage)}
                      className={linkStyle}
                    >
                      More choices
                    </Link>
                  )}
                </nav>
              )}
            </>
          )}
        </div>
      </details>

      {shared.error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-200">
          We could not load shared materials. Please refresh the page.
        </p>
      ) : !shared.data?.length ? (
        <p className="rounded-xl bg-stone-50 dark:bg-stone-800 p-5 text-sm text-stone-600 dark:text-stone-300">
          No materials shared yet. Share a note or study guide to start studying
          together.
        </p>
      ) : (
        <ul className="space-y-4">
          {shared.data.map((material) => (
            <li
              key={material.id}
              className="space-y-3 rounded-xl border border-stone-200 dark:border-stone-700 p-4"
            >
              <p className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                {material.material_type === "notes" ? (
                  <NotebookPen size={15} aria-hidden="true" />
                ) : (
                  <BookOpen size={15} aria-hidden="true" />
                )}
                {material.material_type === "notes" ? "Note" : "Study guide"}
              </p>
              <h3 className="break-words font-semibold">{material.title}</h3>
              {material.subject && (
                <p className="break-words text-sm text-stone-600 dark:text-stone-300">
                  {material.subject}
                </p>
              )}
              <p className="break-words text-xs text-stone-500 dark:text-stone-400">
                Shared by {material.shared_by_name}
                {material.shared_by === props.userId ? " (You)" : ""} · name at
                time of sharing
              </p>
              <Link
                href={`${groupUrl}/materials/${material.id}`}
                className="inline-flex rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-900"
              >
                Open material
              </Link>
              {(props.isOwner || material.shared_by === props.userId) && (
                <RemoveSharedMaterialForm
                  groupId={props.groupId}
                  materialId={material.id}
                  title={material.title}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {!shared.error &&
        (materialsPage > 1 ||
          materialsPage * pageSize < (shared.count ?? 0)) && (
          <nav
            aria-label="Shared material pages"
            className="flex flex-wrap items-center gap-3"
          >
            {materialsPage > 1 && (
              <Link
                href={pageLink(libraryPage, materialsPage - 1)}
                className={linkStyle}
              >
                Previous materials
              </Link>
            )}
            <span className="text-sm">Page {materialsPage}</span>
            {materialsPage * pageSize < (shared.count ?? 0) && (
              <Link
                href={pageLink(libraryPage, materialsPage + 1)}
                className={linkStyle}
              >
                Next materials
              </Link>
            )}
          </nav>
        )}
    </section>
  );
}
