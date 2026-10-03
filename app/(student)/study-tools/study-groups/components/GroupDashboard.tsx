import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, Check, LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { nextGroupActivity, type GroupDashboardData } from "../group-dashboard";
import GroupTrackForm from "./GroupTrackForm";
import RefreshGroupProgress from "./RefreshGroupProgress";

export default async function GroupDashboard({
  groupId,
  userId,
  isOwner,
  membersPage,
  libraryPage,
  materialsPage,
}: {
  groupId: string;
  userId: string;
  isOwner: boolean;
  membersPage: number;
  libraryPage?: string | string[];
  materialsPage?: string | string[];
}) {
  const supabase = await createClient();
  const base = `/study-tools/study-groups/${groupId}`;
  const { data: track, error: trackError } = await supabase
    .from("group_study_tracks")
    .select("id, title, subject, learning_goal")
    .eq("group_id", groupId)
    .maybeSingle();
  if (trackError)
    return (
      <p role="alert" className="rounded-2xl bg-red-50 dark:bg-red-950 p-6 text-red-700 dark:text-red-200">
        Could not load the shared track. Refresh to try again.
      </p>
    );
  if (!track)
    return (
      <section
        id="group-track"
        className="space-y-5 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-800 dark:text-emerald-200">
          Group study track
        </p>
        <h2 className="text-2xl font-semibold">Your shared plan starts here</h2>
        {isOwner ? (
          <GroupTrackForm groupId={groupId} />
        ) : (
          <p className="text-sm text-stone-600 dark:text-stone-300">
            Your owner is preparing the group plan. Once saved, you will see
            five lessons, five quizzes, and everyone&apos;s progress here.
          </p>
        )}
      </section>
    );

  const [lessonResult, dashboardResult] = await Promise.all([
    supabase
      .from("group_track_lessons")
      .select("id, position, title, objective, generated_at")
      .eq("track_id", track.id)
      .order("position"),
    supabase.rpc("get_group_study_dashboard", {
      p_group_id: groupId,
      p_page: membersPage,
    }),
  ]);
  const lessons = lessonResult.data ?? [];
  const { data: quizzes, error: quizError } = lessons.length
    ? await supabase
        .from("group_track_quizzes")
        .select("id, lesson_id, generated_at")
        .in(
          "lesson_id",
          lessons.map((lesson) => lesson.id),
        )
    : { data: null, error: null };
  if (
    lessonResult.error ||
    dashboardResult.error ||
    quizError ||
    lessons.length !== 5 ||
    !dashboardResult.data?.self ||
    !Array.isArray(dashboardResult.data?.members) ||
    quizzes?.length !== 5
  ) {
    return (
      <section className="space-y-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6">
        <h2 className="text-xl font-semibold">{track.title}</h2>
        <p role="alert" className="text-sm text-red-700 dark:text-red-200">
          Could not load the full group dashboard. Refresh to try again.
        </p>
        <RefreshGroupProgress />
      </section>
    );
  }
  const dashboard = dashboardResult.data as GroupDashboardData;
  function pageLink(page: number) {
    const query = new URLSearchParams({ membersPage: String(page) });
    if (typeof libraryPage === "string") query.set("libraryPage", libraryPage);
    if (typeof materialsPage === "string")
      query.set("materialsPage", materialsPage);
    return `${base}?${query}#group-progress`;
  }
  if (membersPage > 1 && dashboard.members.length === 0) redirect(pageLink(1));

  const next = nextGroupActivity(dashboard.self);
  const nextLesson = lessons.find(
    (lesson) => lesson.position === next?.position,
  );
  const nextQuiz = quizzes.find((quiz) => quiz.lesson_id === nextLesson?.id);
  const checkpoint = dashboard.checkpoints.find(
    (item) => item.membersReached < dashboard.memberCount,
  );
  const personalDone =
    dashboard.self.lessons.length + dashboard.self.quizzes.length;
  const totalActivities = dashboard.memberCount * 10;
  const percent = totalActivities
    ? Math.round((dashboard.completedActivities / totalActivities) * 100)
    : 0;
  const linkStyle =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900";
  let nextHref = `${base}#group-track`;
  let nextLabel = "Review track";
  if (next && nextLesson) {
    nextHref = `${base}/lessons/${nextLesson.id}`;
    nextLabel = nextLesson.generated_at
      ? `Read lesson ${next.position}`
      : isOwner
        ? `Prepare lesson ${next.position}`
        : "View lesson details";
    if (next.kind === "quiz" && nextQuiz) {
      nextHref = `${base}/quizzes/${nextQuiz.id}`;
      nextLabel = nextQuiz.generated_at
        ? `Start quiz ${next.position}`
        : isOwner
          ? `Prepare quiz ${next.position}`
          : "View quiz details";
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-emerald-950 p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-200">
              Current group track
            </p>
            <h2 className="mt-2 break-words text-2xl font-semibold">
              {track.title}
            </h2>
            <p className="mt-2 text-sm text-emerald-100">
              5 lessons + 5 quizzes · Same track for everyone
            </p>
          </div>
          <p className="text-sm text-emerald-100">
            <strong className="text-xl text-white">
              {dashboard.finishedCount}/{dashboard.memberCount}
            </strong>{" "}
            members finished
          </p>
        </div>
        <progress
          value={dashboard.completedActivities}
          max={Math.max(1, totalActivities)}
          aria-label="Group activity completion"
          className="mt-6 block h-2.5 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-white/15 [&::-webkit-progress-value]:bg-emerald-300 [&::-moz-progress-bar]:bg-emerald-300"
        />
        <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-emerald-100">
          <span>Group goal: everyone completes the track</span>
          <span>{percent}% of group activities completed</span>
        </div>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section
          id="group-progress"
          className="min-w-0 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5 sm:p-6"
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Member progress</h2>
            <RefreshGroupProgress />
          </div>
          <div
            role="region"
            aria-label="Member progress by stage"
            tabIndex={0}
            className="overflow-x-auto rounded-xl focus-visible:outline-2 focus-visible:outline-emerald-700"
          >
            <table className="w-full min-w-[590px] text-left text-sm">
              <caption className="sr-only">
                Each stage contains a lesson and a quiz. Highlighted cells show
                the next suggested activity, not live presence.
              </caption>
              <thead className="text-xs text-stone-500 dark:text-stone-400">
                <tr>
                  <th scope="col" className="p-3">
                    Member
                  </th>
                  {[1, 2, 3, 4, 5].map((stage) => (
                    <th key={stage} scope="col" className="p-2 text-center">
                      Stage {stage}
                    </th>
                  ))}
                  <th scope="col" className="p-3 text-right">
                    Done
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-700">
                {dashboard.members.map((member) => {
                  const current = nextGroupActivity(member);
                  return (
                    <tr
                      key={member.userId}
                      className={
                        member.userId === userId ? "bg-emerald-50 dark:bg-emerald-950" : ""
                      }
                    >
                      <th
                        scope="row"
                        className="max-w-44 break-words p-3 font-medium"
                      >
                        {member.displayName}
                        {member.userId === userId && (
                          <span className="ml-1 text-xs text-emerald-700 dark:text-emerald-200">
                            · You
                          </span>
                        )}
                        {member.isOwner && (
                          <span className="block text-xs font-normal text-stone-500 dark:text-stone-400">
                            Owner
                          </span>
                        )}
                      </th>
                      {[1, 2, 3, 4, 5].map((stage) => (
                        <td key={stage} className="p-2">
                          <div className="flex justify-center gap-1">
                            {(["lesson", "quiz"] as const).map((kind) => {
                              const done = (
                                kind === "lesson"
                                  ? member.lessons
                                  : member.quizzes
                              ).includes(stage);
                              const active =
                                current?.position === stage &&
                                current.kind === kind;
                              const label = `Stage ${stage} ${kind}: ${done ? "completed" : active ? "next activity" : "not completed"}`;
                              return (
                                <span
                                  key={kind}
                                  title={label}
                                  aria-label={label}
                                  className={`flex h-7 w-6 items-center justify-center rounded-md text-[10px] font-semibold ${done ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200" : active ? "bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 ring-1 ring-amber-300" : "bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400"}`}
                                >
                                  {done ? (
                                    <Check size={13} aria-hidden="true" />
                                  ) : kind === "lesson" ? (
                                    "L"
                                  ) : (
                                    "Q"
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                      ))}
                      <td className="p-3 text-right font-semibold tabular-nums">
                        {member.lessons.length + member.quizzes.length}/10
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs leading-5 text-stone-500 dark:text-stone-400">
            L = Lesson · Q = Quiz · Green = Completed · Amber = Suggested next
            activity. Quiz retakes count once. Scores stay private.
          </p>
          {(membersPage > 1 || membersPage * 20 < dashboard.memberCount) && (
            <nav
              aria-label="Member progress pages"
              className="mt-4 flex items-center gap-3 text-sm"
            >
              {membersPage > 1 && (
                <Link
                  href={pageLink(membersPage - 1)}
                  className="rounded-lg border border-stone-200 dark:border-stone-700 px-3 py-2"
                >
                  Previous
                </Link>
              )}
              <span className="text-stone-500 dark:text-stone-400">
                Page {membersPage} of {Math.ceil(dashboard.memberCount / 20)}
              </span>
              {membersPage * 20 < dashboard.memberCount && (
                <Link
                  href={pageLink(membersPage + 1)}
                  className="rounded-lg border border-stone-200 dark:border-stone-700 px-3 py-2"
                >
                  Next
                </Link>
              )}
            </nav>
          )}
        </section>

        <aside className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-500 dark:text-stone-400">
            Your next activity
          </p>
          <h2 className="mt-4 text-lg font-semibold">
            {next
              ? `${next.kind === "lesson" ? "Lesson" : "Quiz"} ${next.position}`
              : "Track completed"}
          </h2>
          <p className="mt-1 break-words text-sm font-medium text-stone-700 dark:text-stone-200">
            {nextLesson?.title ?? "All ten activities are complete."}
          </p>
          <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
            {personalDone} of 10 activities completed
          </p>
          {next?.kind === "quiz" && !nextQuiz?.generated_at && (
            <p className="mt-3 text-xs text-amber-800 dark:text-amber-200">
              The quiz is waiting for the owner to prepare it.
            </p>
          )}
          {next?.kind === "lesson" && !nextLesson?.generated_at && (
            <p className="mt-3 text-xs text-amber-800 dark:text-amber-200">
              Lesson content has not been prepared yet.
            </p>
          )}
          <Link href={nextHref} className={`${linkStyle} mt-5 w-full`}>
            {nextLabel}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <div className="mt-6 border-t border-stone-200 dark:border-stone-700 pt-5">
            <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
              Next group checkpoint
            </p>
            <p className="mt-2 text-sm font-medium">
              {checkpoint
                ? `Everyone completes Stage ${checkpoint.position}`
                : "Everyone has completed the track"}
            </p>
            {checkpoint && (
              <p className="mt-3 inline-flex rounded-full bg-emerald-50 dark:bg-emerald-950 px-3 py-1 text-xs text-emerald-800 dark:text-emerald-200">
                {checkpoint.membersReached}/{dashboard.memberCount} members
                reached it
              </p>
            )}
          </div>
        </aside>
      </div>

      <section
        id="group-track"
        className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5 sm:p-6"
      >
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Your learning materials</h2>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
            Read and mark each lesson complete to unlock its quiz.
          </p>
        </div>
        <ol className="divide-y divide-stone-100 dark:divide-stone-700">
          {lessons.map((lesson) => {
            const quiz = quizzes.find((item) => item.lesson_id === lesson.id)!;
            const lessonDone = dashboard.self.lessons.includes(lesson.position);
            const quizDone = dashboard.self.quizzes.includes(lesson.position);
            return (
              <li
                key={lesson.id}
                className="flex flex-wrap items-center justify-between gap-4 py-5"
              >
                <div className="flex min-w-0 flex-1 gap-4">
                  <span className="pt-1 font-mono text-sm text-stone-400">
                    {String(lesson.position).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <h3 className="break-words font-semibold">
                      {lesson.title}
                    </h3>
                    <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                      Lesson:{" "}
                      {lessonDone
                        ? "completed"
                        : lesson.generated_at
                          ? "ready"
                          : "awaiting content"}{" "}
                      · Quiz:{" "}
                      {quizDone
                        ? "completed"
                        : !lessonDone
                          ? "locked"
                          : quiz.generated_at
                            ? "ready"
                            : "awaiting content"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`${base}/lessons/${lesson.id}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-stone-300 dark:border-stone-700 px-3 py-2 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800"
                  >
                    <BookOpen size={15} aria-hidden="true" />
                    {lessonDone
                      ? "Review lesson"
                      : lesson.generated_at
                        ? "Read lesson"
                        : isOwner
                          ? "Prepare lesson"
                          : "Lesson details"}
                  </Link>
                  {lessonDone ? (
                    <Link
                      href={`${base}/quizzes/${quiz.id}`}
                      className={linkStyle}
                    >
                      {quizDone
                        ? "Review quiz"
                        : quiz.generated_at
                          ? "Start quiz"
                          : isOwner
                            ? "Prepare quiz"
                            : "Quiz details"}
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-xl bg-stone-100 dark:bg-stone-800 px-3 py-2 text-xs text-stone-500 dark:text-stone-400">
                      <LockKeyhole size={14} aria-hidden="true" />
                      Read lesson first
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
