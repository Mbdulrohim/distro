import type { Config } from "wagmi";
import { writeContract, waitForTransactionReceipt, readContract } from "wagmi/actions";
import { parseEventLogs, erc20Abi, type Hash, type Address } from "viem";
import { distributionFactoryAbi } from "@/lib/contracts/distribution-factory-abi";
import { distributionAbi } from "@/lib/contracts/distribution-abi";
import { planBatches } from "./execute";
import type { PayloadEntry } from "@/lib/recipients/types";

/**
 * Scheduled (escrow) distribution execution: create the clone -> commit every
 * chunk's recipients on-chain -> fund it, which is the moment `executeAfter`
 * (set at creation or via a prior `schedule()` call) becomes the enforced,
 * on-chain execution time. See contracts/src/Distribution.sol.
 *
 * Unlike `executeDistribution` (Multisend, immediate), this does not pay
 * anyone directly — it escrows the funds and commits the recipient list, so
 * that ANYONE can trigger `executeChunk` once `executeAfter` arrives, even if
 * the creator never comes back. Actually running the chunks after the
 * schedule fires is a separate, later step (`executeScheduledChunk`), not
 * part of this flow.
 */

export interface ScheduledCreateArgs {
  config: Config;
  chainId: number;
  factory: Address;
  /** `NATIVE_TOKEN` sentinel (address(0)) or an ERC-20 address. */
  token: Address;
  account: Address;
  /** Ordered recipients. Order is load-bearing — it's what gets committed
   * on-chain and later verified against at execution time. Never sort. */
  entries: PayloadEntry[];
  /** Unix seconds, or 0 for "no restriction — executable once funded". */
  executeAfter: number;
  /** Recipients per chunk. Same gas-derived sizing as the immediate path. */
  chunkSize: number;
  /** Client-supplied idempotency key for CREATE2 — a fresh random value per
   * distribution. A duplicate salt from the same creator reverts, which is
   * exactly the double-submit guard (see DistributionFactory.sol). */
  salt: `0x${string}`;
}

export type ScheduledCreateEvent =
  | { type: "create:signing" }
  | { type: "create:submitted"; txHash: Hash }
  | { type: "create:confirmed"; distribution: Address }
  | { type: "commit:signing"; chunkIndex: number; total: number }
  | { type: "commit:submitted"; chunkIndex: number; total: number; txHash: Hash }
  | { type: "commit:confirmed"; chunkIndex: number; total: number }
  | { type: "approve:required"; amount: bigint }
  | { type: "approve:signing" }
  | { type: "approve:submitted"; txHash: Hash }
  | { type: "approve:confirmed"; txHash: Hash }
  | { type: "approve:skipped"; reason: "already-approved" }
  | { type: "fund:signing" }
  | { type: "fund:submitted"; txHash: Hash }
  | { type: "fund:confirmed"; txHash: Hash }
  | { type: "done"; distribution: Address };

/** Sentinel matching `Distribution.NATIVE` — never a real ERC-20 address. */
export const NATIVE_TOKEN: Address = "0x0000000000000000000000000000000000000000";

/**
 * Create, commit, and fund a scheduled distribution — the on-chain
 * counterpart of "Schedule for later" in the create flow.
 *
 * Gated by the caller on `isDistributionFactoryDeployed`, same as every other
 * escrow entry point: this function itself does not check deployment, it
 * simply calls whatever `factory` address it's given, and a factory that
 * doesn't exist fails the first transaction rather than silently no-op-ing.
 */
