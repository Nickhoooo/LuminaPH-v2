import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ImagePlus } from "lucide-react";
import { studyTools } from "./study-tools";

export default function ToolCards({
  showViewAll = false,
}: {
  showViewAll?: boolean;
}) {
  return (
    <section className="mt-8" aria-labelledby="tools-title">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="mb-2 text-[9px] font-bold tracking-widest text-[#7a896e] dark:text-stone-200">
            PICK YOUR WAY
          </p>
          <h2 id="tools-title" className="text-lg font-semibold tracking-tight">
            Study Tools
          </h2>
        </div>
        {showViewAll && (
          <Link
            href="/study-tools"
            className="inline-flex items-center gap-2 py-2 text-xs font-semibold text-[#537242] dark:text-stone-200 hover:text-[#224b2c] dark:hover:text-stone-200"
          >
            View all <ArrowRight size={16} />
          </Link>
        )}
      </div>
      {/* Two columns on phones, three columns on larger screens. */}
      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-3 xl:gap-5">
        {studyTools.map(
          (
            {
              id,
              href,
              name,
              description,
              label,
              icon: Icon,
              image,
              background,
            },
            index,
          ) => (
            <Link
              key={id}
              href={href}
              className="group overflow-hidden rounded-xl border border-[#e6eadd] dark:border-stone-700 bg-white dark:bg-stone-900 transition duration-200 hover:-translate-y-1 hover:shadow-lg motion-reduce:transform-none motion-reduce:transition-none"
            >
              <div
                className={`relative grid h-36 place-items-center overflow-hidden xl:h-40 ${background}`}
              >
                {image ? (
                  <Image
                    src={image}
                    alt=""
                    fill
                    sizes="(max-width: 359px) 100vw, (max-width: 767px) 50vw, 30vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
                  />
                ) : (
                  <div className="flex h-20 w-3/4 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-stone-500/25 text-stone-500 dark:text-stone-400">
                    <ImagePlus size={30} strokeWidth={1.2} />
                    <span className="text-[9px] tracking-wide">
                      Your image here
                    </span>
                  </div>
                )}
                <span className="absolute left-4 top-3 font-serif text-xs text-[#33492b] dark:text-stone-200">
                  0{index + 1}
                </span>
                <span className="absolute bottom-3 left-3 rounded bg-white/90 px-2 py-1 text-[9px] tracking-wide text-[#627357] dark:text-stone-200">
                  {label}
                </span>
              </div>
              <div className="p-3.5 xl:p-5">
                <div className="flex items-center gap-2">
                  <Icon size={19} className="shrink-0 text-[#788d67] dark:text-stone-200" />
                  <h3 className="text-xs font-semibold tracking-tight xl:text-sm">
                    {name}
                  </h3>
                  <ArrowRight
                    size={15}
                    className="ml-auto hidden shrink-0 text-[#788d67] dark:text-stone-200 sm:block"
                  />
                </div>
                <p className="mb-3 mt-2.5 min-h-10 text-xs leading-5 text-stone-500 dark:text-stone-400">
                  {description}
                </p>
                <span className="text-[9px] uppercase tracking-widest text-stone-500 dark:text-stone-400">
                  {(id === "guides" || id === "flashcards" || id === "quizzes") && "Start studying"}
                  {id === "paths" && "Create study outline"}
                  {id === "tutor" && "Discuss a lesson"}
                  {id !== "guides" && id !== "flashcards" && id !== "quizzes" && id !== "paths" && id !== "tutor" && "Coming soon"}
                </span>
              </div>
            </Link>
          ),
        )}
      </div>
    </section>
  );
}
