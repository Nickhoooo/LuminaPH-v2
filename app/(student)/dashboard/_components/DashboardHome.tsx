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
      {/* Welcome panel */}
      <section className="relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl bg-[#edf1e6] dark:bg-stone-800 p-6 md:p-9">
        <div className="relative z-10">
          <p className="mb-3 text-[9px] font-bold tracking-[1.9px] text-[#7a896e] dark:text-stone-200">
            MAKE SPACE FOR CURIOSITY
          </p>
          <p className="mb-2.5 mt-5 break-words text-sm text-[#657556] dark:text-stone-200">
            Welcome back, {displayName}.
          </p>
          <h1 className="font-serif text-4xl leading-tight tracking-tight text-[#2c4a36] dark:text-stone-200 xl:text-[43px]">
            What do you want
            <br />
            to learn today?
          </h1>
          <p className="mb-6 mt-4 text-xs leading-6 text-[#78816d] dark:text-stone-200">
            Revisit your materials, practice what you’ve learned,
            <br className="hidden xl:block" /> or start something new. This
            space is yours.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard?view=learning"
              className="inline-flex min-h-11 items-center justify-center gap-3 rounded-lg bg-[#245c47] px-4 py-3 text-xs font-semibold text-white transition-colors hover:bg-[#194734] motion-reduce:transition-none"
            >
              Continue Learning <ArrowRight size={17} />
            </Link>
            <Link
              href="/study-tools"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#d5decb] dark:border-stone-700 bg-white/50 dark:bg-stone-900/50 px-4 py-3 text-xs font-semibold text-[#536b48] dark:text-stone-200 transition-colors hover:bg-white dark:hover:bg-stone-900 motion-reduce:transition-none"
            >
              Explore Tools
            </Link>
          </div>
        </div>
        {/* Decorative book */}
        <div
          aria-hidden="true"
          className="relative mr-2 hidden size-56 shrink-0 place-items-center md:grid"
        >
          <div className="absolute size-54 rounded-full border border-[#d5ddc7] dark:border-stone-700">
            <div className="absolute inset-4 rounded-full border border-dashed border-[#d2dac7] dark:border-stone-700" />
          </div>
          <div className="relative z-10 flex h-46 w-37 -rotate-10 flex-col items-center justify-center gap-4 rounded-r-2xl rounded-l border-l-5 border-[#c7d0b5] dark:border-stone-700 bg-[#fbfcf6] dark:bg-stone-800 text-[#7e9166] dark:text-stone-200 shadow-lg">
            <span className="text-[7px] tracking-[1.5px]">
              THE NEXT CHAPTER
            </span>
            <BookOpen size={62} strokeWidth={1} />
            <span className="h-0.5 w-19 bg-[#dce1d1] dark:bg-stone-800" />
            <span className="-mt-2 h-0.5 w-13 bg-[#dce1d1] dark:bg-stone-800" />
            <span className="font-serif text-xs italic">begins with you.</span>
          </div>
          <span className="absolute right-2 top-8 z-20 rounded-full bg-[#dce6cb] dark:bg-stone-800 p-3 text-[#70875b] dark:text-stone-200">
            <Sparkles size={24} />
          </span>
        </div>
      </section>
      <ContinueLearning />
      <ToolCards showViewAll />
    </>
  );
}
