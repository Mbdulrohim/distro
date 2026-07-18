"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfig, useAccount } from "wagmi";
import { RotateCcw, Loader2, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { retryScheduledChunk } from "@/lib/distributions/execute-scheduled";
import { truncateAddress } from "@/lib/format";
import type { RecipientRow } from "@/lib/db/distribution";

/**
 * Retry the failed subset of a SCHEDULED (escrow) distribution.
 *
 * Deliberately not `RetryPanel` (that one calls Multisend, pulling fresh
 * funds from the creator's wallet — correct for an immediate distribution,
 * wrong here). A scheduled distribution's funds already left the wallet at
 * `fund()` time; retrying must move the SAME escrowed funds via the
 * contract's own `retry`, never open a second funding path.
 *
 * Chunk-scoped: the contract's `retry` takes one chunk index + the failed
 * positions within it, so failures spanning multiple chunks need one call
 * per chunk. The panel walks them automatically.
 */

interface FailedChunk {
  chunkIndex: number;
  /** The full, original chunk payload — required to re-verify the on-chain
   * commitment hash. Same payload `executeChunk` used. */
  payload: `0x${string}`;
  /** Positions within this chunk currently flagged failed. */
  positions: number[];
  /** Recipients at those positions, same order as `positions`. */
  recipients: RecipientRow[];
}

interface ScheduledRetryPanelProps {
  distributionId: string;
  escrowAddress: `0x${string}`;
  chainId: number;
  chunks: FailedChunk[];
}

export function ScheduledRetryPanel({
  distributionId,
  escrowAddress,
  chainId,
  chunks,
}: ScheduledRetryPanelProps) {
  const router = useRouter();
  const config = useConfig();
  const { address: account, chainId: walletChainId } = useAccount();
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [status, setStatus] = useState("");
  const [txs, setTxs] = useState<{ hash: string; confirmed: boolean }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onRightChain = walletChainId === chainId;
  const explorer = config.chains.find((c) => c.id === chainId)?.blockExplorers?.default.url;
  const totalFailed = chunks.reduce((n, c) => n + c.positions.length, 0);

  async function run() {
    if (!account) return;
    setPhase("running");
    setError(null);
    setTxs([]);

    try {
      for (const chunk of chunks) {
        setStatus(`Confirm retry for chunk ${chunk.chunkIndex + 1} in your wallet…`);
        const stream = retryScheduledChunk({
          config,
          chainId,
          distribution: escrowAddress,
          chunkIndex: chunk.chunkIndex,
          payload: chunk.payload,
          positions: chunk.positions,
        });

        for await (const ev of stream) {
          if (ev.type === "retry:submitted") {
            setStatus("Submitted, waiting for confirmation…");
            setTxs((t) => [...t, { hash: ev.txHash, confirmed: false }]);
          } else if (ev.type === "retry:confirmed") {
            setTxs((t) =>
              t.map((x) => (x.hash === ev.result.txHash ? { ...x, confirmed: true } : x)),
            );
            await fetch(`/api/distributions/${distributionId}/retry`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "same-origin",
              body: JSON.stringify({
                txHash: ev.result.txHash,
                blockNumber: ev.result.blockNumber.toString(),
                gasUsed: ev.result.gasUsed.toString(),
                payments: ev.result.payments.map((p) => ({
                  recipient: p.recipient,
                  amount: p.amount.toString(),
                  status: p.status,
                  // No renumbering here — `retry`'s positions ARE the
                  // original committed positions, unlike a fresh Multisend
                  // payload.
                  originBatchIndex: chunk.chunkIndex,
                  originIndexInBatch: p.index,
                })),
              }),
            });
          }
        }
      }

      setPhase("done");
      setStatus("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry failed.");
      setPhase("error");
    }
  }

  if (totalFailed === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {phase === "idle" ? (
        <Button size="sm" onClick={run} disabled={!onRightChain}>
          <RotateCcw />
          Retry {totalFailed} failed
        </Button>
      ) : null}

      {!onRightChain && phase === "idle" ? (
        <p className="text-xs text-muted-foreground">
          Switch your wallet to the network this distribution runs on to retry.
        </p>
      ) : null}

      {phase === "running" ? (
        <div className="flex items-center gap-2 text-sm text-info">
          <Loader2 className="size-4 animate-spin" />
          {status}
        </div>
      ) : null}

      {txs.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {txs.map((t) => (
            <li key={t.hash} className="flex items-center gap-2 text-sm">
              {t.confirmed ? (
                <Check className="size-4 text-success" />
              ) : (
                <Loader2 className="size-4 animate-spin text-info" />
              )}
              <span className="text-muted-foreground">
                {t.confirmed ? "Retry confirmed" : "Submitted, waiting…"}
              </span>
              {explorer ? (
                <a
                  href={`${explorer}/tx/${t.hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs text-info hover:underline"
                >
                  {truncateAddress(t.hash)}
                  <ExternalLink className="size-3" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
