import Link from "next/link";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
import ToolCards from "@/app/(student)/study-tools/_components/ToolCards";
import ContinueLearning from "./ContinueLearning";

export default function DashboardHome({
  displayName,
}: {
  displayName: string;
}) {
  return (
    <>
      <section className="relative isolate overflow-hidden rounded-[1.75rem] border border-[#dce5d7] bg-[#edf3e9] p-6 dark:border-stone-700 dark:bg-stone-800 sm:p-8 lg:p-10">
        <div className="relative z-10 max-w-2xl">
          <p className="text-sm text-[#526c58] dark:text-emerald-100">
            Welcome back, {displayName}.
          </p>
          <h1 className="mt-3 max-w-[17ch] student-editorial-heading font-serif text-[clamp(2.15rem,5vw,3.6rem)] leading-[1.08] tracking-[-0.035em] text-emerald-950 dark:text-stone-100">
            What would you like to learn today?
          </h1>
          <p className="mt-4 max-w-[55ch] text-sm leading-6 text-[#52665a] dark:text-stone-300">
            Revisit your materials, practice what you’ve learned, or start
            something new.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/dashboard?view=learning"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 motion-reduce:transition-none"
            >
              Continue learning <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link
              href="/study-tools"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#b9cbb8] bg-white/70 px-4 py-3 text-sm font-semibold text-emerald-950 transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 motion-reduce:transition-none dark:border-stone-600 dark:bg-stone-900/70 dark:text-stone-100 dark:hover:bg-stone-900"
            >
              Explore tools
            </Link>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-12 hidden size-64 place-items-center text-[#789174]/35 lg:grid"
        >
          <BookOpen size={174} strokeWidth={0.7} />
          <Sparkles
            className="absolute right-14 top-12"
            size={28}
            strokeWidth={1.2}
          />
        </div>
      </section>
      <ContinueLearning />
      <ToolCards showViewAll />
    </>
  );
}
