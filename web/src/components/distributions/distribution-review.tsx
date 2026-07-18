"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatAmountWithSymbol } from "@/lib/recipients/format";
import { truncateAddress } from "@/lib/format";
import { planBatches, estimateCostWei, CONSERVATIVE_GAS_PER_RECIPIENT } from "@/lib/gas/estimate";
import { formatScheduleForDisplay } from "@/lib/schedule/validate";
import { formatAmount } from "@/lib/recipients/format";
import type { ValidRecipient } from "@/lib/recipients/types";
import type { ResolvedToken } from "@/lib/tokens/types";
import type { ScheduleDraft } from "@/lib/schedule/types";

/**
 * The review step — the single deliberate pause before real money moves.
 *
 * Per DESIGN.md this is a full screen, never a modal: a modal signals "quick
 * and dismissible", the opposite of what an irreversible action is. The
 * confirmation is an explicit acknowledgement, not a soft "Confirm" button,
 * and the risk is stated in plain words rather than softened.
 *
 * Purely presentational — it renders a draft and reports intent. It does not
 * execute, and it cannot: nothing here touches a wallet.
 */

interface DistributionReviewProps {
  name: string;
  token: ResolvedToken;
  recipients: ValidRecipient[];
  schedule: ScheduleDraft;
  /** Creator's balance, base units — enables the covers check. */
  balance?: bigint;
  /** Current gas price, wei. Omitted → the cost line is hidden rather than guessed. */
  gasPriceWei?: bigint;
  onEdit?: () => void;
  onCancel?: () => void;
  onConfirm?: () => void;
  isConfirming?: boolean;
  /**
   * Override for the confirm button. The create flow passes "Continue to send"
   * because its `onConfirm` *saves a draft* and then reveals the send step — so
   * a "Distribute now" label there would claim to move money it doesn't move.
   */
  confirmLabel?: string;
}

export function DistributionReview({
  name,
  token,
  recipients,
  schedule,
  balance,
  gasPriceWei,
  onEdit,
  onCancel,
  onConfirm,
  isConfirming = false,
  confirmLabel,
}: DistributionReviewProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  const total = useMemo(() => recipients.reduce((sum, r) => sum + r.amount, 0n), [recipients]);

  // Sized off the conservative per-recipient figure: USDC is a reference
  // point, not an upper bound, and a batch that overflows Monad's 30M cap
  // reverts *after* the caller has already paid for the limit.
  const plan = useMemo(
    () => planBatches(recipients.length, CONSERVATIVE_GAS_PER_RECIPIENT),
    [recipients.length],
  );

  const gasCost =
    gasPriceWei !== undefined ? estimateCostWei(plan.totalGasLimit, gasPriceWei) : undefined;

  const insufficient = balance !== undefined && total > balance;
  const canConfirm = acknowledged && !insufficient && recipients.length > 0 && !isConfirming;

  const preview = recipients.slice(0, 5);
  const remaining = recipients.length - preview.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {name || "Untitled distribution"}
          </h2>
          <p className="text-sm text-muted-foreground">Review everything before sending.</p>
        </div>
        {onEdit ? (
          <Button variant="ghost" size="sm" onClick={onEdit} disabled={isConfirming}>
            <Pencil />
            Edit
          </Button>
        ) : null}
      </div>

      {/* Summary */}
      <dl className="grid gap-3 rounded-lg border border-border p-5 text-sm">
        <Row label="Token">
          <span className="font-medium">{token.symbol}</span>
          {token.address ? (
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              {truncateAddress(token.address)}
            </span>
          ) : null}
        </Row>

        <Row label="Recipients">
          <span className="font-mono tabular-nums">{recipients.length.toLocaleString()}</span>
        </Row>

        <Row label="Total">
          <div className="flex flex-col items-end">
            <span className="font-mono tabular-nums">
              {formatAmountWithSymbol(total, token.decimals, token.symbol)}
            </span>
            {/* Both representations, always. Human-vs-base ambiguity is the
                highest-probability money bug in this product. */}
            <span className="font-mono text-xs text-muted-foreground">
              {total.toString()} base units
            </span>
          </div>
        </Row>

        <Row label="Schedule">
          <ScheduleValue schedule={schedule} />
        </Row>

        <Row label="Estimated gas">
          <div className="flex flex-col items-end">
            <span className="font-mono tabular-nums">
              {plan.totalGasLimit.toLocaleString()} gas
            </span>
            <span className="text-xs text-muted-foreground">
              {plan.batchCount === 1 ? "1 transaction" : `${plan.batchCount} transactions to sign`}
              {gasCost !== undefined ? ` · ~${formatAmount(gasCost, 18)} MON` : ""}
            </span>
          </div>
        </Row>

        {balance !== undefined ? (
          <Row label="Your balance">
            <span
              className={`font-mono tabular-nums ${insufficient ? "text-destructive" : "text-muted-foreground"}`}
            >
              {formatAmountWithSymbol(balance, token.decimals, token.symbol)}
            </span>
          </Row>
        ) : null}
      </dl>

      {insufficient && balance !== undefined ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive-surface px-4 py-3 text-sm text-destructive">
          Insufficient balance — short by{" "}
          {formatAmountWithSymbol(total - balance, token.decimals, token.symbol)}.
        </p>
      ) : null}

      {/* Recipient preview */}
      <div className="rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Recipient</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((r) => (
              <tr key={`${r.address}-${r.line}`} className="border-t border-border">
                <td className="px-4 py-2 font-mono text-xs" title={r.address}>
                  {truncateAddress(r.address, 6)}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {formatAmountWithSymbol(r.amount, token.decimals, token.symbol)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {remaining > 0 ? (
          <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            and {remaining.toLocaleString()} more
          </p>
        ) : null}
      </div>

      {/* The irreversibility gate — plain words, not fine print. */}
      <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive-surface p-4">
        <p className="flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Distributing is irreversible. Tokens sent to a wrong address cannot be recovered.
          </span>
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            disabled={isConfirming}
            className="size-4 accent-current"
          />
          I&apos;ve reviewed the recipients and amounts.
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={isConfirming}>
            Cancel
          </Button>
        ) : null}
        <Button onClick={onConfirm} disabled={!canConfirm}>
          {isConfirming
            ? "Saving…"
            : (confirmLabel ??
              (schedule.mode === "now" ? "Distribute now" : "Schedule distribution"))}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function ScheduleValue({ schedule }: { schedule: ScheduleDraft }) {
  if (schedule.mode === "now" || schedule.executeAt === undefined) {
    return <span>Immediately, when you approve</span>;
  }
  // Local + an explicit UTC echo, always. Payroll scheduled across timezones is
  // the normal case, and "9:00" without a zone lands a run on the wrong day.
  const { local, utc } = formatScheduleForDisplay(schedule.executeAt);
  return (
    <div className="flex flex-col items-end">
      <span>{local}</span>
      <span className="font-mono text-xs text-muted-foreground">{utc}</span>
    </div>
  );
}
