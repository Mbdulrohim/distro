import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getAddress, type Address } from "viem";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { findUserId } from "@/lib/db/users";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  verifyDistributionReceipt,
  type VerifiedPayment,
} from "@/lib/distributions/verify-receipt";

/**
 * Record the outcome of an executed batch.
 *
 * The client decodes `Paid` / `PaymentFailed` from the transaction receipt and
 * posts them here. The receipt is the source of truth — this endpoint only
 * persists what the chain already said, so the dashboard can answer "who was
 * paid?" without re-reading the chain on every page load.
 *
 * **Idempotent.** A retried post of the same tx hash must not duplicate rows or
 * double-count a payment: the transaction row is keyed on
 * `(distribution_id, batch_index)` and upserted, and recipient rows are matched
 * on `(distribution_id, batch_index, index_in_batch)` — the position, never the
 * address, because duplicate addresses are legal by design.
 */

const resultSchema = z.object({
  batchIndex: z.number().int().min(0),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Not a transaction hash"),
});

type ExpectedRecipient = {
  id: string;
  index_in_batch: number;
  address: string;
  amount: string;
};

type MatchedPayment = {
  payment: VerifiedPayment;
  row: ExpectedRecipient;
};

function shortAddress(address: string): string {
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function mismatchPayload(expected: ExpectedRecipient[], payments: VerifiedPayment[]) {
  return {
    error: "Receipt payment does not match committed recipients.",
    expected: expected.map((row) => ({
      index: row.index_in_batch,
      address: shortAddress(row.address),
      amount: row.amount,
    })),
    receipt: payments.map((payment) => ({
      index: payment.index,
      address: shortAddress(payment.recipient),
      amount: payment.amount,
      status: payment.status,
    })),
  };
}

/**
 * Primary mapping is the contract event index. If a legacy/browser flow sent
 * the right recipients but the saved row positions drifted, fall back to an
 * exact address+amount match. That still refuses to mark someone paid unless
 * the mined receipt proves that same recipient and amount was included.
 */
function matchPaymentsToRows(
  expected: ExpectedRecipient[],
  payments: VerifiedPayment[],
): MatchedPayment[] | null {
  const byIndex = payments.map((payment) => {
    const row = expected.find((candidate) => candidate.index_in_batch === payment.index);
    if (!row) return null;
    return { payment, row };
  });

  if (byIndex.every((match): match is MatchedPayment => match !== null)) {
    const indexMatched = byIndex.every(({ payment, row }) => {
      return getAddress(row.address) === payment.recipient && row.amount === payment.amount;
    });
    if (indexMatched) return byIndex;
  }

  const used = new Set<string>();
  const byContent: MatchedPayment[] = [];
  for (const payment of payments) {
    const row = expected.find((candidate) => {
      if (used.has(candidate.id)) return false;
      return (
        getAddress(candidate.address) === payment.recipient && candidate.amount === payment.amount
      );
    });
    if (!row) return null;
    used.add(row.id);
    byContent.push({ payment, row });
  }
  return byContent;
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const userId = await findUserId(session.address);
  if (!userId) return NextResponse.json({ error: "Account not provisioned." }, { status: 409 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = resultSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { batchIndex, txHash } = parsed.data;

  const supabase = createServiceRoleClient();

  // Ownership check. Never trust the id in the URL — a distribution you don't
  // own must 404, not leak its existence.
  const { data: dist } = await supabase
    .from("distributions")
    .select("id, chain_id, token_address, kind, multisend_address, escrow_address")
    .eq("id", id)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .single();

  if (!dist) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const contract = (
    dist.kind === "scheduled" ? dist.escrow_address : dist.multisend_address
  ) as Address | null;
  if (!contract)
    return NextResponse.json({ error: "Distribution contract is not recorded." }, { status: 409 });

  let verified;
  try {
    console.log(`[/api/distributions/[id]/results] Verifying receipt:`, {
      chainId: dist.chain_id,
      txHash,
      contract,
      kind:
        dist.kind === "scheduled"
          ? "scheduled"
          : dist.token_address === "0x0000000000000000000000000000000000000000"
            ? "immediate-native"
            : "immediate-erc20",
      batchIndex,
    });
    verified = await verifyDistributionReceipt({
      chainId: dist.chain_id,
      txHash: txHash as `0x${string}`,
      contract,
      kind:
        dist.kind === "scheduled"
          ? "scheduled"
          : dist.token_address === "0x0000000000000000000000000000000000000000"
            ? "immediate-native"
            : "immediate-erc20",
      batchIndex,
    });
    console.log(`[/api/distributions/[id]/results] Receipt verified successfully:`, verified);
  } catch (error) {
    console.error(
      `[/api/distributions/[id]/results] verifyDistributionReceipt failed:`,
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not verify transaction receipt." },
      { status: 400 },
    );
  }

  const { data: expected } = await supabase
    .from("recipients")
    .select("id, index_in_batch, address, amount")
    .eq("distribution_id", id)
    .eq("batch_index", batchIndex)
    .order("index_in_batch", { ascending: true });
  if (!expected || expected.length !== verified.payments.length) {
    return NextResponse.json(
      { error: "Receipt does not match this distribution batch." },
      { status: 409 },
    );
  }
  const matched = matchPaymentsToRows(expected, verified.payments);
  if (!matched) {
    return NextResponse.json(mismatchPayload(expected, verified.payments), { status: 409 });
  }

  const { data: prior } = await supabase
    .from("distribution_transactions")
    .select("id, tx_hash")
    .eq("distribution_id", id)
    .eq("batch_index", batchIndex)
    .maybeSingle();
  if (prior && prior.tx_hash?.toLowerCase() !== txHash.toLowerCase()) {
    return NextResponse.json(
      { error: "A different transaction is already recorded for this batch." },
      { status: 409 },
    );
  }

  // Upsert the transaction — idempotent on (distribution_id, batch_index).
  const { data: tx, error: txError } = await supabase
    .from("distribution_transactions")
    .upsert(
      {
        distribution_id: id,
        batch_index: batchIndex,
        tx_hash: txHash,
        status: "mined" as const,
        block_number: verified.blockNumber,
        gas_used: verified.gasUsed,
        mined_at: new Date().toISOString(),
      },
      { onConflict: "distribution_id,batch_index" },
    )
    .select("id")
    .single();

  if (txError || !tx) {
    console.error("Failed to record transaction", txError);
    return NextResponse.json({ error: "Could not record the transaction." }, { status: 500 });
  }

  console.log(`[/api/distributions/[id]/results] Transaction recorded with id: ${tx.id}`);
  console.log(
    `[/api/distributions/[id]/results] About to update ${verified.payments.length} recipients:`,
    verified.payments,
  );

  // Update each recipient by POSITION. Matching on address would corrupt a
  // distribution that intentionally pays one address twice.
  for (const { payment: p, row } of matched) {
    console.log(
      `[/api/distributions/[id]/results] Updating recipient row ${row.id} with status ${p.status}`,
    );
    const { error } = await supabase
      .from("recipients")
      .update({
        transaction_id: tx.id,
        status: p.status,
        paid_at: p.status === "paid" ? new Date().toISOString() : null,
        failure_reason:
          p.status === "failed"
            ? "The token rejected this transfer (recipient or token rule)."
            : null,
      })
      .eq("distribution_id", id)
      .eq("batch_index", batchIndex)
      .eq("id", row.id);

    if (error) {
      console.error("Failed to update recipient", { batchIndex, rowId: row.id, error });
      return NextResponse.json({ error: "Could not record results." }, { status: 500 });
    }

    console.log(`[/api/distributions/[id]/results] Successfully updated recipient ${row.id}`);
  }

  // Derive the distribution's status from what actually landed, counted in the
  // database rather than from this request — a partial post must not report
  // "completed".
  const { count: pending } = await supabase
    .from("recipients")
    .select("id", { count: "exact", head: true })
    .eq("distribution_id", id)
    .eq("status", "pending");

  const { count: failed } = await supabase
    .from("recipients")
    .select("id", { count: "exact", head: true })
    .eq("distribution_id", id)
    .eq("status", "failed");

  // "submitted" for immediate (Multisend, in-flight for the duration of one
  // signed transaction); "executing" for scheduled (an escrow that may take
  // several separate `executeChunk` calls, possibly by different callers,
  // possibly hours apart) — same in-progress meaning, distinct vocabulary
  // because the two are genuinely different processes.
  const inProgressStatus = dist.kind === "scheduled" ? "executing" : "submitted";
  const status =
    (pending ?? 0) > 0 ? inProgressStatus : (failed ?? 0) > 0 ? "partially_completed" : "completed";

  await supabase
    .from("distributions")
    .update({
      status,
      submitted_at: new Date().toISOString(),
      completed_at: (pending ?? 0) === 0 ? new Date().toISOString() : null,
    })
    .eq("id", id);

  return NextResponse.json({ status, pending: pending ?? 0, failed: failed ?? 0 });
}

export const dynamic = "force-dynamic";
