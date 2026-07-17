"use client";

import { useMemo, useState } from "react";
import { Check, X, Clock, ExternalLink, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatAmount } from "@/lib/recipients/format";
import { truncateAddress } from "@/lib/format";
import type { RecipientRow } from "@/lib/db/distribution";

/**
 * The recipient ledger — who was paid, who wasn't, and why.
 *
 * Rows stay in committed order (batch, then position). That order is what the
 * on-chain payload committed to and what maps a `Paid` event back to a row, so
 * the table never re-sorts; filtering hides rows, it doesn't reorder them.
 *
 * Never-Color-Alone: each status is an icon AND a word AND a colour, so the
 * meaning survives a grayscale screenshot.
 */

type Filter = "all" | "paid" | "failed";

interface RecipientResultsProps {
  recipients: RecipientRow[];
  decimals: number;
  symbol: string;
  explorer?: string;
}

export function RecipientResults({
  recipients,
  decimals,
  symbol,
  explorer,
}: RecipientResultsProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipients.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (q && !r.address.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [recipients, filter, query]);

  const counts = useMemo(
    () => ({
      all: recipients.length,
      paid: recipients.filter((r) => r.status === "paid").length,
      failed: recipients.filter((r) => r.status === "failed").length,
    }),
    [recipients],
  );

  function exportCsv() {
    // A receipt tells the whole truth — failures included and marked, not just
    // the successes.
    const rows = [
      ["address", "amount", "status", "reason", "tx_hash"],
      ...recipients.map((r) => [
        r.address,
        formatAmount(BigInt(r.amount), decimals),
        r.status,
        r.failureReason ?? "",
        r.txHash ?? "",
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "distribution-recipients.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Recipients</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-border">
            {(["all", "paid", "failed"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 text-xs capitalize ${
                  filter === f
                    ? "bg-surface-2 font-medium text-foreground"
                    : "text-muted-foreground hover:bg-surface"
                }`}
              >
                {f} ({counts[f]})
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search address"
            className="h-8 w-44 rounded-md border border-border bg-background px-2.5 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Button variant="secondary" size="sm" onClick={exportCsv}>
            <Download />
            CSV
          </Button>
        </div>
      </div>

      <div className="max-h-[32rem] overflow-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-surface text-left">
            <tr className="text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Address</th>
              <th className="w-32 px-4 py-2 text-right font-medium">Amount</th>
              <th className="w-44 px-4 py-2 font-medium">Status</th>
              <th className="w-28 px-4 py-2 font-medium">Tx</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-surface">
                <td className="px-4 py-2 font-mono text-xs" title={r.address}>
                  {truncateAddress(r.address, 6)}
                </td>
                <td className="px-4 py-2 text-right font-mono text-xs tabular-nums">
                  {formatAmount(BigInt(r.amount), decimals)} {symbol}
                </td>
                <td className="px-4 py-2">
                  <StatusCell status={r.status} reason={r.failureReason} />
                </td>
                <td className="px-4 py-2">
                  {r.txHash && explorer ? (
                    <a
                      href={`${explorer}/tx/${r.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-xs text-info hover:underline"
                    >
                      {truncateAddress(r.txHash, 3)}
                      <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {shown.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {recipients.length === 0
              ? "No recipients on this distribution."
              : "No recipients match these filters."}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function StatusCell({ status, reason }: { status: string; reason: string | null }) {
  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-success">
        <Check className="size-3.5" />
        Paid
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-warning" title={reason ?? ""}>
        <X className="size-3.5" />
        Failed
        {reason ? (
          <span className="truncate text-muted-foreground">— {reason.split("(")[0].trim()}</span>
        ) : null}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Clock className="size-3.5" />
      Not sent
    </span>
  );
}
