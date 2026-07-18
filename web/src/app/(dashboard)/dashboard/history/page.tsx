import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronRight, ChevronLeft, Inbox } from "lucide-react";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { findUserId } from "@/lib/db/users";
import { getHistory, HISTORY_STATUSES, type HistoryStatus } from "@/lib/db/dashboard";
import { formatAmount } from "@/lib/recipients/format";
import { StatusBadge } from "@/components/distributions/status-badge";

const PAGE_SIZE = 20;
const STATUS_LABELS: Record<HistoryStatus, string> = {
  draft: "Draft",
  submitted: "In flight",
  completed: "Completed",
  partially_completed: "Partial",
  failed: "Failed",
};
const FILTERS: { value: HistoryStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  ...HISTORY_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
];

/**
 * Full distribution history — the audit trail. Filters and page number live
 * in the URL (not client state), so a reload or a shared link reproduces the
 * exact same view, and a failed fetch never loses the user's filter choice.
 */
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/");

  const userId = await findUserId(session.address);
  const { status: rawStatus, page: rawPage } = await searchParams;
  const status = FILTERS.some((f) => f.value === rawStatus)
    ? (rawStatus as HistoryStatus | "all")
    : "all";
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);

  const { rows, total } = userId
    ? await getHistory(userId, {
        status: status === "all" ? undefined : status,
        page,
        pageSize: PAGE_SIZE,
      })
    : { rows: [], total: 0 };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-12">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Dashboard
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every distribution you&apos;ve ever created, filterable by status.
        </p>
      </div>

      <nav className="mb-6 flex flex-wrap gap-1.5" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "all" ? "/dashboard/history" : `/dashboard/history?status=${f.value}`}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              status === f.value
                ? "border-primary/30 bg-light-purple text-primary-text"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState hasFilter={status !== "all"} />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Token</th>
                    <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">
                      Recipients
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">Total</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="hidden px-4 py-2.5 font-medium md:table-cell">Created</th>
                    <th className="w-8 px-2 py-2.5" aria-hidden />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d) => (
                    <tr
                      key={d.id}
                      className="group relative border-t border-border transition-colors hover:bg-surface"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/${d.id}`}
                          className="font-medium outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
                        >
                          {d.name}
                        </Link>
                      </td>
                      <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground sm:table-cell">
                        {d.tokenSymbol}
                      </td>
                      <td className="hidden px-4 py-3 text-right font-mono tabular-nums sm:table-cell">
                        {d.recipientCount}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {formatAmount(BigInt(d.totalAmount), d.tokenDecimals)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={d.status} />
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                        {new Date(d.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <ChevronRight className="ml-auto size-4 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between text-sm">
              <Link
                href={pageHref(status, page - 1)}
                aria-disabled={page <= 1}
                className={`inline-flex items-center gap-1 ${
                  page <= 1
                    ? "pointer-events-none text-muted-foreground/40"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ChevronLeft className="size-4" />
                Previous
              </Link>
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Link
                href={pageHref(status, page + 1)}
                aria-disabled={page >= totalPages}
                className={`inline-flex items-center gap-1 ${
                  page >= totalPages
                    ? "pointer-events-none text-muted-foreground/40"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Next
                <ChevronRight className="size-4" />
              </Link>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}

function pageHref(status: HistoryStatus | "all", page: number): string {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/dashboard/history?${qs}` : "/dashboard/history";
}

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-20 text-center">
      <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl border border-border bg-background">
        <Inbox className="size-5 text-muted-foreground" aria-hidden />
      </div>
      <h2 className="text-base font-medium">
        {hasFilter ? "Nothing matches this filter" : "No distributions yet"}
      </h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
        {hasFilter
          ? "Try a different status, or view all distributions."
          : "Once you create a distribution, it will show up here."}
      </p>
    </div>
  );
}
