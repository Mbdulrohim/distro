"use client";

import { useState } from "react";
import { useConfig, useAccount } from "wagmi";
import { Loader2, Check, X, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { executeDistribution, type BatchResult } from "@/lib/distributions/execute";
import { executeNativeDistribution } from "@/lib/distributions/execute-native";
import {
  isMultisendDeployed,
  getMultisendAddress,
  isMultisendNativeDeployed,
  getMultisendNativeAddress,
} from "@/config/contracts";
import { truncateAddress } from "@/lib/format";
import { formatAmountWithSymbol } from "@/lib/recipients/format";
import { maxRecipientsPerBatch } from "@/lib/gas/estimate";
import type { ValidRecipient } from "@/lib/recipients/types";
import type { TokenSelection } from "@/lib/tokens/types";

/** Post one batch's decoded receipt to the server. Failure here must not lose
 * the run — the chain is the source of truth and the endpoint is idempotent, so
 * a retry can always reconcile. */
async function persistBatch(distributionId: string, r: BatchResult): Promise<void> {
  const maxRetries = 5;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const payload = {
        batchIndex: r.batchIndex,
        txHash: r.txHash,
      };
      console.log(
        `[ExecutePanel] Persisting batch ${r.batchIndex} (attempt ${attempt + 1}/${maxRetries}) to /api/distributions/${distributionId}/results`,
        { payload, txHashLength: r.txHash.length, isValidHex: /^0x[0-9a-fA-F]+$/.test(r.txHash) },
      );
      const response = await fetch(`/api/distributions/${distributionId}/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(
          `[ExecutePanel] persistBatch failed with status ${response.status}: ${errorBody}`,
        );

        // 400 (validation/parsing) usually means "events not found" due to RPC lag
        // 409 (conflict) means the batch already exists, which is fine
        // 401/403 are auth issues that won't retry
        if (response.status === 409) {
          console.log(`[ExecutePanel] Batch already recorded (409), treating as success`);
          return;
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error(`Authentication error: ${errorBody}`);
        }

        // For 400s and 5xx errors, wait before retrying (RPC lag)
        if (attempt < maxRetries - 1) {
          const delayMs = 1000 * Math.pow(2, attempt); // exponential backoff: 1s, 2s, 4s, 8s
          console.log(
            `[ExecutePanel] Retrying in ${delayMs}ms (RPC may not have indexed events yet)`,
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        lastError = new Error(
          `Could not persist verified batch results (${response.status}): ${errorBody.slice(0, 100)}`,
        );
        break;
      }

      console.log(`[ExecutePanel] Batch ${r.batchIndex} persisted successfully`);
      return;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < maxRetries - 1) {
        const delayMs = 1000 * Math.pow(2, attempt);
        console.log(`[ExecutePanel] Retrying in ${delayMs}ms after error:`, lastError.message);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // After all retries, log but don't fail — transaction is on-chain already
  console.error(
    "[ExecutePanel] Failed to persist batch results after 5 retries; chain state is unaffected",
    lastError,
  );
}

/**
 * The send. Drives approve → batched distribute → results, and reports what
 * actually happened rather than what was hoped for.
 *
 * Deliberate UX per docs/UX_SPEC.md:
 *  - *submitted* and *confirmed* are visually distinct. A mining transaction
 *    must never read as done, or the user assumes failure and double-sends.
 *  - Per-recipient failure is a routine outcome with a routine remedy, not an
 *    error screen. One blocklisted address does not mean the run broke.
 *  - Every transaction is one click from its explorer. "Verifiable onchain" is
 *    a link, not a claim.
 */

type Phase = "idle" | "running" | "done" | "error";

interface ExecutePanelProps {
  /** Persist results against this distribution. */
  distributionId: string;
  token: TokenSelection;
  recipients: ValidRecipient[];
  /** Recipients per transaction. Defaults to the same gas-derived size the
   * review screen uses, so the promised transaction count matches reality. */
  batchSize?: number;
  onComplete?: (results: BatchResult[]) => void;
}

export function ExecutePanel({
  distributionId,
  token,
  recipients,
  batchSize,
  onComplete,
}: ExecutePanelProps) {
  // One source of truth for batch sizing, shared with DistributionReview.
  const effectiveBatchSize = batchSize ?? maxRecipientsPerBatch();
  const config = useConfig();
  const { address: account, chainId } = useAccount();
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState<string>("");
  const [results, setResults] = useState<BatchResult[]>([]);
  const [txs, setTxs] = useState<{ hash: string; confirmed: boolean }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const deployed =
    chainId === undefined
      ? false
      : token.isNative
        ? isMultisendNativeDeployed(chainId)
        : isMultisendDeployed(chainId);
  const explorer = config.chains.find((c) => c.id === chainId)?.blockExplorers?.default.url;

  async function run() {
    if (!account || !chainId) return;
    if (!token.isNative && !token.address) return;
    setPhase("running");
    setError(null);
    setTxs([]);
    setResults([]);

    try {
      const stream = token.isNative
        ? executeNativeDistribution({
            config,
            chainId,
            multisendNative: getMultisendNativeAddress(chainId),
            account,
            entries: recipients.map((r) => ({ address: r.address, amount: r.amount })),
            batchSize: effectiveBatchSize,
          })
        : executeDistribution({
            config,
            chainId,
            multisend: getMultisendAddress(chainId),
            token: token.address!,
            account,
            entries: recipients.map((r) => ({ address: r.address, amount: r.amount })),
            batchSize: effectiveBatchSize,
          });

      for await (const ev of stream) {
        switch (ev.type) {
          case "approve:required":
            setStatus(
              `Approve ${formatAmountWithSymbol(ev.amount, token.decimals, token.symbol)} — confirm in your wallet`,
            );
            break;
          case "approve:skipped":
            setStatus("Already approved — sending");
            break;
          case "approve:submitted":
            setStatus("Approval submitted, waiting for confirmation…");
            break;
          case "approve:confirmed":
            setStatus("Approved");
            break;
          case "batch:signing":
            setStatus(`Confirm transaction ${ev.batchIndex + 1} of ${ev.total} in your wallet…`);
            break;
          case "batch:submitted":
            setStatus(`Transaction ${ev.batchIndex + 1} of ${ev.total} submitted, waiting…`);
            setTxs((t) => [...t, { hash: ev.txHash, confirmed: false }]);
            break;
          case "batch:confirmed":
            setTxs((t) =>
              t.map((x) => (x.hash === ev.result.txHash ? { ...x, confirmed: true } : x)),
            );
            setResults((r) => [...r, ev.result]);
            // Record immediately, per batch — not at the end. If the tab closes
            // mid-run the money has still moved, and the record must survive it.
            // The endpoint is idempotent, so a repeat is harmless.
            await persistBatch(distributionId, ev.result);
            break;
          case "done":
            setStatus("");
            setPhase("done");
            onComplete?.(ev.results);
            break;
        }
      }
    } catch (e) {
      // A wallet rejection is a choice, not a fault — say so calmly, and say
      // exactly who has and hasn't been paid.
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error("Distribution execution failed:", errorMessage, e);
      setError(errorMessage);
      setPhase("error");
    }
  }

  const paid = results.reduce((s, r) => s + r.paidCount, 0);
  const failed = results.reduce((s, r) => s + r.failedCount, 0);
  const remaining = recipients.length - paid - failed;

  if (!deployed) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>
          Distro isn&apos;t deployed on this network yet, so this distribution can&apos;t be sent
          here. Switch to a supported network.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {phase === "idle" ? (
        <Button onClick={run} disabled={recipients.length === 0}>
          Distribute to {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
        </Button>
      ) : null}

      {phase === "running" ? (
        <div className="flex items-center gap-2 rounded-lg border border-info/30 bg-info-surface px-4 py-3 text-sm text-info">
          <Loader2 className="size-4 shrink-0 animate-spin" />
          <span>{status}</span>
        </div>
      ) : null}

      {/* Live tally — the truth as it lands, not a guess */}
      {results.length > 0 || phase === "running" ? (
        <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg border border-border px-4 py-3 font-mono text-sm tabular-nums">
          <span className="text-success">{paid} paid</span>
          <span className={failed > 0 ? "text-warning" : "text-muted-foreground"}>
            {failed} failed
          </span>
          <span className="text-muted-foreground">{remaining} remaining</span>
        </div>
      ) : null}

      {/* submitted ≠ confirmed, always visible */}
      {txs.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {txs.map((t, i) => (
            <li key={t.hash} className="flex items-center gap-2 text-sm">
              {t.confirmed ? (
                <Check className="size-4 shrink-0 text-success" />
              ) : (
                <Loader2 className="size-4 shrink-0 animate-spin text-info" />
              )}
              <span className="text-muted-foreground">
                Transaction {i + 1} — {t.confirmed ? "confirmed" : "submitted, waiting…"}
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

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive-surface px-4 py-3 text-sm text-destructive">
          <X className="mt-0.5 size-4 shrink-0" />
          <div>
            <p>{error}</p>
            {paid > 0 ? (
              <p className="mt-1 text-muted-foreground">
                {paid} recipient{paid === 1 ? " was" : "s were"} already paid — those payments
                stand. The rest were not sent.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {phase === "done" ? (
        <div
          className={
            failed > 0
              ? "rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning"
              : "rounded-lg border border-success/30 bg-success-surface px-4 py-3 text-sm text-success"
          }
        >
          {failed > 0 ? (
            <>
              <strong>
                {paid} paid · {failed} failed.
              </strong>{" "}
              The failed payments never left your wallet — those tokens are still yours, and you can
              retry them.
            </>
          ) : (
            <>
              <strong>All {paid} recipients paid.</strong> Every payment is verifiable onchain.
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
