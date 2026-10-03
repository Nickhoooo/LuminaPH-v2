export type StageProgress = { lessons: number[]; quizzes: number[] };
export type DashboardMember = StageProgress & {
  userId: string;
  displayName: string;
  isOwner: boolean;
};
export type GroupDashboardData = {
  memberCount: number;
  finishedCount: number;
  completedActivities: number;
  self: StageProgress;
  checkpoints: { position: number; membersReached: number }[];
  members: DashboardMember[];
};

// This is a suggested next step, not live tracking of a member's browser.
export function nextGroupActivity(progress: StageProgress) {
  for (let position = 1; position <= 5; position++) {
    if (!progress.lessons.includes(position))
      return { position, kind: "lesson" as const };
    if (!progress.quizzes.includes(position))
      return { position, kind: "quiz" as const };
  }
  return null;
}
