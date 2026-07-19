import type { Config } from "wagmi";
import { writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { parseEventLogs, type Address } from "viem";
import { multisendNativeAbi } from "@/lib/contracts/multisend-native-abi";
import { encodePayload } from "@/lib/recipients/encode";
import type { PayloadEntry, Batch } from "@/lib/recipients/types";
import type { BatchResult, PaymentResult, ExecutionEvent } from "./execute";

/**
 * Native-MON distribution execution: batched `MultisendNative.distribute`,
 * no approve step (there's no ERC-20 allowance for a chain's native
 * currency — the batch's own total is sent as `msg.value`).
 *
 * Reuses `BatchResult`/`PaymentResult`/`ExecutionEvent` from the immediate
 * (Multisend) engine — the shapes are identical, and reusing them means
 * `ExecutePanel` and the `/results` persistence endpoint don't need a native
 * special case; only the write path (which contract, how much value) differs.
 */

export interface ExecuteNativeArgs {
  config: Config;
  chainId: number;
  multisendNative: Address;
  account: Address;
  /** Ordered recipients. Order is load-bearing — never sort. */
  entries: PayloadEntry[];
  /** Recipients per transaction. Derived from measured gas, not guessed. */
  batchSize: number;
}

/** Split into batches, preserving order exactly. Identical to the ERC-20
 * engine's — kept as a separate function only so this module has no
 * dependency direction issue importing from `./execute`. */
function planBatches(entries: PayloadEntry[], batchSize: number): Batch[] {
  if (batchSize < 1) throw new Error("batchSize must be >= 1");
  const batches: Batch[] = [];
  for (let i = 0; i < entries.length; i += batchSize) {
    const slice = entries.slice(i, i + batchSize);
    batches.push({ index: batches.length, entries: slice, payload: encodePayload(slice) });
  }
  return batches;
}

/**
 * Execute a native-MON distribution, yielding progress as it goes. Same
 * submitted-vs-confirmed discipline as the ERC-20 engine — a mining
 * transaction must never read as done.
 */
export async function* executeNativeDistribution(
  args: ExecuteNativeArgs,
): AsyncGenerator<ExecutionEvent, void, undefined> {
  const { config, chainId, multisendNative, entries, batchSize } = args;

  const batches = planBatches(entries, batchSize);
  const results: BatchResult[] = [];

  for (const batch of batches) {
    const batchTotal = batch.entries.reduce((sum, e) => sum + e.amount, 0n);

    yield { type: "batch:signing", batchIndex: batch.index, total: batches.length };

    let txHash;
    try {
      txHash = await writeContract(config, {
        chainId,
        address: multisendNative,
        abi: multisendNativeAbi,
        functionName: "distribute",
        args: [batch.payload],
        value: batchTotal,
      });
    } catch (error) {
      throw new Error(
        `Transaction rejected or failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    yield {
      type: "batch:submitted",
      batchIndex: batch.index,
      total: batches.length,
      txHash,
    };

    let receipt;
    try {
      console.log(`[MultisendNative] Waiting for receipt on chain ${chainId} for tx ${txHash}`);
      receipt = await waitForTransactionReceipt(config, {
        chainId,
        hash: txHash,
        timeout: 60_000, // 60 seconds to account for Monad block time
      });
      console.log(`[MultisendNative] Receipt received:`, {
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed?.toString(),
        status: receipt.status,
        logs: receipt.logs.length,
      });
    } catch (error) {
      console.error(`[MultisendNative] waitForTransactionReceipt failed:`, error);
      throw new Error(
        `Transaction confirmation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Check if transaction reverted
    if (receipt.status === "reverted") {
      throw new Error(`Transaction reverted on chain. Check the explorer for details: ${txHash}`);
    }

    let logs;
    try {
      logs = parseEventLogs({
        abi: multisendNativeAbi,
        logs: receipt.logs,
        eventName: ["Paid", "PaymentFailed"],
      });
    } catch (error) {
      throw new Error(
        `Could not parse transaction receipt: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

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
