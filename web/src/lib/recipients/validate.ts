import { getAddress, isAddress, parseUnits } from "viem";
import type {
  RawRecipient,
  RecipientError,
  ValidRecipient,
  DuplicateWarning,
  ValidationResult,
} from "./types";

/**
 * Maximum a single payment can be: the payload encodes amount as `uint128`
 * (see encode.ts and Multisend.sol). A value above this is rejected here, at
 * import, rather than surfacing as a revert after the user has committed.
 */
export const MAX_AMOUNT = 2n ** 128n - 1n;

/**
 * Validate raw rows against a token's decimals. Pure and synchronous — the
 * authoritative copy runs server-side, but the identical function runs in the
 * browser for instant feedback.
 *
 * Per-row failures become blocking `errors`. Duplicate addresses are surfaced
 * as non-blocking `duplicates` — paying the same address twice is legal by
 * design ([FEATURES.md]); the UI warns, it does not forbid.
 *
 * Balance-vs-total is intentionally NOT checked here: balance is chain state
 * that changes, so the caller compares `result.total` against a freshly-read
 * balance at review and again before signing.
 */
export function validateRecipients(rows: RawRecipient[], decimals: number): ValidationResult {
  const valid: ValidRecipient[] = [];
  const errors: RecipientError[] = [];
  let total = 0n;

  for (const row of rows) {
    if (row.addressInput === "" || row.amountInput === "") {
      errors.push({
        line: row.line,
        code: "missing-fields",
        message: "Each row needs both an address and an amount.",
      });
      continue;
    }

    if (!isAddress(row.addressInput, { strict: false })) {
      errors.push({
        line: row.line,
        code: "invalid-address",
        message: `Not a valid address: ${row.addressInput}`,
      });
      continue;
    }

    let amount: bigint;
    try {
      amount = parseUnits(row.amountInput, decimals);
    } catch {
      errors.push({
        line: row.line,
        code: "invalid-amount",
        message: `Not a valid amount: ${row.amountInput}`,
      });
      continue;
    }

    if (amount <= 0n) {
      errors.push({
        line: row.line,
        code: "zero-amount",
        message: "Amount must be greater than zero.",
      });
      continue;
    }

    if (amount > MAX_AMOUNT) {
      errors.push({
        line: row.line,
        code: "amount-too-large",
        message: "Amount exceeds the maximum a single payment can hold.",
      });
      continue;
    }

    valid.push({
      line: row.line,
      address: getAddress(row.addressInput),
      amount,
      amountInput: row.amountInput,
    });
    total += amount;
  }

  return {
    valid,
    errors,
    duplicates: findDuplicates(valid),
    total,
    ok: errors.length === 0 && valid.length > 0,
  };
}

function findDuplicates(valid: ValidRecipient[]): DuplicateWarning[] {
  const byAddress = new Map<string, number[]>();
  for (const r of valid) {
    const lines = byAddress.get(r.address) ?? [];
    lines.push(r.line);
    byAddress.set(r.address, lines);
  }
  const dupes: DuplicateWarning[] = [];
  for (const [address, lines] of byAddress) {
    if (lines.length > 1) dupes.push({ address: address as `0x${string}`, lines });
  }
  return dupes;
}
