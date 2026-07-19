import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getAddress, type Address } from "viem";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { findUserId } from "@/lib/db/users";
import { db } from "@/lib/db/client";
import {
  verifyDistributionReceipt,
  type VerifiedPayment,
} from "@/lib/distributions/verify-receipt";

const resultSchema = z.object({
  batchIndex: z.number().int().min(0),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Not a transaction hash"),
});

interface DistributionRow {
  id: string;
  chain_id: number;
  token_address: string;
  kind: "immediate" | "scheduled";
  multisend_address: string | null;
  escrow_address: string | null;
}

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
  const sql = db();

  const distributions = (await sql`
    SELECT id, chain_id, token_address, kind, multisend_address, escrow_address
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

  const expected = (await sql`
    SELECT id, index_in_batch, address, amount
    FROM recipients
    WHERE distribution_id = ${id} AND batch_index = ${batchIndex}
    ORDER BY index_in_batch
  `) as { id: string; index_in_batch: number; address: string; amount: string }[];

  if (expected.length !== verified.payments.length) {
    return NextResponse.json(
      { error: "Receipt does not match this distribution batch." },
      { status: 409 },
    );
  }
  const matched = matchPaymentsToRows(expected, verified.payments);
  if (!matched) {
    return NextResponse.json(mismatchPayload(expected, verified.payments), { status: 409 });
  }

  const existing = (await sql`
    SELECT id, tx_hash
    FROM distribution_transactions
    WHERE distribution_id = ${id} AND batch_index = ${batchIndex}
    LIMIT 1
  `) as { id: string; tx_hash: string | null }[];
  const prior = existing[0];
  if (prior && prior.tx_hash?.toLowerCase() !== txHash.toLowerCase()) {
    return NextResponse.json(
      { error: "A different transaction is already recorded for this batch." },
      { status: 409 },
    );
  }

  const transactionId = prior?.id ?? randomUUID();
  const now = new Date().toISOString();
  console.log(
    `[/api/distributions/[id]/results] Recording ${matched.length} matched recipient results`,
  );
  try {
    await sql.transaction((tx) => [
      tx`
        INSERT INTO distribution_transactions (
          id, distribution_id, batch_index, tx_hash, status,
          block_number, gas_used, mined_at
        ) VALUES (
          ${transactionId}, ${id}, ${batchIndex}, ${txHash}, 'mined',
          ${verified.blockNumber.toString()}, ${verified.gasUsed.toString()}, ${now}
        )
        ON CONFLICT (distribution_id, batch_index) DO UPDATE SET
          tx_hash = EXCLUDED.tx_hash,
          status = EXCLUDED.status,
          block_number = EXCLUDED.block_number,
          gas_used = EXCLUDED.gas_used,
          mined_at = EXCLUDED.mined_at
      `,
      ...matched.map(
        ({ payment, row }) => tx`
        UPDATE recipients SET
          transaction_id = ${transactionId},
          status = ${payment.status}::recipient_status,
          paid_at = ${payment.status === "paid" ? now : null},
          failure_reason = ${
            payment.status === "failed"
              ? "The token rejected this transfer (recipient or token rule)."
              : null
          }
        WHERE distribution_id = ${id}
          AND batch_index = ${batchIndex}
          AND id = ${row.id}
      `,
      ),
    ]);
  } catch (error) {
    console.error("Failed to record distribution results", error);
    return NextResponse.json({ error: "Could not record results." }, { status: 500 });
  }

  console.log(
    `[/api/distributions/[id]/results] Transaction ${transactionId} and recipient results recorded`,
  );

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
      submitted_at = ${now},
      completed_at = ${pending === 0 ? now : null}
    WHERE id = ${id}
  `;

  return NextResponse.json({ status, pending, failed });
}

export const dynamic = "force-dynamic";
