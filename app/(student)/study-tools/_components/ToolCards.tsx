import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { studyTools } from "./study-tools";

export default function ToolCards({ showViewAll = false }: { showViewAll?: boolean }) {
  return (
    <section className="mt-8" aria-labelledby="tools-title">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6d7f72]">Pick your way</p>
          <h2 id="tools-title" className="text-xl font-semibold tracking-tight">Study tools</h2>
        </div>
        {showViewAll && (
          <Link href="/study-tools" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#0c4a3a] hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-950">
            View all <ArrowRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-4 xl:gap-5">
        {studyTools.map(({ id, href, name, description, label, icon: Icon, image, background }) => (
          <Link key={id} href={href} className="student-tool-card group overflow-hidden border transition duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 motion-reduce:transform-none motion-reduce:transition-none">
            <div className={`relative grid h-32 place-items-center overflow-hidden sm:h-36 ${background}`}>
              {image ? (
                <Image src={image} alt="" fill sizes="(max-width: 359px) 100vw, (max-width: 767px) 50vw, 30vw" className="object-cover object-[center_70%] transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none" />
              ) : (
                <div className="grid size-16 place-items-center rounded-2xl border border-white/70 bg-white/75 text-[#0c4a3a] shadow-sm dark:border-white/10 dark:bg-stone-900/60 dark:text-emerald-200">
                  <Icon size={30} strokeWidth={1.6} aria-hidden="true" />
                </div>
              )}
              <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-[#20342c] dark:bg-stone-900/90 dark:text-stone-100">{label}</span>
            </div>
            <div className="p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold tracking-tight sm:text-base">{name}</h3>
                <ArrowRight size={16} className="ml-auto shrink-0 text-[#14765a] transition-transform group-hover:translate-x-1 dark:text-emerald-200" aria-hidden="true" />
              </div>
              <p className="mb-4 mt-2 min-h-10 text-sm leading-6 text-stone-600 dark:text-stone-300">{description}</p>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
                {(id === "guides" || id === "flashcards" || id === "quizzes") && "Start studying"}
                {id === "paths" && "Create study outline"}
                {id === "tutor" && "Discuss a lesson"}
                {id !== "guides" && id !== "flashcards" && id !== "quizzes" && id !== "paths" && id !== "tutor" && "Coming soon"}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
