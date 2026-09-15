import Link from "next/link";
import LogoutForm from "./LogoutForm";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return (
    <main className="min-h-dvh bg-stone-50 px-6 py-12 text-slate-950">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <Link href="/" className="font-semibold text-emerald-800">
            Lumina PH
          </Link>
          <LogoutForm />
        </div>

        <header className="mt-12">
          <p className="text-sm font-medium text-emerald-800">
            Your study space
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Welcome to your dashboard.
          </h1>

          <p className="mt-3 break-words text-slate-600">
            Signed in as {user.email}
          </p>
        </header>

        <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold">
            A fresh start for your studies
          </h2>

          <p className="mt-2 text-slate-600">
            Your saved materials and study progress will appear here
            as these features become available.
          </p>
        </section>
      </div>
    </main>
  );
}