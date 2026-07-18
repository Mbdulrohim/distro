"use client";

import { useState } from "react";
import { useConfig, useAccount } from "wagmi";
import { Loader2, Check, X, ExternalLink, AlertTriangle } from "lucide-react";
import {
  createScheduledDistribution,
  NATIVE_TOKEN,
  type ScheduledCreateEvent,
} from "@/lib/distributions/execute-scheduled";
import { isDistributionFactoryDeployed, getDistributionFactoryAddress } from "@/config/contracts";
import { truncateAddress } from "@/lib/format";
import { formatAmountWithSymbol } from "@/lib/recipients/format";
import { maxRecipientsPerBatch } from "@/lib/gas/estimate";
import type { ValidRecipient } from "@/lib/recipients/types";
import type { TokenSelection } from "@/lib/tokens/types";

/**
 * The scheduled (escrow) send. Drives create -> commit chunks -> fund, and
 * reports progress at each real on-chain step — mirrors `ExecutePanel`'s
 * submitted-vs-confirmed discipline, but for a flow with three transaction
 * types instead of one.
 *
 * Persists the escrow address the moment `createDistribution` confirms
 * (before commit/fund even start) — same "record immediately, per step" rule
 * as `ExecutePanel`: if the tab closes mid-run, the on-chain clone still
 * exists and the DB row must know where it is.
 */

interface ScheduledExecutePanelProps {
  distributionId: string;
  token: TokenSelection;
  recipients: ValidRecipient[];
  /** Unix seconds; 0 means "no restriction — executable once funded". */
  executeAfter: number;
  /** Returned by the create-draft API call — the salt this row expects. */
  salt: `0x${string}`;
  onComplete?: (distributionAddress: string) => void;
}

export function ScheduledExecutePanel({
  distributionId,
  token,
  recipients,
  executeAfter,
  salt,
  onComplete,
}: ScheduledExecutePanelProps) {
  const config = useConfig();
  const { address: account, chainId } = useAccount();
  const [status, setStatus] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txs, setTxs] = useState<{ hash: string; label: string; confirmed: boolean }[]>([]);

  const deployed = chainId !== undefined && isDistributionFactoryDeployed(chainId);

  async function run() {
    if (!account || !chainId || !deployed) return;
    setRunning(true);
    setError(null);
    setTxs([]);

    try {
      const factory = getDistributionFactoryAddress(chainId);
      const tokenAddress = token.isNative ? NATIVE_TOKEN : token.address;
      if (!tokenAddress) throw new Error("No token resolved.");

      const stream = createScheduledDistribution({
        config,
        chainId,
        factory,
        token: tokenAddress,
        account,
        entries: recipients.map((r) => ({ address: r.address, amount: r.amount })),
        executeAfter,
        chunkSize: maxRecipientsPerBatch(),
        salt,
      });

      for await (const ev of stream) {
        await handleEvent(ev);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the scheduled distribution.");
    } finally {
      setRunning(false);
    }
  }

  async function handleEvent(ev: ScheduledCreateEvent) {
    switch (ev.type) {
      case "create:signing":
        setStatus("Confirm creating the escrow in your wallet…");
        break;
      case "create:submitted":
        setStatus("Escrow creation submitted, waiting…");
        setTxs((t) => [...t, { hash: ev.txHash, label: "Create escrow", confirmed: false }]);
        break;
      case "create:confirmed":
        setTxs((t) => t.map((x) => (x.label === "Create escrow" ? { ...x, confirmed: true } : x)));
        // Persist immediately — the clone exists on-chain now regardless of
        // whether commit/fund ever complete.
        await fetch(`/api/distributions/${distributionId}/escrow`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ escrowAddress: ev.distribution }),
        }).catch(() => {
          // The on-chain clone is the source of truth either way; a failed
          // persist here doesn't lose money, only a dashboard label. Surfaced
          // via console, not blocking the flow.
          console.error("Failed to persist escrow address");
        });
        break;
      case "commit:signing":
        setStatus(`Confirm committing chunk ${ev.chunkIndex + 1} of ${ev.total}…`);
        break;
      case "commit:submitted":
        setStatus(`Chunk ${ev.chunkIndex + 1} of ${ev.total} submitted, waiting…`);
        setTxs((t) => [
          ...t,
          { hash: ev.txHash, label: `Commit chunk ${ev.chunkIndex + 1}`, confirmed: false },
        ]);
        break;
      case "commit:confirmed":
        setTxs((t) =>
          t.map((x) =>
            x.label === `Commit chunk ${ev.chunkIndex + 1}` ? { ...x, confirmed: true } : x,
          ),
        );
        break;
      case "approve:required":
        setStatus(
          `Approve ${formatAmountWithSymbol(ev.amount, token.decimals, token.symbol)} — confirm in your wallet`,
        );
        break;
      case "approve:skipped":
        setStatus("Already approved");
        break;
      case "approve:submitted":
        setStatus("Approval submitted, waiting…");
        break;
      case "approve:confirmed":
        setStatus("Approved");
        break;
      case "fund:signing":
        setStatus("Confirm funding the escrow in your wallet…");
        break;
      case "fund:submitted":
        setStatus("Funding submitted, waiting…");
        setTxs((t) => [...t, { hash: ev.txHash, label: "Fund escrow", confirmed: false }]);
        break;
      case "fund:confirmed":
        setTxs((t) => t.map((x) => (x.label === "Fund escrow" ? { ...x, confirmed: true } : x)));
        break;
      case "done":
        setStatus("");
        setDone(true);
        onComplete?.(ev.distribution);
        break;
    }
  }

  if (!deployed) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>
          The escrow contract isn&apos;t deployed on this network yet, so a scheduled distribution
          can&apos;t be created here. Switch to a supported network or send now instead.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {!running && !done ? (
        <button
          type="button"
          onClick={run}
          className="inline-flex w-fit items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary-hover"
        >
          Create scheduled distribution
        </button>
      ) : null}

      {running ? (
        <div className="flex items-center gap-2 rounded-lg border border-info/30 bg-info-surface px-4 py-3 text-sm text-info">
          <Loader2 className="size-4 shrink-0 animate-spin" />
          <span>{status}</span>
        </div>
      ) : null}

      {txs.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {txs.map((t) => (
            <li key={t.hash} className="flex items-center gap-2 text-sm">
              {t.confirmed ? (
                <Check className="size-4 shrink-0 text-success" />
              ) : (
                <Loader2 className="size-4 shrink-0 animate-spin text-info" />
              )}
              <span className="text-muted-foreground">
                {t.label} — {t.confirmed ? "confirmed" : "submitted, waiting…"}
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
                {truncateAddress(t.hash)}
                <ExternalLink className="size-3" />
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive-surface px-4 py-3 text-sm text-destructive">
          <X className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {done ? (
        <div className="rounded-lg border border-success/30 bg-success-surface px-4 py-3 text-sm text-success">
          <strong>Escrowed and scheduled.</strong> Anyone can trigger execution once the scheduled
          time arrives — you don&apos;t need to be online.
        </div>
      ) : null}
    </div>
  );
}
