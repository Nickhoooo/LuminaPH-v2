import LuminaStudy from "@/components/landing/LuminaStudy";
export default function Hero() {
  return (
    <div className="flex overflow-hidden  py-16 sm:py-24 m-auto w-full max-w-6xl px-6">
         <section
      aria-labelledby="hero-heading"
      className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-24"
    >
      <p className="text-sm font-semibold landing-accent">
        Made for Filipino students
      </p>

      <h1
        id="hero-heading"
        className="mt-4 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl"
      >
        Your next study session starts here.
      </h1>

      <p className="mt-6 max-w-2xl text-lg leading-8 landing-muted">
        We’re building Lumina PH to help you review topics, practice with
        quizzes, remember with flashcards, and study with classmates.
      </p>

      <p className="mt-6 text-sm landing-subtle">
        One topic or a complete learning path—study at your own pace.
      </p>
      
    </section>
        <div>
            <LuminaStudy width={500} />
        </div>
    </div>
   
  );
}