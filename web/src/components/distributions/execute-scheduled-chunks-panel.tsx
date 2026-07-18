"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfig, useChainId } from "wagmi";
import { Loader2, Check, Clock, ExternalLink, AlertTriangle } from "lucide-react";
import {
  executeScheduledDistribution,
  type ExecuteScheduledEvent,
  type ExecuteScheduledChunk,
} from "@/lib/distributions/execute-scheduled";
import { truncateAddress } from "@/lib/format";
import { formatScheduleForDisplay } from "@/lib/schedule/validate";

/** Persist one executed chunk's results — the same endpoint the immediate
 * (Multisend) path posts to; `batch_index`/`index_in_batch` mean the same
 * thing here (chunk index / position within it). */
async function persistChunk(
  distributionId: string,
  r: {
    chunkIndex: number;
    txHash: string;
    blockNumber: bigint;
    gasUsed: bigint;
    payments: { recipient: string; amount: bigint; index: number; status: "paid" | "failed" }[];
  },
): Promise<void> {
  try {
    await fetch(`/api/distributions/${distributionId}/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        batchIndex: r.chunkIndex,
        txHash: r.txHash,
        blockNumber: r.blockNumber.toString(),
        gasUsed: r.gasUsed.toString(),
        payments: r.payments.map((p) => ({
          recipient: p.recipient,
          amount: p.amount.toString(),
          index: p.index,
          status: p.status,
        })),
      }),
    });
  } catch (e) {
    console.error("Failed to persist chunk results; chain state is unaffected", e);
  }
}

interface ExecuteScheduledChunksPanelProps {
  distributionId: string;
  escrowAddress: `0x${string}`;
  chunks: ExecuteScheduledChunk[];
  /** Unix seconds, or null for "no restriction". Display only — the contract
   * is the actual authority on whether it's early. */
  executeAfter: number | null;
}

/**
 * Runs the remaining `executeChunk` calls for a funded, scheduled
 * distribution. Permissionless on the contract's side — this page is simply
 * the one place that currently offers the button (see the module doc in
 * lib/distributions/execute-scheduled.ts for the honest limit: a public,
 * unauthenticated "anyone can execute this" page doesn't exist yet).
 */
export function ExecuteScheduledChunksPanel({
  distributionId,
  escrowAddress,
  chunks,
  executeAfter,
}: ExecuteScheduledChunksPanelProps) {
  const router = useRouter();
  const config = useConfig();
  const chainId = useChainId();
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [tooEarly, setTooEarly] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chunkStates, setChunkStates] = useState<
    Record<number, { txHash?: string; confirmed: boolean; skipped: boolean }>
  >({});

  async function run() {
    setRunning(true);
    setError(null);
    setTooEarly(null);

    try {
      const stream = executeScheduledDistribution({
        config,
        chainId,
        distribution: escrowAddress,
        chunks,
      });

      for await (const ev of stream) {
        await handleEvent(ev);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Execution failed.");
    } finally {
      setRunning(false);
    }
  }

  async function handleEvent(ev: ExecuteScheduledEvent) {
    switch (ev.type) {
      case "chunk:too-early":
        setTooEarly(ev.executeAfter);
        break;
      case "chunk:skipped-already-executed":
        setChunkStates((s) => ({
          ...s,
          [ev.chunkIndex]: { confirmed: true, skipped: true },
        }));
        break;
      case "chunk:signing":
        setStatus(`Confirm chunk ${ev.chunkIndex + 1} of ${ev.total} in your wallet…`);
        break;
      case "chunk:submitted":
        setStatus(`Chunk ${ev.chunkIndex + 1} of ${ev.total} submitted, waiting…`);
        setChunkStates((s) => ({
          ...s,
          [ev.chunkIndex]: { txHash: ev.txHash, confirmed: false, skipped: false },
        }));
        break;
      case "chunk:confirmed":
        setChunkStates((s) => ({
          ...s,
          [ev.result.chunkIndex]: {
            txHash: ev.result.txHash,
            confirmed: true,
            skipped: false,
          },
        }));
        // Record immediately, per chunk — not at the end. If the tab closes
        // mid-run the money has still moved, and the record must survive it.
        await persistChunk(distributionId, ev.result);
        break;
      case "done":
        setStatus("");
        break;
    }
  }

  if (tooEarly !== null) {
    const { local, utc } = formatScheduleForDisplay(tooEarly);
    return (
      <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info-surface px-4 py-3 text-sm text-info">
        <Clock className="mt-0.5 size-4 shrink-0" />
        <span>
          Not executable yet — scheduled for {local} ({utc}). Anyone can trigger it once that time
          arrives.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {!running ? (
        <div className="flex flex-col items-start gap-2">
          <button
            type="button"
            onClick={run}
            className="inline-flex w-fit items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary-hover"
          >
            Execute {chunks.length === 1 ? "this chunk" : `${chunks.length} remaining chunks`}
          </button>
          {executeAfter ? (
            <p className="text-xs text-muted-foreground">
              Scheduled for {formatScheduleForDisplay(executeAfter).local} — the contract itself
              enforces this, this button just attempts it.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-info/30 bg-info-surface px-4 py-3 text-sm text-info">
          <Loader2 className="size-4 shrink-0 animate-spin" />
          <span>{status}</span>
        </div>
      )}

      {Object.keys(chunkStates).length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {chunks.map((c) => {
            const s = chunkStates[c.index];
            if (!s) return null;
            return (
              <li key={c.index} className="flex items-center gap-2 text-sm">
                {s.confirmed ? (
                  <Check className="size-4 shrink-0 text-success" />
                ) : (
                  <Loader2 className="size-4 shrink-0 animate-spin text-info" />
                )}
                <span className="text-muted-foreground">
                  Chunk {c.index + 1} —{" "}
                  {s.skipped
                    ? "already executed"
                    : s.confirmed
                      ? "confirmed"
                      : "submitted, waiting…"}
                </span>
                {s.txHash ? (
                  <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
                    {truncateAddress(s.txHash)}
                    <ExternalLink className="size-3" />
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive-surface px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}
