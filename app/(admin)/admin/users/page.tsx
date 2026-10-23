import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUsers, type AdminUserFilter } from "@/lib/admin-users";
import AdminUserProfile from "../../components/AdminUserProfile";

type UsersPageProps = {
  searchParams: Promise<{
    page?: string | string[];
    q?: string | string[];
    role?: string | string[];
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeZone: "Asia/Manila",
});

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : dateFormatter.format(date);
}

const buttonStyle =
  "rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800";

function usersPageUrl(page: number, search: string, role: AdminUserFilter) {
  const params = new URLSearchParams({ page: String(page) });

  if (search) params.set("q", search);
  if (role !== "all") params.set("role", role);

  return `/admin/users?${params.toString()}`;
}

export default async function UsersPage({
  searchParams,
}: UsersPageProps) {
  const query = await searchParams;
  const rawPage = query.page ?? "1";
  const page =
    typeof rawPage === "string" && /^[1-9]\d*$/.test(rawPage)
      ? Number(rawPage)
      : 1;

  const search = typeof query.q === "string" ? query.q.trim() : "";
  const requestedRole = typeof query.role === "string" ? query.role : "all";
  let role: AdminUserFilter = "all";
  if (requestedRole === "admins" || requestedRole === "users") {
    role = requestedRole;
  }
  const result = await getAdminUsers(page, search, role);

  if (!result.success) {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold">Users</h1>
        <p role="alert" className="text-red-700 dark:text-red-300">
          {result.message}
        </p>
        <Link href="/admin/users" className={buttonStyle}>
          Reload users
        </Link>
      </section>
    );
  }

  const { users, totalCount, pageSize } = result.data;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  if (page > totalPages) {
    redirect(usersPageUrl(totalPages, search, role));
  }

  return (
    <section className="w-full space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Users</h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
          {totalCount.toLocaleString("en-PH")}{" "}
          {search || role !== "all" ? "matching accounts." : "registered accounts."}
        </p>
      </header>

      <form
        action="/admin/users"
        method="get"
        role="search"
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="w-full sm:max-w-md">
          <label htmlFor="user-search" className="mb-2 block text-sm font-medium">
            Search users
          </label>
          <input
            key={search}
            id="user-search"
            name="q"
            type="search"
            defaultValue={search}
            maxLength={120}
            placeholder="Name or email"
            className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
          />
        </div>
        <div className="w-full sm:w-52">
          <label htmlFor="user-role-filter" className="mb-2 block text-sm font-medium">
            Account type
          </label>
          <select
            id="user-role-filter"
            name="role"
            defaultValue={role}
            className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
          >
            <option value="all">All accounts</option>
            <option value="admins">Admins</option>
            <option value="users">Users</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Apply filters
        </button>
        {(search || role !== "all") && (
          <Link
            href="/admin/users"
            className={`${buttonStyle} self-start sm:self-auto`}
          >
            Clear filters
          </Link>
        )}
      </form>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Registered LuminaPH accounts
            </caption>
            <thead className="bg-stone-50 dark:bg-stone-800">
              <tr>
                {["Account", "Role", "Email status", "Joined", "Last sign-in"].map(
                  (heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="whitespace-nowrap px-5 py-4 font-semibold"
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-stone-200 dark:divide-stone-700">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-5 py-4">
                    <AdminUserProfile user={user} />
                    <p className="mt-1 break-all text-stone-500 dark:text-stone-400">
                      {user.email ?? "No email"}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    {user.isAdmin ? "Administrator" : "User"}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    {user.emailConfirmed ? "Confirmed" : "Unconfirmed"}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    {formatDate(user.lastSignInAt)}
                  </td>
                </tr>
              ))}

              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-stone-500 dark:text-stone-400"
                  >
                    {search || role !== "all"
                      ? "No accounts match these filters."
                      : "No registered accounts found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <nav
        aria-label="Users pagination"
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <p className="text-sm text-stone-600 dark:text-stone-300">
          Page {page} of {totalPages}
        </p>

        <div className="flex gap-3">
          {page > 1 && (
            <Link
              href={usersPageUrl(page - 1, search, role)}
              className={buttonStyle}
            >
              Previous
            </Link>
          )}
          {page < totalPages && page < 50000 && (
            <Link
              href={usersPageUrl(page + 1, search, role)}
              className={buttonStyle}
            >
              Next
            </Link>
          )}
        </div>
      </nav>
    </section>
  );
}
