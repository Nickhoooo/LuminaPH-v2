import LuminaStudy from "@/components/landing/LuminaStudy";

export default function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="mx-auto grid w-full max-w-6xl items-center gap-5 px-5 py-12 sm:px-6 sm:py-16 md:grid-cols-[1.05fr_0.95fr] md:gap-4 lg:gap-12 lg:py-20"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold landing-accent">
          Made for Filipino students
        </p>
        <h1
          id="hero-heading"
          className="mt-4 max-w-[16ch] text-[clamp(2.5rem,8vw,4.5rem)] font-semibold leading-[1.04] tracking-[-0.045em]"
        >
          Your next study session starts here.
        </h1>
        <p className="mt-5 max-w-[58ch] text-base leading-7 landing-muted sm:text-lg sm:leading-8">
          We’re building Lumina PH to help you review topics, practice with
          quizzes, remember with flashcards, and study with classmates.
        </p>
        <p className="mt-4 max-w-[58ch] text-sm leading-6 landing-subtle">
          One topic or a complete learning path—study at your own pace.
        </p>
      </div>
      <div className="mx-auto w-full max-w-[30rem] md:max-w-none">
        <LuminaStudy
          className="w-full"
          width="100%"
          label="A student studying with Lumina PH"
        />
      </div>
    </section>
  );
}
