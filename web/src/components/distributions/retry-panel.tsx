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
 * The retry payload is renumbered (4 failures become indices 0-3), but this
 * component does NOT carry the mapping back to original positions — the
 * /retry endpoint derives that itself, server-side, from the currently-failed
 * rows in canonical order. A client-asserted mapping can't be trusted to
 * attach a real onchain event to the correct ledger row when duplicate
 * (address, amount) entries exist, so it's not sent at all. See the endpoint's
 * own doc comment for the full reasoning.
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
            body: JSON.stringify({ txHash: ev.result.txHash }),
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
