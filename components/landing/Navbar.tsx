import Link from "next/link";
import { BackgroundToggle } from "@/components/landing/LandingTheme";

export default function Navbar() {
  return (
    <header className="landing-nav border-b">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-4 px-6 py-4"
      >
        <Link
          href="/"
          aria-label="Lumina PH home"
          className="landing-brand shrink-0 text-3xl font-bold tracking-tight"
        >
          Lumina
          <span className="landing-brand-accent">PH</span>
        </Link>

        <div className="order-3 flex w-full items-center justify-between gap-4 lg:order-none lg:w-auto lg:flex-1">
          <a
            href="#study-tools"
            className="landing-muted text-sm font-medium underline-offset-8 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            Study Tools
          </a>

          <div className="lg:hidden">
            <BackgroundToggle />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <div className="hidden lg:block">
            <BackgroundToggle />
          </div>

          <Link
            href="/login"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600"
          >
            Log in
          </Link>
        </div>
      </nav>
    </header>
  );
}