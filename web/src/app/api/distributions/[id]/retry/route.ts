import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getAddress, type Address } from "viem";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { findUserId } from "@/lib/db/users";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { verifyDistributionReceipt } from "@/lib/distributions/verify-receipt";

/**
 * Record the outcome of a RETRY.
 *
 * This exists separately from `/results` because of one thing that is easy to
 * get wrong and expensive to get wrong: **a retry payload can be renumbered.**
 *
 * Retrying 4 failures out of 240 (immediate/Multisend) sends a fresh 4-entry
 * payload, so the contract emits `Paid` at indices 0-3 — but those recipients
 * live at original positions like 17, 92, 155, 203. The mapping back to the
 * ORIGINAL row is therefore never trusted from the client — it is derived
 * entirely server-side from data whose integrity we already control:
 *
 *  - **Scheduled (escrow) retries**: the contract's own `retry` takes the
 *    original chunk positions as its argument, and its `Paid`/`PaymentFailed`
 *    events carry that same original position (`pos`) directly — see
 *    Distribution.sol. So `verified.payments[i].index` for a scheduled retry
 *    IS the real `index_in_batch`. No client-supplied mapping needed, and
 *    none is accepted for this case.
 *  - **Immediate (Multisend) retries**: the contract has no memory of
 *    original positions at all — a fresh payload always numbers from 0. The
 *    only anchor available is content (address + amount), which is NOT
 *    sufficient on its own: two currently-failed recipients can legitimately
 *    share the same address and amount (duplicates are allowed by design),
 *    making a content-only match ambiguous about which physical row a given
 *    on-chain event actually belongs to. The fix is to remove the ambiguity
 *    at the source: fetch every currently-failed recipient for this
 *    distribution in one canonical, deterministic order (batch_index,
 *    index_in_batch ascending) and require it to retry ALL of them, in
 *    that exact order — which is what the UI's "Retry N failed" already
 *    does (there is no partial-retry affordance). Position i in that
 *    canonical list is then zipped against the verified event whose index
 *    is i. A malicious or buggy client cannot attach a real on-chain event
 *    to the wrong ledger row, because the row is chosen by the server's own
 *    query order, never by anything the client asserts.
 */

