import type { ValidRecipient } from "./types";

/**
 * Merge duplicate addresses by summing their amounts, preserving first-seen
 * order and the first occurrence's line number.
 *
 * This is the reconciliation of a design tension: paying one address twice is
 * legal by design (FEATURES.md — retry is keyed by position, not address), so
 * duplicates are never hard-blocked. But an *accidental* duplicate is a
 * double-pay waiting to happen. So the pipeline warns, and offers this merge
 * as an explicit, opt-in action — never automatic.
 */
export function mergeDuplicates(valid: ValidRecipient[]): ValidRecipient[] {
  const byAddress = new Map<string, ValidRecipient>();
  for (const r of valid) {
    const existing = byAddress.get(r.address);
    byAddress.set(r.address, existing ? { ...existing, amount: existing.amount + r.amount } : r);
  }
  return [...byAddress.values()];
}