export async function* createScheduledDistribution(
  args: ScheduledCreateArgs,
): AsyncGenerator<ScheduledCreateEvent, void, undefined> {
  const { config, chainId, factory, token, account, entries, executeAfter, chunkSize, salt } = args;

  const chunks = planBatches(entries, chunkSize);
  const isNative = token.toLowerCase() === NATIVE_TOKEN.toLowerCase();

  // --- Create the clone ---------------------------------------------------
  yield { type: "create:signing" };
  const createTx = await writeContract(config, {
    chainId,
    address: factory,
    abi: distributionFactoryAbi,
    functionName: "createDistribution",
    args: [token, BigInt(executeAfter), chunks.length, salt],
  });
  yield { type: "create:submitted", txHash: createTx };
  const createReceipt = await waitForTransactionReceipt(config, { chainId, hash: createTx });

  const createdLogs = parseEventLogs({
    abi: distributionFactoryAbi,
    logs: createReceipt.logs,
    eventName: "DistributionCreated",
  });
  const distribution = createdLogs[0]?.args.distribution as Address | undefined;
  if (!distribution) {
    throw new Error("DistributionCreated event not found — the escrow may not have been created.");
  }
  yield { type: "create:confirmed", distribution };

  // --- Commit every chunk's recipients onchain ----------------------------
  // This is the data-availability guarantee (Distribution.sol's own docs):
  // without this, only Distro's database would know the recipient list, and
  // "anyone can execute" would be false in practice.
  for (const chunk of chunks) {
    yield { type: "commit:signing", chunkIndex: chunk.index, total: chunks.length };
    const commitTx = await writeContract(config, {
      chainId,
      address: distribution,
      abi: distributionAbi,
      functionName: "commitChunk",
      args: [BigInt(chunk.index), chunk.payload],
    });
    yield {
      type: "commit:submitted",
      chunkIndex: chunk.index,
      total: chunks.length,
      txHash: commitTx,
    };
    await waitForTransactionReceipt(config, { chainId, hash: commitTx });
    yield { type: "commit:confirmed", chunkIndex: chunk.index, total: chunks.length };
  }

  // --- Fund ----------------------------------------------------------------
  const total = entries.reduce((sum, e) => sum + e.amount, 0n);

  if (isNative) {
    // Native MON: msg.value IS the escrow. No allowance step.
    yield { type: "fund:signing" };
    const fundTx = await writeContract(config, {
      chainId,
      address: distribution,
      abi: distributionAbi,
      functionName: "fund",
      value: total,
    });
    yield { type: "fund:submitted", txHash: fundTx };
    await waitForTransactionReceipt(config, { chainId, hash: fundTx });
    yield { type: "fund:confirmed", txHash: fundTx };
  } else {
    const allowance = await readContract(config, {
      chainId,
      address: token,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account, distribution],
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
        args: [distribution, total],
      });
      yield { type: "approve:submitted", txHash: approveTx };
      await waitForTransactionReceipt(config, { chainId, hash: approveTx });
      yield { type: "approve:confirmed", txHash: approveTx };
    }

    yield { type: "fund:signing" };
    const fundTx = await writeContract(config, {
      chainId,
      address: distribution,
      abi: distributionAbi,
      functionName: "fund",
    });
    yield { type: "fund:submitted", txHash: fundTx };
    await waitForTransactionReceipt(config, { chainId, hash: fundTx });
    yield { type: "fund:confirmed", txHash: fundTx };
  }

  yield { type: "done", distribution };
}

/** The escrow address `createScheduledDistribution` would produce — before it exists. */
export async function predictScheduledAddress(
  config: Config,
  chainId: number,
  factory: Address,
  account: Address,
  salt: `0x${string}`,
): Promise<Address> {
  return readContract(config, {
    chainId,
    address: factory,
    abi: distributionFactoryAbi,
    functionName: "predictAddress",
    args: [account, salt],
  });
}

/**
 * Running an already-scheduled distribution: `executeChunk` per chunk not
 * yet executed, once `executeAfter` has arrived. Permissionless on-chain —
 * this function itself doesn't check who's calling, that's the contract's
 * job — but today it's only reachable from the creator's own detail page
 * (see docs on ScheduledExecutePanel's sibling component). True third-party
 * execution needs a public, unauthenticated route, which doesn't exist yet;
 * this closes the "does it run at all" gap first.
 */

