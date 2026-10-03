import DashboardHome from "./DashboardHome";
import ContinueLearning from "./ContinueLearning";

export default function DashboardContent({
  view,
  displayName,
}: {
  view: "home" | "learning";
  displayName: string;
}) {
  if (view === "home") return <DashboardHome displayName={displayName} />;

  return (
    <>
      <header className="pb-3 pt-6">
        <p className="mb-3 text-[9px] font-bold tracking-widest text-[#7a896e] dark:text-stone-200">
          YOUR STUDY SPACE
        </p>
        <h1 className="font-serif text-4xl tracking-tight text-[#2c4a36] dark:text-stone-200">
          My Learning
        </h1>
        <p className="mt-4 text-sm leading-7 text-stone-500 dark:text-stone-400">Return to your saved materials and review your recent quiz results.</p>
      </header>
      <ContinueLearning />
    </>
  );
}
