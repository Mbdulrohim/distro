import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Inbox, ChevronRight } from "lucide-react";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { findUserId } from "@/lib/db/users";
import { getDashboardStats, getRecentDistributions } from "@/lib/db/dashboard";
import { formatAmount } from "@/lib/recipients/format";
import { StatusBadge } from "@/components/distributions/status-badge";
import { Button } from "@/components/ui/button";

/**
 * Dashboard. Server-rendered from the verified session — the wallet address
 * comes from the signed JWT, never from client input, and every query is
 * scoped to that user's id on the server.
 *
 * Every figure here is read from the database. Nothing is placeholder: if a
 * counter reads zero, it is genuinely zero.
 */
export default async function DashboardPage() {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);

  // Middleware guards this route; re-verifying here is defence in depth — never
  // render authenticated chrome without a verified session.
  if (!session) redirect("/");

  const userId = await findUserId(session.address);
  // A verified session whose user row is missing shouldn't happen (sign-in
  // provisions it), but treat it as "nothing yet" rather than crashing.
  const [stats, recent] = userId
    ? await Promise.all([getDashboardStats(userId), getRecentDistributions(userId)])
    : [null, []];

  const hasAnything =
    stats !== null && stats.inFlight + stats.completed + stats.failed + stats.drafts > 0;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-12">
      <div className="mb-10 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Distributions</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Pay many wallets at once, tracked to the last payment.
          </p>
        </div>
        <Button render={<Link href="/dashboard/new" />}>
          <Plus />
          New distribution
        </Button>
      </div>

      {!hasAnything ? (
        <EmptyState />
      ) : (
        <div className="flex animate-in flex-col gap-12 duration-500 fade-in-0 slide-in-from-bottom-2">
          {/* Counters — one unified strip with hairline dividers, flat by
              default (DESIGN.md), rather than four floating boxes. */}
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Total distributions" value={stats!.totalDistributions} />
            <Stat label="Scheduled" value={stats!.scheduled} />
            <Stat label="In flight" value={stats!.inFlight} />
            <Stat label="Completed" value={stats!.completed} />
            <Stat label="Needs attention" value={stats!.failed} emphasise={stats!.failed > 0} />
            <Stat label="Drafts" value={stats!.drafts} />
          </dl>

          <section>
            <SectionHeading>Total volume</SectionHeading>
            {stats!.totalDistributed.length === 0 ? (
              <p className="rounded-xl border border-border bg-surface px-4 py-5 text-sm text-muted-foreground">
                Nothing has been paid out yet.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {stats!.totalDistributed.map((t) => (
                  <div key={t.tokenSymbol} className="rounded-xl border border-border px-4 py-4">
                    <p className="font-mono text-xs text-muted-foreground">{t.tokenSymbol}</p>
                    <p className="mt-1 font-mono text-xl tabular-nums">
                      {formatAmount(BigInt(t.total), t.tokenDecimals)}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2.5 text-xs text-muted-foreground">
              Grouped by token — amounts in different tokens aren&apos;t comparable, so they are
              never summed into one figure.
            </p>
          </section>

          <section>
            <SectionHeading>Recent activity</SectionHeading>
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-surface text-left text-[0.7rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="hidden px-4 py-3 sm:table-cell">Token</th>
                      <th className="hidden px-4 py-3 text-right sm:table-cell">Recipients</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="hidden px-4 py-3 md:table-cell">Created</th>
                      <th className="w-8 px-2 py-3" aria-hidden />
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((d) => (
                      <tr
                        key={d.id}
                        className="group relative border-t border-border transition-colors hover:bg-surface"
                      >
                        <td className="px-4 py-3">
                          {/* The row is a link to the detail page — the whole
                              cell is the hit target for pointer + keyboard. */}
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
          </section>
        </div>
      )}

      <ScheduledNotice />
    </main>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-sm font-medium text-muted-foreground">{children}</h2>;
}

function Stat({ label, value, emphasise }: { label: string; value: number; emphasise?: boolean }) {
  return (
    <div className="group bg-background px-4 py-5 transition-colors hover:bg-surface">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={`mt-1.5 font-mono text-[1.75rem] leading-none tabular-nums ${emphasise ? "text-warning" : "text-foreground"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-surface px-6 py-24 text-center">
      {/* A soft brand glow behind the empty state — the one flourish that
          turns a blank first-run screen into something that feels designed. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 mx-auto h-40 w-80 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl border border-primary/15 bg-gradient-to-br from-light-purple to-lavender text-primary shadow-sm">
          <Inbox className="size-6" aria-hidden />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">Create your first distribution</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Import a CSV of addresses and amounts, choose a token, and pay everyone at once — instead
          of one transaction at a time.
        </p>
        <div className="mt-7">
          <Button render={<Link href="/dashboard/new" />}>
            <Plus />
            New distribution
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Scheduling is a Tier-2 (escrow) capability and the contracts aren't deployed,
 * so there is deliberately no "Scheduled" counter or "Upcoming executions" list
 * — showing a hardcoded zero would be inventing a feature. This states the real
 * position instead.
 */
function ScheduledNotice() {
  return (
    <p className="mt-12 border-t border-border pt-5 text-xs text-muted-foreground">
      Scheduled distributions and upcoming executions arrive with the escrow contracts. Today every
      distribution executes immediately, while you sign.{" "}
      <a
        href="https://github.com/tweetbysobur/distro/blob/main/docs/ROADMAP.md"
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-4 hover:text-foreground"
      >
        Roadmap
      </a>
    </p>
  );
}
