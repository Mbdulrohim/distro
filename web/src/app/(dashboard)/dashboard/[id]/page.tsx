import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { findUserId } from "@/lib/db/users";
import { getDistribution, getRecipients, getSummary, getTransactions } from "@/lib/db/distribution";
import { StatusBadge } from "@/components/distributions/status-badge";
import { RecipientResults } from "@/components/distributions/recipient-results";
import { RetryPanel } from "@/components/distributions/retry-panel";
import { ExecuteScheduledChunksPanel } from "@/components/distributions/execute-scheduled-chunks-panel";
import { isAddress } from "viem";
import { formatAmountWithSymbol } from "@/lib/recipients/format";
import { truncateAddress } from "@/lib/format";
import { supportedChains } from "@/config/chains";
import { encodePayload } from "@/lib/recipients/encode";

/**
 * Distribution detail — the record of what happened, and the remedy for what
 * didn't.
 *
 * Server-rendered from the database, which holds only what the chain already
 * said (results are decoded from the execution receipt — see
 * api/distributions/[id]/results). Ownership is re-checked here rather than
 * trusted from the URL: someone else's id must 404, not leak.
 */
export default async function DistributionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/");

  const userId = await findUserId(session.address);
  if (!userId) redirect("/");

  const dist = await getDistribution(id, userId);
  if (!dist) notFound();

  const [summary, recipients, txs] = await Promise.all([
    getSummary(id),
    getRecipients(id),
    getTransactions(id),
  ]);

  const explorer = supportedChains.find((c) => c.id === dist.chainId)?.blockExplorers?.default.url;
  const failedCount = summary.failed;

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Distributions
      </Link>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{dist.name}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            {dist.tokenSymbol} · {truncateAddress(dist.tokenAddress)} ·{" "}
            {new Date(dist.createdAt).toLocaleDateString()}
          </p>
        </div>
        <StatusBadge status={dist.status} count={failedCount} />
      </div>

      {/* Summary — every figure counted from the rows, none assumed */}
      <dl className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
        <Stat label="Paid" value={String(summary.paid)} tone="success" />
        <Stat
          label="Failed"
          value={String(summary.failed)}
          tone={summary.failed > 0 ? "warning" : "muted"}
        />
        <Stat label="Recipients" value={String(dist.recipientCount)} />
        <Stat
          label="Delivered"
          value={formatAmountWithSymbol(summary.totalPaid, dist.tokenDecimals, dist.tokenSymbol)}
        />
      </dl>

      {/* Scheduled distribution: escrowed and committed, but execution itself
          is a separate, later action — permissionless on the contract, only
          reachable from here today (see the module doc on
          ExecuteScheduledChunksPanel's sibling engine for the honest limit). */}
      {dist.kind === "scheduled" &&
      dist.escrowAddress &&
      ["ready", "funded", "executing"].includes(dist.status) ? (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-medium">Execution</h2>
          <ExecuteScheduledChunksPanel
            distributionId={dist.id}
            escrowAddress={dist.escrowAddress as `0x${string}`}
            executeAfter={dist.executeAfter}
            chunks={Object.entries(
              recipients.reduce<Record<number, typeof recipients>>((byChunk, r) => {
                (byChunk[r.batchIndex] ??= []).push(r);
                return byChunk;
              }, {}),
            )
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([chunkIndex, rows]) => ({
                index: Number(chunkIndex),
                payload: encodePayload(
                  [...rows]
                    .sort((a, b) => a.indexInBatch - b.indexInBatch)
                    .map((r) => ({
                      address: r.address as `0x${string}`,
                      amount: BigInt(r.amount),
                    })),
                ),
              }))}
          />
        </section>
      ) : null}

      {/* Partial failure leads with the remedy, not the alarm */}
      {failedCount > 0 ? (
        <div className="mb-8 rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm">
          <p className="font-medium text-warning">
            {failedCount} payment{failedCount === 1 ? "" : "s"} didn&apos;t go through.
          </p>
          <p className="mt-1 mb-3 text-muted-foreground">
            Those tokens never left your wallet — they&apos;re still yours. Retrying sends only the
            failed subset; nobody gets paid twice.
          </p>
          {isAddress(dist.tokenAddress) ? (
            <RetryPanel
              distributionId={dist.id}
              tokenAddress={dist.tokenAddress}
              tokenDecimals={dist.tokenDecimals}
              chainId={dist.chainId}
              failed={recipients.filter((r) => r.status === "failed")}
            />
          ) : null}
        </div>
      ) : null}

      {/* Transactions — "verifiable onchain" as a link, not a claim */}
      {txs.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-medium">Transaction{txs.length === 1 ? "" : "s"}</h2>
          <ul className="flex flex-col gap-1.5">
            {txs.map((t) => (
              <li key={t.batchIndex} className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Batch {t.batchIndex + 1}</span>
                {t.txHash && explorer ? (
                  <a
                    href={`${explorer}/tx/${t.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs text-info hover:underline"
                  >
                    {truncateAddress(t.txHash)}
                    <ExternalLink className="size-3" />
                  </a>
                ) : (
                  <span className="font-mono text-xs text-muted-foreground">not submitted</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <RecipientResults
        recipients={recipients}
        decimals={dist.tokenDecimals}
        symbol={dist.tokenSymbol}
        explorer={explorer}
      />
    </main>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "muted";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <div className="bg-background px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 font-mono text-sm tabular-nums ${toneClass}`}>{value}</dd>
    </div>
  );
}
