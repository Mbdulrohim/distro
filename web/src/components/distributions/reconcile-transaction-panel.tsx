"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReconcileTransactionPanelProps {
  distributionId: string;
  pendingBatches: number[];
}

function pendingTxStorageKey(distributionId: string, batchIndex: number) {
  return `distro:pending-tx:${distributionId}:batch:${batchIndex}`;
}

export function ReconcileTransactionPanel({
  distributionId,
  pendingBatches,
}: ReconcileTransactionPanelProps) {
  const router = useRouter();
  const [batchIndex, setBatchIndex] = useState(String(pendingBatches[0] ?? 0));
  const [txHash, setTxHash] = useState("");
  const [status, setStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    for (const index of pendingBatches) {
      let saved: string | null = null;
      try {
        saved = window.localStorage.getItem(pendingTxStorageKey(distributionId, index));
      } catch {
        saved = null;
      }
      if (saved) {
        setBatchIndex(String(index));
        setTxHash(saved);
        return;
      }
    }
  }, [distributionId, pendingBatches]);

  async function reconcile() {
    const parsedBatch = Number(batchIndex);
    if (!Number.isInteger(parsedBatch) || parsedBatch < 0) {
      setStatus("error");
      setMessage("Enter a valid batch number.");
      return;
    }

    setStatus("syncing");
    setMessage(null);

    const response = await fetch(`/api/distributions/${distributionId}/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ batchIndex: parsedBatch, txHash: txHash.trim() }),
    });

    if (!response.ok) {
      const body = await response.text();
      setStatus("error");
      setMessage(body || "Could not sync this transaction.");
      return;
    }

    try {
      window.localStorage.removeItem(pendingTxStorageKey(distributionId, parsedBatch));
    } catch {
      // Storage is only a convenience; the server has already recorded the receipt.
    }
    setStatus("done");
    setMessage("Synced. Refreshing the ledger...");
    router.refresh();
  }

  return (
    <div className="mb-8 rounded-lg border border-info/30 bg-info-surface px-4 py-3 text-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="reconcile-tx" className="mb-1 block text-xs text-muted-foreground">
            Transaction hash
          </label>
          <input
            id="reconcile-tx"
            value={txHash}
            onChange={(event) => setTxHash(event.target.value)}
            placeholder="0x..."
            className="h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-sm outline-none focus:border-info"
          />
        </div>
        <div className="w-28">
          <label htmlFor="reconcile-batch" className="mb-1 block text-xs text-muted-foreground">
            Batch
          </label>
          <input
            id="reconcile-batch"
            value={batchIndex}
            onChange={(event) => setBatchIndex(event.target.value)}
            inputMode="numeric"
            className="h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-sm outline-none focus:border-info"
          />
        </div>
        <Button onClick={reconcile} disabled={status === "syncing" || txHash.trim() === ""}>
          {status === "syncing" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : status === "done" ? (
            <Check className="size-4" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Sync
        </Button>
      </div>
      {message ? (
        <p className={status === "error" ? "mt-2 text-destructive" : "mt-2 text-muted-foreground"}>
          {message}
        </p>
      ) : (
        <p className="mt-2 text-muted-foreground">
          If a wallet transaction was mined but rows still show Not sent, paste the tx hash here.
        </p>
      )}
    </div>
  );
}
