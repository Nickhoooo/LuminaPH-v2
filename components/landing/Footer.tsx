import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--landing-border)] px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/"
              className="landing-brand text-2xl font-bold tracking-tight"
            >
              Lumina
              <span className="landing-brand-accent">PH</span>
            </Link>

            <p className="landing-muted mt-3 max-w-sm text-sm leading-6">
              A space for Filipino students to review, practice,
              and learn together.
            </p>
          </div>

          <nav
            aria-label="Footer navigation"
            className="landing-muted flex flex-wrap gap-x-6 gap-y-3 text-sm"
          >
            <a
              href="#study-tools"
              className="underline-offset-4 hover:underline"
            >
              Study Tools
            </a>

            <a
              href="#how-it-works"
              className="underline-offset-4 hover:underline"
            >
              How It Works
            </a>

            <a
              href="#study-groups"
              className="underline-offset-4 hover:underline"
            >
              Study Groups
            </a>
          </nav>
        </div>

        <div className="landing-subtle mt-8 flex flex-col gap-2 border-t border-[var(--landing-border)] pt-6 text-xs sm:flex-row sm:justify-between">
          <p>© {year} Lumina PH.</p>
          <p>Built for curiosity. Made for Filipinos.</p>
        </div>
      </div>
    </footer>
  );
}