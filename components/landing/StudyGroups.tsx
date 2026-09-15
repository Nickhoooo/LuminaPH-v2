import Link from "next/link";

const groupFeatures = [
  {
    title: "One shared study shelf",
    description:
      "Keep your group’s selected guides, flashcards, and quizzes together.",
  },
  {
    title: "Questions with context",
    description:
      "Discuss the study material you’re working on, right where it belongs.",
  },
  {
    title: "Review at your own pace",
    description:
      "Try the same practice set without needing everyone online at once.",
  },
];

export default function StudyGroups() {
  return (
    <section
      id="study-groups"
      aria-labelledby="study-groups-heading"
      className="landing-tools px-6 py-16 sm:py-24"
    >
      <div className="mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <p className="landing-accent text-sm font-semibold">
            Study Groups · Coming soon
          </p>

          <h2
            id="study-groups-heading"
            className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Different questions.
            <br />
            One place to study.
          </h2>

          <p className="landing-muted mt-5 max-w-lg leading-7">
            We’re building private study spaces where you can invite
            classmates, share selected materials, and work through
            difficult topics together.
          </p>

          <Link
            href="/login"
            className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600"
          >
            Log in or register
          </Link>
        </div>

        <ul className="divide-y divide-[var(--landing-border)]">
          {groupFeatures.map((feature) => (
            <li key={feature.title} className="py-6 first:pt-0">
              <h3 className="text-xl font-semibold">
                {feature.title}
              </h3>

              <p className="landing-muted mt-3 leading-7">
                {feature.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}