import Link from "next/link";
import { BackgroundToggle } from "@/components/landing/LandingTheme";
import { AuthTrigger } from "@/components/auth/AuthModal";

export default function Navbar() {
  return (
    <header className="landing-nav border-b">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 sm:px-6"
      >
        <Link
          href="/"
          aria-label="Lumina PH home"
          className="landing-brand shrink-0 text-2xl font-bold tracking-tight sm:text-3xl"
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

        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <div className="hidden lg:block">
            <BackgroundToggle />
          </div>

          <AuthTrigger
            mode="login"
            className="landing-muted inline-flex min-h-11 items-center justify-center rounded-full px-3 text-sm font-semibold transition-colors hover:text-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            Log in
          </AuthTrigger>
          <AuthTrigger mode="signup" className="inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600 sm:px-5">
            Sign up
          </AuthTrigger>
        </div>
      </nav>
    </header>
  );
}
