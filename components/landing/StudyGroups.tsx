import { AuthTrigger } from "@/components/auth/AuthModal";

const groupFeatures = [
  {
    title: "Share notes and study guides",
    description:
      "Bring selected notes and study guides from your Library into your group’s shared materials.",
  },
  {
    title: "Follow one shared study track",
    description:
      "Your group owner prepares five lessons and five quizzes for everyone to study at their own pace.",
  },
  {
    title: "See each other’s progress",
    description:
      "See completed lessons and quizzes for each member. Individual scores and answers stay private.",
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
            Study Groups
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
            Create a study group, invite classmates with a six-letter code,
            and work through a shared study plan. Keep your materials and
            everyone’s progress in one place.
          </p>

          <AuthTrigger
            mode="signup"
            className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600"
          >
            Log in or register
          </AuthTrigger>
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
