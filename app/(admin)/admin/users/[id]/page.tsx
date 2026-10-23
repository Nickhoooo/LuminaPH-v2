import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/admin-users";

type UserDetailsPageProps = {
  params: Promise<{ id: string }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

function formatDate(value: string | null) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Unavailable"
    : dateFormatter.format(date);
}

export default async function UserDetailsPage({
  params,
}: UserDetailsPageProps) {
  const { id } = await params;
  const result = await getAdminUser(id);

  if (!result.success) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Account unavailable</h1>
        <p role="alert" className="text-red-700 dark:text-red-300">
          {result.message}
        </p>
        <Link
          href="/admin/users"
          className="inline-flex rounded-xl border border-stone-300 px-4 py-2 text-sm dark:border-stone-700"
        >
          Back to users
        </Link>
      </section>
    );
  }

  if (!result.user) {
    notFound();
  }

  const user = result.user;
  const initial = Array.from(user.displayName.trim())[0]?.toUpperCase() ?? "?";

  const details = [
    { label: "Email", value: user.email ?? "No email" },
    {
      label: "Email verification",
      value: user.emailConfirmed ? "Confirmed" : "Unconfirmed",
    },
    {
      label: "Access",
      value: user.isAdmin ? "Administrator" : "User",
    },
    { label: "Registered", value: formatDate(user.createdAt) },
    { label: "Last sign-in", value: formatDate(user.lastSignInAt) },
    { label: "Account ID", value: user.id },
  ];

  return (
    <section className="w-full space-y-6">
      <Link
        href="/admin/users"
        className="inline-flex rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
      >
        Back to users
      </Link>

      <header className="flex items-center gap-4">
        <div
          aria-hidden="true"
          className="grid size-16 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-2xl font-semibold text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100"
        >
          {initial}
        </div>

        <div className="min-w-0">
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Account details
          </p>
          <h1 className="mt-1 break-words text-2xl font-semibold">
            {user.displayName}
          </h1>
        </div>
      </header>

      <div className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-900">
        <h2 className="text-lg font-semibold">Account information</h2>

        <dl className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {details.map(({ label, value }) => (
            <div key={label}>
              <dt className="text-sm text-stone-500 dark:text-stone-400">
                {label}
              </dt>
              <dd className="mt-1 break-words text-sm font-medium">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}