export interface ExecuteScheduledChunk {
  index: number;
  payload: `0x${string}`;
}

/** One recipient's on-chain outcome for a chunk, decoded from the receipt —
 * same shape `/api/distributions/[id]/results` already expects. */
export interface ScheduledPaymentResult {
  recipient: Address;
  amount: bigint;
  /** Position within the chunk — maps to `recipients.index_in_batch`. */
  index: number;
  status: "paid" | "failed";
}

export interface ScheduledChunkResult {
  chunkIndex: number;
  txHash: Hash;
  blockNumber: bigint;
  gasUsed: bigint;
  payments: ScheduledPaymentResult[];
  paidCount: number;
  failedCount: number;
}

export type ExecuteScheduledEvent =
  | { type: "chunk:skipped-already-executed"; chunkIndex: number }
  | { type: "chunk:too-early"; executeAfter: number }
  | { type: "chunk:signing"; chunkIndex: number; total: number }
  | { type: "chunk:submitted"; chunkIndex: number; total: number; txHash: Hash }
  | { type: "chunk:confirmed"; result: ScheduledChunkResult }
  | { type: "done"; results: ScheduledChunkResult[] };

/**
 * Execute every not-yet-executed chunk of a funded, scheduled distribution.
 *
 * Reads `chunkExecuted` on-chain before attempting each one, so calling this
 * again after a partial run (or after someone else already ran a chunk)
 * safely resumes rather than reverting on `ChunkAlreadyExecuted`.
 */
export async function* executeScheduledDistribution(args: {
  config: Config;
  chainId: number;
  distribution: Address;
  chunks: ExecuteScheduledChunk[];
}): AsyncGenerator<ExecuteScheduledEvent, void, undefined> {
  const { config, chainId, distribution, chunks } = args;
  const results: ScheduledChunkResult[] = [];

  const executeAfter = await readContract(config, {
    chainId,
    address: distribution,
    abi: distributionAbi,
    functionName: "executeAfter",
  });
  if (Date.now() / 1000 < Number(executeAfter)) {
    yield { type: "chunk:too-early", executeAfter: Number(executeAfter) };
    return;
  }

  for (const chunk of chunks) {
    const alreadyExecuted = await readContract(config, {
      chainId,
      address: distribution,
      abi: distributionAbi,
      functionName: "chunkExecuted",
      args: [BigInt(chunk.index)],
    });
    if (alreadyExecuted) {
      yield { type: "chunk:skipped-already-executed", chunkIndex: chunk.index };
      continue;
    }

    yield { type: "chunk:signing", chunkIndex: chunk.index, total: chunks.length };
    const txHash = await writeContract(config, {
      chainId,
      address: distribution,
      abi: distributionAbi,
      functionName: "executeChunk",
      args: [BigInt(chunk.index), chunk.payload],
    });
    yield { type: "chunk:submitted", chunkIndex: chunk.index, total: chunks.length, txHash };

    const receipt = await waitForTransactionReceipt(config, { chainId, hash: txHash });

    // The receipt is the source of truth — decode both outcomes rather than
    // assume success, exactly as the immediate (Multisend) path does. One
    // blocklisted recipient must not read as the whole chunk failing.
    const logs = parseEventLogs({
      abi: distributionAbi,
      logs: receipt.logs,
      eventName: ["Paid", "PaymentFailed"],
    });

    const payments: ScheduledPaymentResult[] = logs.map((log) => ({
      recipient: log.args.recipient as Address,
      amount: log.args.amount as bigint,
      index: Number(log.args.position as bigint),
      status: log.eventName === "Paid" ? "paid" : "failed",
    }));

    const result: ScheduledChunkResult = {
      chunkIndex: chunk.index,
      txHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      payments,
      paidCount: payments.filter((p) => p.status === "paid").length,
      failedCount: payments.filter((p) => p.status === "failed").length,
    };
    results.push(result);
    yield { type: "chunk:confirmed", result };
  }

  yield { type: "done", results };
}
