"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Plus, Trash2, AlertTriangle, Users, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseRecipients } from "@/lib/recipients/parse";
import { validateRecipients } from "@/lib/recipients/validate";
import { mergeDuplicates } from "@/lib/recipients/merge";
import { formatAmount, formatAmountWithSymbol } from "@/lib/recipients/format";
import type { ValidRecipient, ValidationResult } from "@/lib/recipients/types";

/**
 * Recipient management for the distribution engine. Three entry paths — CSV
 * upload, bulk paste, and manual single-row entry — all feed one editable list
 * that is validated live against the chosen token's decimals.
 *
 * Emits validated recipients + total to the parent (the create flow), which
 * encodes and batches them (lib/recipients/encode.ts) for execution.
 *
 * Duplicates are surfaced, not blocked: paying an address twice is legal by
 * design, so this offers an explicit "merge" rather than forbidding it.
 *
 * NOTE: renders one editable row per recipient. Fine at payroll scale
 * (hundreds); virtualization for very large lists lands with the shared
 * recipient table (F9). Client validation here is UX — the server re-validates
 * authoritatively on submit (F6).
 */

interface EditableRow {
  id: string;
  address: string;
  amount: string;
}

export interface RecipientManagerValue {
  valid: ValidRecipient[];
  total: bigint;
  ok: boolean;
}

interface RecipientManagerProps {
  /** Decimals of the selected token — drives human↔base conversion. */
  decimals: number;
  /** Symbol for display (e.g. "USDC"). */
  tokenSymbol: string;
  /** Creator's on-chain balance, base units, if known — enables the covers check. */
  balance?: bigint;
  /** Called whenever the validated set changes. */
  onChange?: (value: RecipientManagerValue) => void;
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export function RecipientManager({
  decimals,
  tokenSymbol,
  balance,
  onChange,
}: RecipientManagerProps) {
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate live. Row position (1-based) is the "line" so errors map to rows.
  const result: ValidationResult = useMemo(
    () =>
      validateRecipients(
        rows.map((row, i) => ({
          line: i + 1,
          addressInput: row.address,
          amountInput: row.amount,
        })),
        decimals,
      ),
    [rows, decimals],
  );

  const errorByLine = useMemo(() => {
    const map = new Map<number, string>();
    for (const e of result.errors) if (!map.has(e.line)) map.set(e.line, e.message);
    return map;
  }, [result.errors]);

  const coversBalance = balance === undefined ? undefined : result.total <= balance;

  useEffect(() => {
    onChange?.({ valid: result.valid, total: result.total, ok: result.ok });
  }, [result, onChange]);

  function appendRaw(text: string) {
    const parsed = parseRecipients(text);
    if (parsed.length === 0) return;
    setRows((prev) => [
      ...prev,
      ...parsed.map((r) => ({ id: newId(), address: r.addressInput, amount: r.amountInput })),
    ]);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    appendRaw(await file.text());
    e.target.value = "";
  }

  function onAddPasted() {
    appendRaw(pasteText);
    setPasteText("");
  }

  function onAddManual() {
    if (manualAddress.trim() === "" && manualAmount.trim() === "") return;
    setRows((prev) => [
      ...prev,
      { id: newId(), address: manualAddress.trim(), amount: manualAmount.trim() },
    ]);
    setManualAddress("");
    setManualAmount("");
  }

  function updateRow(id: string, patch: Partial<EditableRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function onMergeDuplicates() {
    const merged = mergeDuplicates(result.valid);
    setRows(
      merged.map((r) => ({
        id: newId(),
        address: r.address,
        amount: formatAmount(r.amount, decimals),
      })),
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Import controls */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            onChange={onFile}
            className="hidden"
          />
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload />
            Upload CSV
          </Button>
          <span className="text-xs text-muted-foreground">
            Format: <code className="font-mono">address,amount</code> — one per line.
          </span>
        </div>

        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={"Paste a list:\n0x1234…,100\n0xabcd…,250"}
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {pasteText.trim() !== "" ? (
          <div>
            <Button variant="secondary" size="sm" onClick={onAddPasted}>
              Add pasted rows
            </Button>
          </div>
        ) : null}

        {/* Manual entry */}
        <div className="flex flex-wrap items-end gap-2">
          <input
            value={manualAddress}
            onChange={(e) => setManualAddress(e.target.value)}
            placeholder="0x… address"
            className="h-9 min-w-64 flex-1 rounded-md border border-border bg-background px-3 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <input
            value={manualAmount}
            onChange={(e) => setManualAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAddManual()}
            placeholder="amount"
            inputMode="decimal"
            className="h-9 w-32 rounded-md border border-border bg-background px-3 text-right font-mono text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Button variant="secondary" size="sm" onClick={onAddManual}>
            <Plus />
            Add
          </Button>
        </div>
      </div>

      {/* Summary */}
      {rows.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border px-4 py-3 text-sm">
          <span className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <span className="font-mono tabular-nums">{result.valid.length}</span>
            <span className="text-muted-foreground">recipients</span>
          </span>
          <span className="flex items-center gap-2">
            <Coins className="size-4 text-muted-foreground" />
            <span className="font-mono tabular-nums">
              {formatAmountWithSymbol(result.total, decimals, tokenSymbol)}
            </span>
          </span>
          {coversBalance === false ? (
            <span className="text-destructive">Exceeds your balance</span>
          ) : coversBalance === true ? (
            <span className="text-muted-foreground">Covered by your balance</span>
          ) : null}
          {result.errors.length > 0 ? (
            <span className="text-destructive">
              {result.errors.length} error{result.errors.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Duplicate warning (never blocking) */}
      {result.duplicates.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <AlertTriangle className="size-4 shrink-0" />
            {result.duplicates.length} address
            {result.duplicates.length === 1 ? "" : "es"} appear more than once — each will be paid
            every time it appears.
          </span>
          <Button variant="secondary" size="sm" onClick={onMergeDuplicates} disabled={!result.ok}>
            Merge duplicates
          </Button>
        </div>
      ) : null}

      {/* Editable rows */}
      {rows.length > 0 ? (
        <div className="max-h-96 overflow-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-muted text-left">
              <tr className="text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Address</th>
                <th className="w-40 px-4 py-2 text-right font-medium">Amount</th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const error = errorByLine.get(i + 1);
                return (
                  <tr key={row.id} className="border-t border-border align-top">
                    <td className="px-4 py-1.5">
                      <input
                        value={row.address}
                        onChange={(e) => updateRow(row.id, { address: e.target.value })}
                        aria-invalid={Boolean(error)}
                        className="w-full bg-transparent font-mono text-sm outline-none aria-invalid:text-destructive"
                      />
                      {error ? <p className="mt-0.5 text-xs text-destructive">{error}</p> : null}
                    </td>
                    <td className="px-4 py-1.5 text-right">
                      <input
                        value={row.amount}
                        onChange={(e) => updateRow(row.id, { amount: e.target.value })}
                        inputMode="decimal"
                        aria-invalid={Boolean(error)}
                        className="w-full bg-transparent text-right font-mono text-sm tabular-nums outline-none aria-invalid:text-destructive"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        onClick={() => removeRow(row.id)}
                        aria-label="Remove recipient"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No recipients yet. Upload a CSV, paste a list, or add one manually.
        </p>
      )}
    </div>
  );
}
