import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { isAddress } from "viem";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { findUserId } from "@/lib/db/users";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Record the outcome of a RETRY.
 *
 * This exists separately from `/results` because of one thing that is easy to
 * get wrong and expensive to get wrong: **a retry payload is renumbered.**
 *
 * Retrying 4 failures out of 240 sends a fresh 4-entry payload, so the contract
 * emits `Paid` at indices 0-3 — but those recipients live at original positions
 * like 17, 92, 155, 203. Writing results back by payload index would stamp
 * outcomes onto entirely the wrong people, silently. So the client must send
 * each payment's ORIGINAL position, and that is what we match on.
 *
 * A recipient's `(batch_index, index_in_batch)` never changes — it is where the
 * payload committed them. Only `transaction_id` moves, to whichever transaction
 * last attempted them.
 */

const retrySchema = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Not a transaction hash"),
  blockNumber: z.string().regex(/^\d+$/),
  gasUsed: z.string().regex(/^\d+$/),
  payments: z
    .array(
      z.object({
        recipient: z.string().refine(isAddress, "Not a valid address"),
        amount: z.string().regex(/^\d+$/),
        status: z.enum(["paid", "failed"]),
        /** Where this recipient was originally committed — NOT the retry index. */
        originBatchIndex: z.number().int().min(0),
        originIndexInBatch: z.number().int().min(0),
      }),
    )
    .min(1),
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
  const { txHash, blockNumber, gasUsed, payments } = parsed.data;

  const supabase = createServiceRoleClient();

  const { data: dist } = await supabase
    .from("distributions")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .single();
  if (!dist) return NextResponse.json({ error: "Not found." }, { status: 404 });

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
        block_number: blockNumber,
        gas_used: gasUsed,
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

  for (const p of payments) {
    // Matched on the ORIGINAL position. Never the retry index; never the
    // address (duplicates are legal, so an address is not a unique key).
    // Also gated on status='failed': a retry may only ever move a recipient
    // OUT of failure, so a stale post can't un-pay someone.
    const { error } = await supabase
      .from("recipients")
      .update({
        transaction_id: txRowId,
        status: p.status,
        paid_at: p.status === "paid" ? new Date().toISOString() : null,
        failure_reason:
          p.status === "failed" ? "Retry failed — the token still rejected this transfer." : null,
      })
      .eq("distribution_id", id)
      .eq("batch_index", p.originBatchIndex)
      .eq("index_in_batch", p.originIndexInBatch)
      .eq("status", "failed");

    if (error) {
      console.error("Failed to update retried recipient", { p, error });
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

  const status =
    (pending ?? 0) > 0 ? "submitted" : (failed ?? 0) > 0 ? "partially_completed" : "completed";

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
