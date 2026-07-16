import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Inbox } from "lucide-react";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { findUserId } from "@/lib/db/users";
import { getDashboardStats, getRecentDistributions } from "@/lib/db/dashboard";
import { formatAmountWithSymbol } from "@/lib/recipients/format";
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
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Distributions</h1>
        <Button size="sm" disabled title="Available once the create flow ships">
          <Plus />
          New distribution
        </Button>
      </div>

      {!hasAnything ? (
        <EmptyState />
      ) : (
        <>
          <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="In flight" value={stats!.inFlight} />
            <Stat label="Completed" value={stats!.completed} />
            <Stat label="Needs attention" value={stats!.failed} emphasise={stats!.failed > 0} />
            <Stat label="Drafts" value={stats!.drafts} />
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Total distributed</h2>
            {stats!.totalDistributed.length === 0 ? (
              <p className="rounded-lg border border-border px-4 py-5 text-sm text-muted-foreground">
                Nothing has been paid out yet.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {stats!.totalDistributed.map((t) => (
                  <div key={t.tokenSymbol} className="rounded-lg border border-border px-4 py-3">
                    <p className="font-mono text-lg tabular-nums">
                      {formatAmountWithSymbol(BigInt(t.total), t.tokenDecimals, t.tokenSymbol)}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Grouped by token — amounts in different tokens aren&apos;t comparable, so they are
              never summed into one figure.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Recent activity</h2>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Token</th>
                    <th className="px-4 py-2 text-right font-medium">Recipients</th>
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((d) => (
                    <tr key={d.id} className="border-t border-border">
                      <td className="px-4 py-2.5">{d.name}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{d.tokenSymbol}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                        {d.recipientCount}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                        {formatAmountWithSymbol(BigInt(d.totalAmount), d.tokenDecimals, "")}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={d.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <ScheduledNotice />
    </main>
  );
}

function Stat({ label, value, emphasise }: { label: string; value: number; emphasise?: boolean }) {
  return (
    <div className="rounded-lg border border-border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-2xl tabular-nums ${emphasise ? "text-destructive" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-16 text-center">
      <Inbox className="mx-auto mb-3 size-6 text-muted-foreground" aria-hidden />
      <h2 className="text-base font-medium">Create your first distribution</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Import a CSV of addresses and amounts, choose a token, and pay everyone at once — instead of
        one transaction at a time.
      </p>
      <div className="mt-5">
        <Button size="sm" disabled title="Available once the create flow ships">
          <Plus />
          New distribution
        </Button>
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
    <p className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
      Scheduled distributions and upcoming executions arrive with the escrow contracts. Today every
      distribution executes immediately, while you sign.{" "}
      <Link href="/dashboard" className="underline underline-offset-4">
        Roadmap
      </Link>
    </p>
  );
}
