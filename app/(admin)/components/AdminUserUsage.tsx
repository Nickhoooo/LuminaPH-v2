import type {
  AdminUserUsage as UserUsageData,
  UsageResult,
} from "../admin/users/usage-actions";

type AdminUserUsageProps = {
  result: UsageResult | null;
  pending: boolean;
  refreshingDisabled?: boolean;
  onRefresh: () => void;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

export default function AdminUserUsage({
  result,
  pending,
  refreshingDisabled = false,
  onRefresh,
}: AdminUserUsageProps) {
  // Magsimula sa walang data. Ilagay lang ang usage kung successful ang request.
  let usage: UserUsageData | null = null;
  let errorMessage = "";
  if (result !== null) {
    if (result.success) {
      usage = result.usage;
    } else {
      errorMessage = result.message;
    }
  }

  let buttonText = "Retry";
  if (pending) {
    buttonText = "Loading…";
  } else if (usage !== null) {
    buttonText = "Refresh";
  }

  let allowanceText = "Default";
  if (usage !== null) {
    if (usage.mode === "unlimited") {
      allowanceText = "Unlimited personal allowance";
    } else if (usage.mode === "custom") {
      allowanceText = "Custom";
    }
  }

  return (
    <section
      aria-label="AI usage"
      aria-busy={pending}
      className="space-y-4 border-t border-stone-200 pt-6 dark:border-stone-700"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">AI usage</h3>

        <button
          type="button"
          disabled={pending || refreshingDisabled}
          onClick={onRefresh}
          className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-100 disabled:opacity-50 dark:border-stone-700 dark:hover:bg-stone-800"
        >
          {buttonText}
        </button>
      </div>

      {pending && (
        <p role="status" className="text-sm text-stone-500 dark:text-stone-400">
          Loading current usage…
        </p>
      )}

      {!pending && errorMessage !== "" && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {errorMessage}
        </p>
      )}

      {!pending && usage && (
        <>
          <p className="text-sm">
            Allowance: <span className="font-semibold">{allowanceText}</span>
          </p>

          {usage.source === "developer" && (
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Developer testing access is managed separately.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Materials", bucket: usage.materials },
              { label: "AI Tutor", bucket: usage.tutor },
            ].map(({ label, bucket }) => {
              let remainingText = "No personal app limit";
              if (bucket.remaining !== null) {
                remainingText =
                  bucket.remaining + " personal attempts remaining";
              }

              return (
                <article
                  key={label}
                  className="rounded-2xl bg-stone-50 p-4 dark:bg-stone-800"
                >
                  <h4 className="text-sm font-medium">{label}</h4>

                  <p className="mt-3 text-2xl font-semibold tabular-nums">
                    {bucket.attempts24h.toLocaleString("en-PH")}
                    {bucket.limit !== null && (
                      <span className="text-sm font-normal text-stone-500 dark:text-stone-400">
                        {" "}
                        / {bucket.limit}
                      </span>
                    )}
                  </p>

                  <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                    Attempts in the last 24 hours
                  </p>

                  <p className="mt-3 text-sm">{remainingText}</p>

                  {bucket.nextAttemptExpiresAt && (
                    <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                      Next attempt leaves the count:{" "}
                      {formatDate(bucket.nextAttemptExpiresAt)}
                    </p>
                  )}
                </article>
              );
            })}
          </div>

          <p className="text-xs leading-5 text-stone-500 dark:text-stone-400">
            Checked {formatDate(usage.checkedAt)}. Counts include reserved
            attempts that failed. Cooldowns, shared app limits, and provider
            limits may still apply.
          </p>
        </>
      )}
    </section>
  );
}
