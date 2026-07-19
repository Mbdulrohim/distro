import "server-only";

import {
  createPublicClient,
  getAddress,
  http,
  parseEventLogs,
  type Address,
  type Hash,
} from "viem";
import { supportedChains } from "@/config/chains";
import { distributionAbi } from "@/lib/contracts/distribution-abi";
import { distributionFactoryAbi } from "@/lib/contracts/distribution-factory-abi";
import { multisendAbi } from "@/lib/contracts/multisend-abi";
import { multisendNativeAbi } from "@/lib/contracts/multisend-native-abi";

export interface VerifiedPayment {
  recipient: string;
  amount: string;
  index: number;
  status: "paid" | "failed";
}

function clientFor(chainId: number) {
  const chain = supportedChains.find((candidate) => candidate.id === chainId);
  if (!chain) throw new Error("Unsupported chain.");
  return createPublicClient({ chain, transport: http() });
}

/** Fetch and decode a mined distribution receipt. Client-provided event data is never trusted. */
export async function verifyDistributionReceipt(args: {
  chainId: number;
  txHash: Hash;
  contract: Address;
  kind: "immediate-erc20" | "immediate-native" | "scheduled";
  batchIndex: number;
}): Promise<{ blockNumber: string; gasUsed: string; payments: VerifiedPayment[] }> {
  const client = clientFor(args.chainId);
  console.log(`[verifyDistributionReceipt] Fetching transaction and receipt for ${args.txHash}`);
  const [transaction, receipt] = await Promise.all([
    client.getTransaction({ hash: args.txHash }),
    client.getTransactionReceipt({ hash: args.txHash }),
  ]);

  console.log(`[verifyDistributionReceipt] Retrieved receipt:`, {
    status: receipt.status,
    blockNumber: receipt.blockNumber,
    logCount: receipt.logs.length,
    txTo: transaction.to,
    expectedContract: args.contract,
  });

  if (
    receipt.status !== "success" ||
    !transaction.to ||
    getAddress(transaction.to) !== getAddress(args.contract)
  ) {
    throw new Error(
      `Transaction was not a successful call to this distribution contract. Status: ${receipt.status}, TX to: ${transaction.to}, expected: ${args.contract}`,
    );
  }

  const logs = receipt.logs.filter((log) => getAddress(log.address) === getAddress(args.contract));
  console.log(
    `[verifyDistributionReceipt] Filtered to ${logs.length} logs from contract ${args.contract}`,
  );

  const abi =
    args.kind === "scheduled"
      ? distributionAbi
      : args.kind === "immediate-native"
        ? multisendNativeAbi
        : multisendAbi;
  const decoded = parseEventLogs({ abi, logs, eventName: ["Paid", "PaymentFailed"] });
  console.log(`[verifyDistributionReceipt] Decoded ${decoded.length} events:`, decoded);

  const payments = decoded.map((log) => {
    const status = log.eventName === "Paid" ? ("paid" as const) : ("failed" as const);

    // `decoded` is typed as a union across all three ABIs' event shapes since
    // `abi` itself was chosen at runtime — narrow explicitly per `args.kind`
    // rather than reaching into `.args` on the unnarrowed union.
    if (args.kind === "scheduled") {
      const a = log.args as {
        recipient: Address;
        amount: bigint;
        chunkIndex: bigint;
        position: bigint;
      };
      if (Number(a.chunkIndex) !== args.batchIndex) {
        throw new Error("Receipt contains an event for a different chunk.");
      }
      return {
        recipient: getAddress(a.recipient),
        amount: a.amount.toString(),
        index: Number(a.position),
        status,
      };
    }

    const a = log.args as { recipient: Address; amount: bigint; index: bigint };
    return {
      recipient: getAddress(a.recipient),
      amount: a.amount.toString(),
      index: Number(a.index),
      status,
    };
  });

  if (payments.length === 0) throw new Error("No payment events found in transaction receipt.");
  return {
    blockNumber: receipt.blockNumber.toString(),
    gasUsed: receipt.gasUsed.toString(),
    payments,
  };
}

/** Confirm a recorded scheduled escrow is the deterministic clone for this creator and salt. */
export async function verifyEscrowAddress(args: {
  chainId: number;
  factory: Address;
  creator: Address;
  salt: `0x${string}`;
  escrow: Address;
}): Promise<void> {
  const predicted = await clientFor(args.chainId).readContract({
    address: args.factory,
    abi: distributionFactoryAbi,
    functionName: "predictAddress",
    args: [args.creator, args.salt],
  });
  if (getAddress(predicted) !== getAddress(args.escrow)) {
    throw new Error("Escrow address does not match the factory prediction.");
  }
  const bytecode = await clientFor(args.chainId).getBytecode({ address: args.escrow });
  if (!bytecode || bytecode === "0x") throw new Error("Predicted escrow has not been deployed.");
}
