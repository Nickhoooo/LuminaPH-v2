import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StudyContent from "@/components/study/StudyContent";
import GroupLessonControls from "../../../components/GroupLessonControls";

export default async function GroupLessonPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id, lessonId } = await params;
  const validId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!validId.test(id) || !validId.test(lessonId)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");
  const groupUrl = `/study-tools/study-groups/${id}#group-track`;
  const buttonStyle =
    "inline-flex rounded-xl border border-stone-300 dark:border-stone-700 px-4 py-3 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800";
  const loadError = (
    <div className="space-y-4">
      <p role="alert" className="text-red-700 dark:text-red-200">
        We could not load the lesson. Please refresh.
      </p>
      <Link href={groupUrl} className={buttonStyle}>
        Back to group
      </Link>
    </div>
  );

  const { data: group, error: groupError } = await supabase
    .from("study_groups")
    .select("id, owner_id")
    .eq("id", id)
    .maybeSingle();
  if (groupError) return loadError;
  if (!group) notFound();
  const { data: track, error: trackError } = await supabase
    .from("group_study_tracks")
    .select("id, title")
    .eq("group_id", id)
    .maybeSingle();
  if (trackError) return loadError;
  if (!track) notFound();
  // Both the URL group and the lesson's track must match; RLS checks membership.
  const { data: lesson, error: lessonError } = await supabase
    .from("group_track_lessons")
    .select("id, title, objective, position, content")
    .eq("id", lessonId)
    .eq("track_id", track.id)
    .maybeSingle();
  if (lessonError) return loadError;
  if (!lesson) notFound();

  const [progressResult, nextResult, quizResult] = await Promise.all([
    supabase
      .from("group_track_lesson_progress")
      .select("completed_at")
      .eq("lesson_id", lessonId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("group_track_lessons")
      .select("id, title")
      .eq("track_id", track.id)
      .eq("position", lesson.position + 1)
      .maybeSingle(),
    supabase
      .from("group_track_quizzes")
      .select("id, generated_at")
      .eq("lesson_id", lessonId)
      .maybeSingle(),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link href={groupUrl} className={buttonStyle}>
        Back to group track
      </Link>
      <header className="space-y-3">
        <p className="break-words text-sm font-medium text-emerald-800 dark:text-emerald-200">
          {track.title} · Lesson {lesson.position} of 5
        </p>
        <h1 className="break-words text-3xl font-semibold text-stone-900 dark:text-stone-200">
          {lesson.title}
        </h1>
        <p className="break-words text-sm leading-6 text-stone-600 dark:text-stone-300">
          {lesson.objective}
        </p>
      </header>

      {lesson.content ? (
        <>
          <p className="text-xs leading-5 text-stone-500 dark:text-stone-400">
            Shared AI-generated lesson. Check important facts against your class
            materials.
          </p>
          <article className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5 sm:p-8">
            <StudyContent content={lesson.content} />
          </article>
          <section className="space-y-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950 p-6">
            <h2 className="font-semibold text-emerald-950 dark:text-emerald-200">
              Finished reading?
            </h2>
            <p className="text-sm text-stone-600 dark:text-stone-300">
              Completion records your reading progress. It does not mark the
              quiz complete.
            </p>
            {progressResult.error ? (
              <p role="alert" className="text-sm text-red-700 dark:text-red-200">
                Could not load your completion status. Refresh to check it.
              </p>
            ) : progressResult.data ? (
              <p className="font-medium text-emerald-800 dark:text-emerald-200">
                You completed this lesson.
              </p>
            ) : (
              <GroupLessonControls
                groupId={id}
                lessonId={lessonId}
                mode="complete"
              />
            )}
          </section>
        </>
      ) : (
        <section className="space-y-4 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6">
          <h2 className="text-lg font-semibold">
            This lesson is not ready yet
          </h2>
          {group.owner_id === user.id ? (
            <GroupLessonControls
              groupId={id}
              lessonId={lessonId}
              mode="generate"
            />
          ) : (
            <p className="text-sm text-stone-600 dark:text-stone-300">
              Your group owner needs to prepare this shared lesson. Check back
              later.
            </p>
          )}
        </section>
      )}

      <nav
        aria-label="Lesson navigation"
        className="flex flex-wrap items-center gap-3"
      >
        <Link href={groupUrl} className={buttonStyle}>
          Back to group
        </Link>
        {quizResult.error ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-200">
            Could not load the lesson quiz.
          </p>
        ) : quizResult.data && progressResult.data && !progressResult.error ? (
          <Link
            href={`/study-tools/study-groups/${id}/quizzes/${quizResult.data.id}`}
            className={buttonStyle}
          >
            {quizResult.data.generated_at
              ? "Take lesson quiz"
              : group.owner_id === user.id
                ? "Prepare lesson quiz"
                : "View quiz details"}
          </Link>
        ) : (
          quizResult.data && (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Mark this lesson complete to unlock its quiz.
            </p>
          )
        )}
        {nextResult.error ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-200">
            Could not load the next lesson. Return to the group track.
          </p>
        ) : nextResult.data ? (
          <Link
            href={`/study-tools/study-groups/${id}/lessons/${nextResult.data.id}`}
            className="inline-flex rounded-xl bg-emerald-800 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-900"
          >
            Next lesson →
          </Link>
        ) : lesson.position === 5 ? (
          <p className="text-sm text-stone-600 dark:text-stone-300">
            Last lesson in this track. Return to the group to review your
            activities.
          </p>
        ) : null}
      </nav>
    </div>
  );
}
