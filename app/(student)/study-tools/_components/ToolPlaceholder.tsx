import Link from "next/link";
import { ArrowLeft, Construction } from "lucide-react";

export default function ToolPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <>
      <Link
        href="/study-tools"
        className="inline-flex items-center gap-2 py-2 text-xs font-semibold text-[#537242] dark:text-stone-200 hover:text-[#224b2c] dark:hover:text-stone-200"
      >
        <ArrowLeft size={16} />
        All study tools
      </Link>
      <header className="pb-3 pt-6">
        <p className="mb-3 text-[9px] font-bold tracking-widest text-[#7a896e] dark:text-stone-200">
          STUDY TOOLS
        </p>
        <h1 className="font-serif text-4xl tracking-tight text-[#2c4a36] dark:text-stone-200">
          {title}
        </h1>
        <p className="mt-4 text-sm leading-7 text-stone-500 dark:text-stone-400">{description}</p>
      </header>
      <section className="mt-6 flex flex-col items-center rounded-2xl border border-[#e6eadd] dark:border-stone-700 bg-white dark:bg-stone-900 px-6 py-16 text-center">
        <span className="grid size-14 place-items-center rounded-xl bg-[#eff3e9] dark:bg-stone-800 text-[#779061] dark:text-stone-200">
          <Construction size={28} />
        </span>
        <h2 className="mb-3 mt-6 font-serif text-3xl">Coming soon</h2>
        <p className="mb-6 max-w-md text-sm leading-7 text-stone-500 dark:text-stone-400">
          This tool is not available yet. Your study materials and activities
          will appear here once it is ready.
        </p>
      </section>
    </>
  );
}
