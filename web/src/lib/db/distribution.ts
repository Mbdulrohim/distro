import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Single-distribution reads for the detail page.
 *
 * Scoped to `userId` on the server — that scoping IS the access control today
 * (the SIWE JWT isn't yet Supabase's access token, so RLS doesn't bite for the
 * service-role client). Never take the user id from client input.
 */

export interface DistributionDetail {
  id: string;
  name: string;
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  multisendAddress: string;
  totalAmount: string;
  recipientCount: number;
  status: string;
  createdAt: string;
  submittedAt: string | null;
  completedAt: string | null;
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
  /** Base units actually delivered — counted from rows, never assumed. */
  totalPaid: bigint;
}

/** Returns null when the distribution doesn't exist *or* isn't this user's. */
export async function getDistribution(
  id: string,
  userId: string,
): Promise<DistributionDetail | null> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("distributions")
    .select(
      "id, name, chain_id, token_address, token_symbol, token_decimals, multisend_address, total_amount, recipient_count, status, created_at, submitted_at, completed_at",
    )
    .eq("id", id)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    chainId: data.chain_id,
    tokenAddress: data.token_address,
    tokenSymbol: data.token_symbol,
    tokenDecimals: data.token_decimals,
    multisendAddress: data.multisend_address,
    totalAmount: data.total_amount,
    recipientCount: data.recipient_count,
    status: data.status,
    createdAt: data.created_at,
    submittedAt: data.submitted_at,
    completedAt: data.completed_at,
  };
}

/**
 * Recipients in committed order.
 *
 * Ordered by `(batch_index, index_in_batch)` — position order, always. That
 * ordering is what the on-chain payload committed to, and what maps a `Paid`
 * event back to a row. Sorting by anything else (address, amount, status)
 * would break the correspondence.
 */
export async function getRecipients(
  distributionId: string,
  opts: { limit?: number; offset?: number; failedOnly?: boolean } = {},
): Promise<RecipientRow[]> {
  const supabase = createServiceRoleClient();
  const { limit = 500, offset = 0, failedOnly = false } = opts;

  let query = supabase
    .from("recipients")
    .select(
      "id, batch_index, index_in_batch, address, amount, status, failure_reason, paid_at, distribution_transactions(tx_hash)",
    )
    .eq("distribution_id", distributionId)
    .order("batch_index", { ascending: true })
    .order("index_in_batch", { ascending: true })
    .range(offset, offset + limit - 1);

  if (failedOnly) query = query.eq("status", "failed");

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load recipients: ${error.message}`);

  return (data ?? []).map((r) => {
    // PostgREST types an embedded relation as an array even when the FK makes
    // it at-most-one. Normalise rather than cast it away — a wrong assumption
    // here silently drops every tx link in the table.
    const embedded = r.distribution_transactions as unknown;
    const tx = (Array.isArray(embedded) ? embedded[0] : embedded) as
      { tx_hash: string } | null | undefined;
    return {
      id: r.id,
      batchIndex: r.batch_index,
      indexInBatch: r.index_in_batch,
      address: r.address,
      amount: r.amount,
      status: r.status,
      failureReason: r.failure_reason,
      paidAt: r.paid_at,
      txHash: tx?.tx_hash ?? null,
    };
  });
}

/** Counts + delivered total, computed from the rows themselves. */
export async function getSummary(distributionId: string): Promise<DistributionSummary> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("recipients")
    .select("status, amount")
    .eq("distribution_id", distributionId);

  if (error) throw new Error(`Failed to summarise distribution: ${error.message}`);

  let paid = 0;
  let failed = 0;
  let pending = 0;
  let totalPaid = 0n;

  for (const r of data ?? []) {
    if (r.status === "paid") {
      paid++;
      // BigInt, never Number: 18-decimal base units exceed 2^53 and would round.
      totalPaid += BigInt(r.amount);
    } else if (r.status === "failed") failed++;
    else pending++;
  }

  return { paid, failed, pending, totalPaid };
}

/** Distinct transaction hashes for this distribution, in batch order. */
export async function getTransactions(
  distributionId: string,
): Promise<{ batchIndex: number; txHash: string | null; status: string }[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("distribution_transactions")
    .select("batch_index, tx_hash, status")
    .eq("distribution_id", distributionId)
    .order("batch_index", { ascending: true });

  if (error) throw new Error(`Failed to load transactions: ${error.message}`);
  return (data ?? []).map((t) => ({
    batchIndex: t.batch_index,
    txHash: t.tx_hash,
    status: t.status,
  }));
}
