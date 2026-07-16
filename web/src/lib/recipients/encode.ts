import { encodePacked, concat } from "viem";
import type { PayloadEntry, Batch } from "./types";

/**
 * Canonical payload encoding — MUST stay byte-identical to `Multisend`'s
 * on-chain decoder (contracts/src/Multisend.sol). A single-byte divergence
 * produces a payload the contract silently misreads, so this is verified by a
 * shared fixture in both the vitest suite here and the Foundry suite there.
 *
 * One entry = `abi.encodePacked(address recipient, uint128 amount)` = 36 bytes
 * (20-byte address ‖ 16-byte big-endian amount). The payload is entries
 * concatenated, in order — order is load-bearing (it's how a `Paid` event's
 * `index` maps back to a recipient).
 */

const MAX_UINT128 = 2n ** 128n - 1n;

export function encodeEntry(entry: PayloadEntry): `0x${string}` {
  if (entry.amount < 0n || entry.amount > MAX_UINT128) {
    throw new Error(`amount out of uint128 range for ${entry.address}`);
  }
  return encodePacked(["address", "uint128"], [entry.address, entry.amount]);
}

export function encodePayload(entries: PayloadEntry[]): `0x${string}` {
  if (entries.length === 0) throw new Error("cannot encode an empty payload");
  return concat(entries.map(encodeEntry));
}

/**
 * Split entries into batches, each a single `distribute` transaction. Order is
 * preserved across the flattened batches. `maxPerBatch` is derived from the
 * measured per-transfer gas (F3) and a target gas budget per transaction — it
 * is a caller input, never a guessed constant here.
 */
export function splitIntoBatches(entries: PayloadEntry[], maxPerBatch: number): Batch[] {
  if (maxPerBatch < 1) throw new Error("maxPerBatch must be at least 1");
  const batches: Batch[] = [];
  for (let i = 0; i < entries.length; i += maxPerBatch) {
    const slice = entries.slice(i, i + maxPerBatch);
    batches.push({
      index: batches.length,
      entries: slice,
      payload: encodePayload(slice),
    });
  }
  return batches;
}
