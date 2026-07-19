import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getAddress, type Address } from "viem";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { findUserId } from "@/lib/db/users";
import { db } from "@/lib/db/client";
import { verifyDistributionReceipt } from "@/lib/distributions/verify-receipt";

const retrySchema = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Not a transaction hash"),
  chunkIndex: z.number().int().min(0).optional(),
});

interface DistributionRow {
  id: string;
  kind: "immediate" | "scheduled";
  chain_id: number;
  token_address: string;
  multisend_address: string | null;
  escrow_address: string | null;
}

interface FailedRecipientRow {
  batch_index: number;
  index_in_batch: number;
  address: string;
  amount: string;
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
  const parsed = retrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { txHash, chunkIndex } = parsed.data;
  const sql = db();

  const distributions = (await sql`
    SELECT id, kind, chain_id, token_address, multisend_address, escrow_address
    FROM distributions
    WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL
    LIMIT 1
  `) as DistributionRow[];
  const dist = distributions[0];
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
      batchIndex: chunkIndex ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not verify transaction receipt." },
      { status: 400 },
    );
  }

  const failedRecipients = (await sql`
    SELECT batch_index, index_in_batch, address, amount
    FROM recipients
    WHERE distribution_id = ${id} AND status = 'failed'
    ORDER BY batch_index, index_in_batch
  `) as FailedRecipientRow[];

  const targets =
    dist.kind === "scheduled"
      ? verified.payments.map((payment) => ({
          batchIndex: chunkIndex!,
          indexInBatch: payment.index,
        }))
      : failedRecipients.map((row) => ({
          batchIndex: row.batch_index,
          indexInBatch: row.index_in_batch,
        }));

  if (dist.kind === "immediate" && targets.length !== verified.payments.length) {
    return NextResponse.json(
      { error: "This retry does not cover exactly the currently-failed recipients." },
      { status: 409 },
    );
  }

  const byPosition = new Map(
    failedRecipients.map((row) => [`${row.batch_index}:${row.index_in_batch}`, row]),
  );
  const mappedPayments = targets.map((target, index) => ({
    target,
    // Scheduled retry events retain their original (possibly sparse) position;
    // immediate retries are renumbered from zero by Multisend.
    event:
      dist.kind === "scheduled"
        ? verified.payments[index]
        : verified.payments.find((candidate) => candidate.index === index),
  }));

  for (const { event, target } of mappedPayments) {
    const recipient = target
      ? byPosition.get(`${target.batchIndex}:${target.indexInBatch}`)
      : undefined;
    if (
      !event ||
      !target ||
      !recipient ||
      getAddress(recipient.address) !== event.recipient ||
      recipient.amount !== event.amount
    ) {
      return NextResponse.json(
        { error: "Retry receipt does not match the failed recipient." },
        { status: 409 },
      );
    }
  }

  const existingTransactions = (await sql`
    SELECT id FROM distribution_transactions
    WHERE distribution_id = ${id} AND tx_hash = ${txHash}
    LIMIT 1
  `) as { id: string }[];
  const existingId = existingTransactions[0]?.id;
  const transactionId = existingId ?? randomUUID();

  const lastBatches = (await sql`
    SELECT coalesce(max(batch_index), -1)::int AS batch_index
    FROM distribution_transactions WHERE distribution_id = ${id}
  `) as { batch_index: number }[];
  const nextBatchIndex = (lastBatches[0]?.batch_index ?? -1) + 1;
  const now = new Date().toISOString();

  try {
    await sql.transaction((tx) => [
      ...(!existingId
        ? [
            tx`
              INSERT INTO distribution_transactions (
                id, distribution_id, batch_index, tx_hash, status,
                block_number, gas_used, mined_at
              ) VALUES (
                ${transactionId}, ${id}, ${nextBatchIndex}, ${txHash}, 'mined',
                ${verified.blockNumber.toString()}, ${verified.gasUsed.toString()}, ${now}
              )
            `,
          ]
        : []),
      ...mappedPayments.map(({ event, target }) => {
        return tx`
          UPDATE recipients SET
            transaction_id = ${transactionId},
            status = ${event!.status}::recipient_status,
            paid_at = ${event!.status === "paid" ? now : null},
            failure_reason = ${
              event!.status === "failed"
                ? "Retry failed — the token still rejected this transfer."
                : null
            }
          WHERE distribution_id = ${id}
            AND batch_index = ${target.batchIndex}
            AND index_in_batch = ${target.indexInBatch}
            AND status = 'failed'
        `;
      }),
    ]);
  } catch (error) {
    console.error("Failed to record retry results", error);
    return NextResponse.json({ error: "Could not record retry results." }, { status: 500 });
  }

  const counts = (await sql`
    SELECT
      count(*) FILTER (WHERE status = 'pending')::int AS pending,
      count(*) FILTER (WHERE status = 'failed')::int AS failed
    FROM recipients WHERE distribution_id = ${id}
  `) as { pending: number; failed: number }[];
  const { pending = 0, failed = 0 } = counts[0] ?? {};
  const inProgressStatus = dist.kind === "scheduled" ? "executing" : "submitted";
  const status = pending > 0 ? inProgressStatus : failed > 0 ? "partially_completed" : "completed";

  await sql`
    UPDATE distributions SET
      status = ${status}::distribution_status,
      completed_at = ${pending === 0 ? now : null}
    WHERE id = ${id}
  `;

  return NextResponse.json({ status, pending, failed });
}

export const dynamic = "force-dynamic";
