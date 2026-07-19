import "server-only";
import { db } from "./client";

export interface DistributionDetail {
  id: string;
  name: string;
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  multisendAddress: string | null;
  totalAmount: string;
  recipientCount: number;
  status: string;
  createdAt: string;
  submittedAt: string | null;
  completedAt: string | null;
  kind: "immediate" | "scheduled";
  escrowAddress: string | null;
  executeAfter: number | null;
}

export interface RecipientRow {
  id: string;
  batchIndex: number;
  indexInBatch: number;
  address: string;
  amount: string;
  status: "pending" | "paid" | "failed";
  failureReason: string | null;
  paidAt: string | null;
  txHash: string | null;
}

export interface DistributionSummary {
  paid: number;
  failed: number;
  pending: number;
  totalPaid: bigint;
}

interface DistributionRow {
  id: string;
  name: string;
  chain_id: number;
  token_address: string;
  token_symbol: string;
  token_decimals: number;
  multisend_address: string | null;
  total_amount: string;
  recipient_count: number;
  status: string;
  created_at: string;
  submitted_at: string | null;
  completed_at: string | null;
  kind: "immediate" | "scheduled";
  escrow_address: string | null;
  execute_after: string | null;
}

export async function getDistribution(
  id: string,
  userId: string,
): Promise<DistributionDetail | null> {
  const rows = (await db()`
    SELECT id, name, chain_id, token_address, token_symbol, token_decimals,
           multisend_address, total_amount, recipient_count, status, created_at,
           submitted_at, completed_at, kind, escrow_address, execute_after
    FROM distributions
    WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL
    LIMIT 1
  `) as DistributionRow[];
  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    chainId: row.chain_id,
    tokenAddress: row.token_address,
    tokenSymbol: row.token_symbol,
    tokenDecimals: row.token_decimals,
    multisendAddress: row.multisend_address,
    totalAmount: row.total_amount,
    recipientCount: row.recipient_count,
    status: row.status,
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
    completedAt: row.completed_at,
    kind: row.kind,
    escrowAddress: row.escrow_address,
    executeAfter: row.execute_after
      ? Math.floor(new Date(row.execute_after).getTime() / 1000)
      : null,
  };
}

export async function getRecipients(
  distributionId: string,
  opts: { limit?: number; offset?: number; failedOnly?: boolean } = {},
): Promise<RecipientRow[]> {
  const { limit = 500, offset = 0, failedOnly = false } = opts;
  const rows = (await db()`
    SELECT r.id, r.batch_index, r.index_in_batch, r.address, r.amount,
           r.status, r.failure_reason, r.paid_at, t.tx_hash
    FROM recipients r
    LEFT JOIN distribution_transactions t ON t.id = r.transaction_id
    WHERE r.distribution_id = ${distributionId}
      AND (${failedOnly} = false OR r.status = 'failed')
    ORDER BY r.batch_index, r.index_in_batch
    LIMIT ${limit} OFFSET ${offset}
  `) as {
    id: string;
    batch_index: number;
    index_in_batch: number;
    address: string;
    amount: string;
    status: RecipientRow["status"];
    failure_reason: string | null;
    paid_at: string | null;
    tx_hash: string | null;
  }[];

  return rows.map((row) => ({
    id: row.id,
    batchIndex: row.batch_index,
    indexInBatch: row.index_in_batch,
    address: row.address,
    amount: row.amount,
    status: row.status,
    failureReason: row.failure_reason,
    paidAt: row.paid_at,
    txHash: row.tx_hash,
  }));
}

export async function getSummary(distributionId: string): Promise<DistributionSummary> {
  const rows = (await db()`
    SELECT status, amount FROM recipients WHERE distribution_id = ${distributionId}
  `) as { status: RecipientRow["status"]; amount: string }[];

  let paid = 0;
  let failed = 0;
  let pending = 0;
  let totalPaid = 0n;
  for (const row of rows) {
    if (row.status === "paid") {
      paid++;
      totalPaid += BigInt(row.amount);
    } else if (row.status === "failed") failed++;
    else pending++;
  }
  return { paid, failed, pending, totalPaid };
}

export async function getTransactions(
  distributionId: string,
): Promise<{ batchIndex: number; txHash: string | null; status: string }[]> {
  const rows = (await db()`
    SELECT batch_index, tx_hash, status
    FROM distribution_transactions
    WHERE distribution_id = ${distributionId}
    ORDER BY batch_index
  `) as { batch_index: number; tx_hash: string | null; status: string }[];
  return rows.map((row) => ({
    batchIndex: row.batch_index,
    txHash: row.tx_hash,
    status: row.status,
  }));
}