const retrySchema = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Not a transaction hash"),
  /** Required only for a scheduled (escrow) retry — which chunk's `retry`
   * was called. Merely a routing hint: `verifyDistributionReceipt` asserts
   * it against the receipt's own `chunkIndex` and throws on a mismatch, so a
   * false claim here fails closed rather than silently mis-attaching. */
  chunkIndex: z.number().int().min(0).optional(),
});

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

  const parsed = retrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { txHash, chunkIndex } = parsed.data;

  const supabase = createServiceRoleClient();

  const { data: dist } = await supabase
    .from("distributions")
    .select("id, kind, chain_id, token_address, multisend_address, escrow_address")
    .eq("id", id)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .single();
  if (!dist) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const contract = (
    dist.kind === "scheduled" ? dist.escrow_address : dist.multisend_address
  ) as Address | null;
  if (!contract) {
    return NextResponse.json({ error: "Distribution contract is not recorded." }, { status: 409 });
  }
  if (dist.kind === "scheduled" && chunkIndex === undefined) {
    return NextResponse.json(
      { error: "chunkIndex is required for a scheduled retry." },
      { status: 400 },
    );
  }

  let verified;
  try {
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
      // Only meaningful for "scheduled" (asserted against the receipt's own
      // chunkIndex inside verifyDistributionReceipt); ignored otherwise.
      batchIndex: chunkIndex ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not verify transaction receipt." },
      { status: 400 },
    );
  }

  // The canonical (batch_index, index_in_batch) target for each verified
  // event, derived entirely server-side -- never from client input.
  let targets: { batchIndex: number; indexInBatch: number }[];

  if (dist.kind === "scheduled") {
    // The contract's own `pos` IS the original position. Trust it directly.
    targets = verified.payments.map((p) => ({ batchIndex: chunkIndex!, indexInBatch: p.index }));
  } else {
    const { data: currentlyFailed } = await supabase
      .from("recipients")
      .select("batch_index, index_in_batch")
      .eq("distribution_id", id)
      .eq("status", "failed")
      .order("batch_index", { ascending: true })
      .order("index_in_batch", { ascending: true });

    if (!currentlyFailed || currentlyFailed.length !== verified.payments.length) {
      return NextResponse.json(
        { error: "This retry does not cover exactly the currently-failed recipients." },
        { status: 409 },
      );
    }
    targets = currentlyFailed.map((r) => ({
      batchIndex: r.batch_index,
      indexInBatch: r.index_in_batch,
    }));
  }

  // A retry is its own transaction, so it needs its own row. Reuse the row if
  // this tx hash was already recorded — makes the endpoint idempotent under a
  // double-post without inventing a second batch.
  const { data: existing } = await supabase
    .from("distribution_transactions")
    .select("id")
    .eq("distribution_id", id)
    .eq("tx_hash", txHash)
    .maybeSingle();

  let txRowId = existing?.id;

  if (!txRowId) {
    const { data: last } = await supabase
      .from("distribution_transactions")
      .select("batch_index")
      .eq("distribution_id", id)
      .order("batch_index", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextBatchIndex = (last?.batch_index ?? -1) + 1;

    const { data: tx, error: txError } = await supabase
      .from("distribution_transactions")
      .insert({
        distribution_id: id,
        batch_index: nextBatchIndex,
        tx_hash: txHash,
        status: "mined" as const,
        block_number: verified.blockNumber,
        gas_used: verified.gasUsed,
        mined_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (txError || !tx) {
      console.error("Failed to record retry transaction", txError);
      return NextResponse.json({ error: "Could not record the transaction." }, { status: 500 });
    }
    txRowId = tx.id;
  }

  for (let i = 0; i < verified.payments.length; i++) {
    const event = verified.payments.find((candidate) => candidate.index === i);
    const target = targets[i];
    if (!event || !target) {
      return NextResponse.json(
        { error: "Retry mapping does not match transaction receipt." },
        { status: 409 },
      );
    }

    const { data: recipient } = await supabase
      .from("recipients")
      .select("address, amount")
      .eq("distribution_id", id)
      .eq("batch_index", target.batchIndex)
      .eq("index_in_batch", target.indexInBatch)
      .eq("status", "failed")
      .maybeSingle();
    if (
      !recipient ||
      getAddress(recipient.address) !== event.recipient ||
      recipient.amount !== event.amount
    ) {
      return NextResponse.json(
        { error: "Retry receipt does not match the failed recipient." },
        { status: 409 },
      );
    }

    // Matched on the ORIGINAL position, chosen by this server's own query
    // order (or the contract's own `pos`) — never by anything the client
    // asserted. Also gated on status='failed': a retry may only ever move a
    // recipient OUT of failure, so a stale post can't un-pay someone.
    const { error } = await supabase
      .from("recipients")
      .update({
        transaction_id: txRowId,
        status: event.status,
        paid_at: event.status === "paid" ? new Date().toISOString() : null,
        failure_reason:
          event.status === "failed"
            ? "Retry failed — the token still rejected this transfer."
            : null,
      })
      .eq("distribution_id", id)
      .eq("batch_index", target.batchIndex)
      .eq("index_in_batch", target.indexInBatch)
      .eq("status", "failed");

    if (error) {
      console.error("Failed to update retried recipient", { target, error });
      return NextResponse.json({ error: "Could not record retry results." }, { status: 500 });
    }
  }

  // Recount from the rows, never from the request body.
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

  // Same kind-aware vocabulary as /results — "executing" for a scheduled
  // (escrow) distribution, "submitted" for immediate (Multisend).
  const inProgressStatus = dist.kind === "scheduled" ? "executing" : "submitted";
  const status =
    (pending ?? 0) > 0 ? inProgressStatus : (failed ?? 0) > 0 ? "partially_completed" : "completed";

  await supabase
    .from("distributions")
    .update({
      status,
      completed_at: (pending ?? 0) === 0 ? new Date().toISOString() : null,
    })
    .eq("id", id);

  return NextResponse.json({ status, pending: pending ?? 0, failed: failed ?? 0 });
}

export const dynamic = "force-dynamic";
