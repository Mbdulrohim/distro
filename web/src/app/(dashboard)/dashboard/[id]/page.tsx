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
import { ScheduledRetryPanel } from "@/components/distributions/scheduled-retry-panel";
import { ExecuteScheduledChunksPanel } from "@/components/distributions/execute-scheduled-chunks-panel";
import { ExecutePanel } from "@/components/distributions/execute-panel";
import { isAddress, type Address } from "viem";
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

  // Shared grouping for the scheduled (escrow) path — chunk index = batch
  // index, position = index in batch. Built once here rather than separately
  // in the execute and retry sections, since both need the same chunks.
  const chunksByIndex =
    dist.kind === "scheduled"
      ? Object.entries(
          recipients.reduce<Record<number, typeof recipients>>((byChunk, r) => {
            (byChunk[r.batchIndex] ??= []).push(r);
            return byChunk;
          }, {}),
        )
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([chunkIndex, rows]) => {
            const ordered = [...rows].sort((a, b) => a.indexInBatch - b.indexInBatch);
            return {
              index: Number(chunkIndex),
              rows: ordered,
              payload: encodePayload(
                ordered.map((r) => ({
                  address: r.address as `0x${string}`,
                  amount: BigInt(r.amount),
                })),
              ),
            };
          })
      : [];

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
        <div className="flex flex-wrap gap-2">
          {dist.status === "draft" ? (
            <Link
              href={`/dashboard/new?template=${dist.id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-surface"
            >
              Duplicate as template
            </Link>
          ) : null}
          {["submitted", "partially_completed", "failed"].includes(dist.status) ? (
            <button
              onClick={async () => {
                if (!confirm("Reset to draft? This allows re-executing.")) return;
                try {
                  const res = await fetch(`/api/distributions/${dist.id}/reset`, {
                    method: "POST",
                    credentials: "same-origin",
                  });
                  if (res.ok) {
                    window.location.reload();
                  } else {
                    alert("Failed to reset");
                  }
                } catch (e) {
                  alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-surface"
            >
              Reset to draft
            </button>
          ) : null}
          <StatusBadge status={dist.status} count={failedCount} />
        </div>
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
            chunks={chunksByIndex.map(({ index, payload }) => ({ index, payload }))}
          />
        </section>
      ) : null}

      {/* Draft distributions: ready to execute immediately */}
      {dist.status === "draft" ? (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-medium">Execute</h2>
          {dist.kind === "immediate" ? (
            <ExecutePanel
              distributionId={dist.id}
              token={{
                ref: dist.tokenAddress as `0x${string}`,
                address: isAddress(dist.tokenAddress) ? (dist.tokenAddress as Address) : undefined,
                isNative: dist.tokenAddress === "0x0000000000000000000000000000000000000000",
                symbol: dist.tokenSymbol,
                decimals: dist.tokenDecimals,
                distributable: true,
              }}
              recipients={recipients.map((r, idx) => ({
                line: idx + 1,
                address: r.address as Address,
                amount: BigInt(r.amount),
                amountInput: String(Number(BigInt(r.amount)) / Math.pow(10, dist.tokenDecimals)),
              }))}
            />
          ) : (
            <div className="rounded-lg border border-info/30 bg-info-surface px-4 py-3 text-sm text-info">
              Scheduled distributions require fund() to be called from the create flow before
              execution is available. Finish the creation process to fund and execute.
            </div>
          )}
        </section>
      ) : null}

      {/* Partial failure leads with the remedy, not the alarm. Two entirely
          different remedies depending on kind: an immediate distribution's
          failed tokens never left the wallet (Multisend retry); a scheduled
          one's already left it into escrow at fund() time, so retrying must
          move the SAME escrowed funds via the contract's own `retry`, never
          re-pull from the wallet through Multisend. */}
      {failedCount > 0 && dist.kind === "immediate" ? (
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

      {failedCount > 0 && dist.kind === "scheduled" && dist.escrowAddress ? (
        <div className="mb-8 rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm">
          <p className="font-medium text-warning">
            {failedCount} payment{failedCount === 1 ? "" : "s"} didn&apos;t go through.
          </p>
          <p className="mt-1 mb-3 text-muted-foreground">
            Those tokens are held in the escrow contract, not your wallet — retrying moves the same
            escrowed funds; nobody gets paid twice.
          </p>
          <ScheduledRetryPanel
            distributionId={dist.id}
            escrowAddress={dist.escrowAddress as `0x${string}`}
            chainId={dist.chainId}
            chunks={chunksByIndex
              .map((c) => ({
                chunkIndex: c.index,
                payload: c.payload,
                recipients: c.rows.filter((r) => r.status === "failed"),
                positions: c.rows.filter((r) => r.status === "failed").map((r) => r.indexInBatch),
              }))
              .filter((c) => c.positions.length > 0)}
          />
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
