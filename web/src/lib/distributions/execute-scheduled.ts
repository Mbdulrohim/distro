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
