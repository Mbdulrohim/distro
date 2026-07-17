"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfig, useAccount } from "wagmi";
import { RotateCcw, Loader2, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { executeDistribution } from "@/lib/distributions/execute";
import { isMultisendDeployed, getMultisendAddress } from "@/config/contracts";
import { truncateAddress } from "@/lib/format";
import type { RecipientRow } from "@/lib/db/distribution";

/**
 * Retry the failed subset of a distribution.
 *
 * Retry needs no special contract support: a failed payment simply never
 * happened — the tokens are still in the sender's wallet — so retrying is just
 * another `distribute` with the failed entries.
 *
 * The one thing that IS special: the retry payload is renumbered (4 failures
 * become indices 0-3), so each result must be mapped back to the recipient's
 * ORIGINAL position, not the retry index. That mapping is carried here and
 * enforced by the /retry endpoint.
 */

interface RetryPanelProps {
  distributionId: string;
  tokenAddress: `0x${string}`;
  tokenDecimals: number;
  chainId: number;
  /** Only the failed recipients, in their original committed order. */
  failed: RecipientRow[];
}

export function RetryPanel({ distributionId, tokenAddress, chainId, failed }: RetryPanelProps) {
  const router = useRouter();
  const config = useConfig();
  const { address: account, chainId: walletChainId } = useAccount();
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [status, setStatus] = useState("");
  const [tx, setTx] = useState<{ hash: string; confirmed: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onRightChain = walletChainId === chainId;
  const deployed = isMultisendDeployed(chainId);
  const explorer = config.chains.find((c) => c.id === chainId)?.blockExplorers?.default.url;

  async function run() {
    if (!account || !deployed) return;
    setPhase("running");
    setError(null);

    // Position map: retry index i -> original (batch, index). This is the whole
    // point of the retry path; without it, results land on the wrong people.
    const origin = failed.map((r) => ({
      batchIndex: r.batchIndex,
      indexInBatch: r.indexInBatch,
    }));

    try {
      const stream = executeDistribution({
        config,
        chainId,
        multisend: getMultisendAddress(chainId),
        token: tokenAddress,
        account,
        entries: failed.map((r) => ({
          address: r.address as `0x${string}`,
          amount: BigInt(r.amount),
        })),
        // One transaction — the failed set is small by definition.
        batchSize: failed.length,
      });

      for await (const ev of stream) {
        if (ev.type === "approve:required" || ev.type === "approve:signing")
          setStatus("Confirm the approval in your wallet…");
        else if (ev.type === "batch:signing") setStatus("Confirm the retry in your wallet…");
        else if (ev.type === "batch:submitted") {
          setStatus("Submitted, waiting for confirmation…");
          setTx({ hash: ev.txHash, confirmed: false });
        } else if (ev.type === "batch:confirmed") {
          setTx({ hash: ev.result.txHash, confirmed: true });
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
                // Map the renumbered result back to the original position.
                originBatchIndex: origin[p.index].batchIndex,
                originIndexInBatch: origin[p.index].indexInBatch,
              })),
            }),
          });
        } else if (ev.type === "done") {
          setPhase("done");
          setStatus("");
          router.refresh();
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry failed.");
      setPhase("error");
    }
  }

  if (failed.length === 0 || !deployed) return null;

  return (
    <div className="flex flex-col gap-3">
      {phase === "idle" ? (
        <Button size="sm" onClick={run} disabled={!onRightChain}>
          <RotateCcw />
          Retry {failed.length} failed
        </Button>
      ) : null}

      {!onRightChain && phase === "idle" ? (
        <p className="text-xs text-muted-foreground">
          Switch your wallet to the network this distribution ran on to retry.
        </p>
      ) : null}

      {phase === "running" ? (
        <div className="flex items-center gap-2 text-sm text-info">
          <Loader2 className="size-4 animate-spin" />
          {status}
        </div>
      ) : null}

      {tx ? (
        <div className="flex items-center gap-2 text-sm">
          {tx.confirmed ? (
            <Check className="size-4 text-success" />
          ) : (
            <Loader2 className="size-4 animate-spin text-info" />
          )}
          <span className="text-muted-foreground">
            {tx.confirmed ? "Retry confirmed" : "Submitted, waiting…"}
          </span>
          {explorer ? (
            <a
              href={`${explorer}/tx/${tx.hash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs text-info hover:underline"
            >
              {truncateAddress(tx.hash)}
              <ExternalLink className="size-3" />
            </a>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
