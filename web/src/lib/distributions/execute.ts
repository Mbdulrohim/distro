import type { Config } from "wagmi";
import { writeContract, waitForTransactionReceipt, readContract } from "wagmi/actions";
import { parseEventLogs, erc20Abi, type Hash, type Address } from "viem";
import { multisendAbi } from "@/lib/contracts/multisend-abi";
import { encodePayload } from "@/lib/recipients/encode";
import type { PayloadEntry, Batch } from "@/lib/recipients/types";

/**
 * Distribution execution: approve → distribute (batched) → read results from
 * the receipt.
 *
 * **No indexer.** The execution transaction's own receipt contains every
 * `Paid` / `PaymentFailed` event, so results are known the instant a batch
 * confirms. That single fact is why the MVP needs no long-running service —
 * see docs/ARCHITECTURE.md.
 *
 * The caller is present and signing throughout, so this is deliberately a
 * plain async generator of progress events rather than a job queue.
 */

/** One recipient's on-chain outcome, decoded from the receipt. */
export interface PaymentResult {
  recipient: Address;
  amount: bigint;
  /** Index within the batch payload — maps back to `recipients.index_in_batch`. */
  index: number;
  status: "paid" | "failed";
}

export interface BatchResult {
  batchIndex: number;
  txHash: Hash;
  blockNumber: bigint;
  gasUsed: bigint;
  payments: PaymentResult[];
  totalPaid: bigint;
  paidCount: number;
  failedCount: number;
}

export type ExecutionEvent =
  | { type: "approve:required"; amount: bigint }
  | { type: "approve:signing" }
  | { type: "approve:submitted"; txHash: Hash }
  | { type: "approve:confirmed"; txHash: Hash }
  | { type: "approve:skipped"; reason: "already-approved" }
  | { type: "batch:signing"; batchIndex: number; total: number }
  | { type: "batch:submitted"; batchIndex: number; total: number; txHash: Hash }
  | { type: "batch:confirmed"; result: BatchResult }
  | { type: "done"; results: BatchResult[] };

export interface ExecuteArgs {
  config: Config;
  chainId: number;
  multisend: Address;
  token: Address;
  account: Address;
  /** Ordered recipients. Order is load-bearing — never sort. */
  entries: PayloadEntry[];
  /** Recipients per transaction. Derived from measured gas, not guessed. */
  batchSize: number;
}

/** Split into batches, preserving order exactly. */
export function planBatches(entries: PayloadEntry[], batchSize: number): Batch[] {
  if (batchSize < 1) throw new Error("batchSize must be >= 1");
  const batches: Batch[] = [];
  for (let i = 0; i < entries.length; i += batchSize) {
    const slice = entries.slice(i, i + batchSize);
    batches.push({
      index: batches.length,
      entries: slice,
      payload: encodePayload(slice),
    });
  }
  return batches;
}

/** Sum of all amounts — what must be approved. */
export function totalOf(entries: PayloadEntry[]): bigint {
  return entries.reduce((sum, e) => sum + e.amount, 0n);
}

/**
 * Execute a distribution, yielding progress as it goes.
 *
 * Yields rather than returning at the end so the UI can distinguish
 * *submitted* from *confirmed* — a mining transaction must never read as
 * done, or the user assumes failure and double-sends.
 */
export async function* executeDistribution(
  args: ExecuteArgs,
): AsyncGenerator<ExecutionEvent, void, undefined> {
  const { config, chainId, multisend, token, account, entries, batchSize } = args;

  const total = totalOf(entries);
  const batches = planBatches(entries, batchSize);

  // --- Approve -----------------------------------------------------------
  // Only approve the exact total, and only if the existing allowance is
  // short. An unlimited approval would leave a standing claim on the user's
  // balance long after the distribution is done.
  const allowance = await readContract(config, {
    chainId,
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account, multisend],
  });

  if (allowance >= total) {
    yield { type: "approve:skipped", reason: "already-approved" };
  } else {
    yield { type: "approve:required", amount: total };
    yield { type: "approve:signing" };
    const approveTx = await writeContract(config, {
      chainId,
      address: token,
      abi: erc20Abi,
      functionName: "approve",
      args: [multisend, total],
    });
    yield { type: "approve:submitted", txHash: approveTx };
    await waitForTransactionReceipt(config, { chainId, hash: approveTx });
    yield { type: "approve:confirmed", txHash: approveTx };
  }

  // --- Distribute --------------------------------------------------------
  const results: BatchResult[] = [];

  for (const batch of batches) {
    yield { type: "batch:signing", batchIndex: batch.index, total: batches.length };

    const txHash = await writeContract(config, {
      chainId,
      address: multisend,
      abi: multisendAbi,
      functionName: "distribute",
      args: [token, batch.payload],
    });

    yield {
      type: "batch:submitted",
      batchIndex: batch.index,
      total: batches.length,
      txHash,
    };

    const receipt = await waitForTransactionReceipt(config, { chainId, hash: txHash });

    // The receipt IS the source of truth. Decode both event types rather than
    // assuming success — per-recipient failure is a routine outcome here, not
    // an exception (one blocklisted address must not fail a payroll).
    const logs = parseEventLogs({
      abi: multisendAbi,
      logs: receipt.logs,
      eventName: ["Paid", "PaymentFailed"],
    });

    const payments: PaymentResult[] = logs.map((log) => ({
      recipient: log.args.recipient as Address,
      amount: log.args.amount as bigint,
      index: Number(log.args.index as bigint),
      status: log.eventName === "Paid" ? "paid" : "failed",
    }));

    const paid = payments.filter((p) => p.status === "paid");

    const result: BatchResult = {
      batchIndex: batch.index,
      txHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      payments,
      totalPaid: paid.reduce((s, p) => s + p.amount, 0n),
      paidCount: paid.length,
      failedCount: payments.length - paid.length,
    };

    results.push(result);
    yield { type: "batch:confirmed", result };
  }

  yield { type: "done", results };
}
