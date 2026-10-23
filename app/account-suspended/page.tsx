import type { Metadata } from "next";
import LogoutForm from "@/app/(student)/dashboard/LogoutForm";

export const metadata: Metadata = {
  title: "Account access unavailable | LuminaPH",
};

export default function AccountSuspendedPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-stone-50 px-5 py-12 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <section className="w-full max-w-xl rounded-3xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900 sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
          LuminaPH account
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Account access is paused</h1>
        <p className="mt-4 leading-7 text-stone-600 dark:text-stone-300">
          This account cannot use LuminaPH right now. If you think this is a
          mistake, contact the LuminaPH support team.
        </p>
        <div className="mt-7">
          <LogoutForm />
        </div>
      </section>
    </main>
  );
}
