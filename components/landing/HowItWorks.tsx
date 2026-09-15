const steps = [
  {
    number: "01",
    title: "Choose your material",
    description:
      "Explore a study set, pick a topic, or bring your own notes.",
  },
  {
    number: "02",
    title: "Study your way",
    description:
      "Read a guide, flip through flashcards, or test yourself with a quiz.",
  },
  {
    number: "03",
    title: "Pick up where you left off",
    description:
      "Save your materials in My Library and return when you need them.",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="px-6 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <p className="landing-accent text-sm font-semibold">
          How it works
        </p>

        <h2
          id="how-it-works-heading"
          className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl"
        >
          From “where do I start?” to your first study session.
        </h2>

        <p className="landing-muted mt-4 max-w-2xl leading-7">
          Here’s the study experience we’re building for you.
        </p>

        <ol className="mt-12 grid gap-10 md:grid-cols-3">
          {steps.map((step) => (
            <li
              key={step.number}
              className="border-t border-[var(--landing-border)] pt-6"
            >
              <span
                aria-hidden="true"
                className="landing-accent font-mono text-sm"
              >
                {step.number}
              </span>

              <h3 className="mt-4 text-xl font-semibold">
                {step.title}
              </h3>

              <p className="landing-muted mt-3 leading-7">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}