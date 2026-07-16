/**
 * Gas estimation for a distribution.
 *
 * Every constant here is **measured**, not assumed — see
 * contracts/test/Multisend.fork.t.sol (Monad mainnet fork, 2026-07-16) and the
 * chain's own reported limits. Do not "improve" these by extrapolating from
 * Ethereum or from local runs; Monad measured at ~1.1x local for this workload,
 * not the ~4x its cold-access repricing implies.
 *
 * **Why accuracy matters more here than on Ethereum:** Monad charges on
 * `gas_limit`, not gas used. An inflated limit is money the user actually
 * loses, every single run — there is no refund of the unused portion.
 */

/** Monad charges `gas_limit * price`, so a padded limit is a real cost. */
export const MONAD_TX_GAS_LIMIT = 30_000_000n;
/** Context only — the per-transaction cap above is what bounds a batch. */
export const MONAD_BLOCK_GAS_LIMIT = 200_000_000n;

/** Measured: real USDC on a Monad mainnet fork. */
export const MEASURED_GAS_PER_RECIPIENT = 31_471n;

/**
 * Default for an unknown token.
 *
 * USDC is a reference point, not an upper bound: a token with more storage
 * reads (extra blocklist/pausable checks, hooks) costs more per transfer.
 * Sizing every batch off USDC's figure would produce batches that overflow the
 * 30M cap on a heavier token — the whole run reverts, and on Monad the caller
 * still paid for the limit. 2x is the safety factor.
 */
export const CONSERVATIVE_GAS_PER_RECIPIENT = 63_000n;

/** Measured: fixed cost of a `distribute` call, independent of recipient count. */
export const FIXED_OVERHEAD_GAS = 41_597n;

/** Mirrors Multisend.MIN_GAS_PER_TRANSFER — headroom required before each transfer. */
export const MIN_GAS_PER_TRANSFER = 100_000n;

/** Use 80% of the per-tx cap; the remainder absorbs estimation error. */
const SAFETY_NUMERATOR = 80n;
const SAFETY_DENOMINATOR = 100n;

/**
 * Gas limit to submit for a batch of `recipientCount`.
 *
 * The binding constraint is usually **not** total consumption. The contract
 * requires `MIN_GAS_PER_TRANSFER` to still be available *before* the final
 * transfer, and that floor (100k) exceeds a transfer's actual cost (~31k). So
 * the caller must carry headroom the last transfer never spends — unavoidable,
 * and the price of never mislabeling a starved transfer as a rejection.
 */
export function estimateGasLimit(
  recipientCount: number,
  gasPerRecipient: bigint = CONSERVATIVE_GAS_PER_RECIPIENT,
): bigint {
  if (recipientCount <= 0) return 0n;
  const n = BigInt(recipientCount);

  // What the call actually consumes.
  const consumed = FIXED_OVERHEAD_GAS + gasPerRecipient * n;
  // What must still be available when the last transfer's floor check runs.
  const floorRequirement = FIXED_OVERHEAD_GAS + gasPerRecipient * (n - 1n) + MIN_GAS_PER_TRANSFER;

  return consumed > floorRequirement ? consumed : floorRequirement;
}

/** Most recipients that fit one transaction under the 30M cap, with safety margin. */
export function maxRecipientsPerBatch(
  gasPerRecipient: bigint = CONSERVATIVE_GAS_PER_RECIPIENT,
): number {
  const budget = (MONAD_TX_GAS_LIMIT * SAFETY_NUMERATOR) / SAFETY_DENOMINATOR;
  const available = budget - FIXED_OVERHEAD_GAS - MIN_GAS_PER_TRANSFER;
  if (available <= 0n) return 0;
  // +1 because the floor requirement covers only the first n-1 transfers.
  return Number(available / gasPerRecipient) + 1;
}

export interface BatchPlan {
  /** Number of transactions the user will sign. */
  batchCount: number;
  /** Recipients per batch (last may be smaller). */
  batchSize: number;
  /** Gas limit for a full batch. */
  gasLimitPerBatch: bigint;
  /** Total gas limit across all batches — what the user pays for on Monad. */
  totalGasLimit: bigint;
}

/** Split a distribution into transactions that fit Monad's per-tx cap. */
export function planBatches(
  recipientCount: number,
  gasPerRecipient: bigint = CONSERVATIVE_GAS_PER_RECIPIENT,
): BatchPlan {
  if (recipientCount <= 0) {
    return { batchCount: 0, batchSize: 0, gasLimitPerBatch: 0n, totalGasLimit: 0n };
  }

  const batchSize = Math.min(recipientCount, maxRecipientsPerBatch(gasPerRecipient));
  const batchCount = Math.ceil(recipientCount / batchSize);

  const gasLimitPerBatch = estimateGasLimit(batchSize, gasPerRecipient);
  const lastBatchSize = recipientCount - batchSize * (batchCount - 1);
  const totalGasLimit =
    gasLimitPerBatch * BigInt(batchCount - 1) + estimateGasLimit(lastBatchSize, gasPerRecipient);

  return { batchCount, batchSize, gasLimitPerBatch, totalGasLimit };
}

/**
 * Cost in wei for a gas limit.
 * @dev Computed from the **limit**, not from gas used — on Monad the limit is
 * what's charged, so a receipt's `gasUsed` would understate what was paid.
 */
export function estimateCostWei(gasLimit: bigint, gasPriceWei: bigint): bigint {
  return gasLimit * gasPriceWei;
}
