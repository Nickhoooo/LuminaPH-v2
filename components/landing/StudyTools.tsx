import Image from "next/image";
import Link from "next/link";

const studyTools = [
  {
    id: "guides",
    name: "Study Guides",
    description: "Make complicated topics easier to understand.",
    image: "/images/study-tools/guides.jpg",
  },
  {
    id: "flashcards",
    name: "Flashcards",
    description: "A little recall. A little repetition. More confidence.",
    image: "/images/study-tools/flashcards.jpg",
  },
  {
    id: "quizzes",
    name: "Practice Quizzes",
    description: "Find out what you know—and what to review next.",
    image: "/images/study-tools/quizzes.jpg",
  },
  {
    id: "paths",
    name: "Learning Paths",
    description: "Give your next study session a clear direction.",
    image: "/images/study-tools/paths.jpg",
  },
  {
    id: "tutor",
    name: "AI Study Tutor",
    description: "Stay curious. Ask until it makes sense.",
    image: "/images/study-tools/tutor.jpg",
  },
  {
    id: "groups",
    name: "Study Groups",
    description: "Bring your notes. Bring your classmates.",
    image: "/images/study-tools/groups.jpg",
  },
];

export default function StudyTools() {
  return (
    <section
      id="study-tools"
      aria-labelledby="study-tools-heading"
      className="landing-tools py-16 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-10 max-w-2xl">
          <p className="landing-accent text-sm font-semibold">
            Your study tools
          </p>

          <h2
            id="study-tools-heading"
            className="mt-3 text-3xl font-bold tracking-tight text-[var(--landing-text)] sm:text-5xl"
          >
            What are we studying today?
          </h2>

          <p className="landing-muted mt-5 text-base leading-7">
            A quick review or a deeper dive—choose where to start.
            Our study tools are currently in development.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {studyTools.map((tool) => (
            <Link
              key={tool.id}
              href="/login"
              aria-label={`${tool.name} — log in or register`}
              className="group relative isolate flex min-h-[360px] flex-col justify-end overflow-hidden rounded-2xl bg-slate-900 p-7 text-white focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-emerald-600"
            >
              <Image
                src={tool.image}
                alt=""
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105 motion-safe:group-focus-visible:scale-105"
              />

              <div
                aria-hidden="true"
                className="absolute inset-0 bg-linear-to-t from-black via-black/55 to-black/10"
              />

              <div className="relative">
                <h3 className="text-2xl font-bold tracking-tight">
                  {tool.name}
                </h3>

                <p className="mt-3 max-w-[28ch] text-sm leading-6 text-white/90">
                  {tool.description}
                </p>

                <div className="mt-6 flex items-center justify-between border-t border-white/25 pt-4">
                  <span className="text-sm font-medium">
                    Log in to continue
                  </span>

                  <span
                    aria-hidden="true"
                    className="text-xl motion-safe:transition-transform motion-safe:group-hover:translate-x-1"
                  >
                    →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}