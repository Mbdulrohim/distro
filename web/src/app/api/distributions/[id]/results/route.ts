import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { isAddress } from "viem";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { findUserId } from "@/lib/db/users";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

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
  blockNumber: z.string().regex(/^\d+$/),
  gasUsed: z.string().regex(/^\d+$/),
  payments: z
    .array(
      z.object({
        recipient: z.string().refine(isAddress, "Not a valid address"),
        amount: z.string().regex(/^\d+$/),
        index: z.number().int().min(0),
        status: z.enum(["paid", "failed"]),
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

  const parsed = resultSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { batchIndex, txHash, blockNumber, gasUsed, payments } = parsed.data;

  const supabase = createServiceRoleClient();

  // Ownership check. Never trust the id in the URL — a distribution you don't
  // own must 404, not leak its existence.
  const { data: dist } = await supabase
    .from("distributions")
    .select("id, recipient_count, kind")
    .eq("id", id)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .single();

  if (!dist) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Upsert the transaction — idempotent on (distribution_id, batch_index).
  const { data: tx, error: txError } = await supabase
    .from("distribution_transactions")
    .upsert(
      {
        distribution_id: id,
        batch_index: batchIndex,
        tx_hash: txHash,
        status: "mined" as const,
        block_number: blockNumber,
        gas_used: gasUsed,
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

  // Update each recipient by POSITION. Matching on address would corrupt a
  // distribution that intentionally pays one address twice.
  for (const p of payments) {
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
      .eq("index_in_batch", p.index);

    if (error) {
      console.error("Failed to update recipient", { batchIndex, index: p.index, error });
      return NextResponse.json({ error: "Could not record results." }, { status: 500 });
    }
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
