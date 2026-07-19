import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes, randomUUID } from "node:crypto";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { findUserId } from "@/lib/db/users";
import { db } from "@/lib/db/client";
import { createDistributionSchema, computeTotal } from "@/lib/validation/distribution";
import { isSupportedChain } from "@/config/chains";
import { getMultisendAddress, getMultisendNativeAddress } from "@/config/contracts";
import { maxRecipientsPerBatch } from "@/lib/gas/estimate";

/**
 * Create a draft distribution with its recipients.
 *
 * Ownership comes from the verified session cookie, never from the request
 * body — a caller cannot create a distribution under someone else's wallet.
 * The total is recomputed server-side from the rows.
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createDistributionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // The supported-chain set is an invariant of the build, not a client
  // preference. Production (staging off) accepts mainnet only.
  if (!isSupportedChain(input.chainId)) {
    return NextResponse.json(
      { error: "Unsupported network for this deployment." },
      { status: 400 },
    );
  }

  const isNative = input.tokenAddress === "0x0000000000000000000000000000000000000000";
  let multisendAddress: `0x${string}` | null = null;
  if (input.kind === "immediate") {
    // Canonical deployment selection is a server invariant, never client input.
    multisendAddress = isNative
      ? getMultisendNativeAddress(input.chainId)
      : getMultisendAddress(input.chainId);
  }

  const userId = await findUserId(session.address);
  if (!userId) {
    return NextResponse.json({ error: "Account not provisioned." }, { status: 409 });
  }

  // Authoritative — the client's total is never trusted.
  const total = computeTotal(input.recipients);

  // Server-generated, never client-supplied: the on-chain `createDistribution`
  // salt is returned to the caller so their transaction uses the exact value
  // this row expects — trusting a client-chosen salt would let a caller target
  // a collision, however implausible, with someone else's pending escrow.
  const salt: `0x${string}` | null =
    input.kind === "scheduled" ? `0x${randomBytes(32).toString("hex")}` : null;

  const id = randomUUID();

  // Position is load-bearing: it maps a Paid/PaymentFailed event (which carries
  // only an index) back to its row, and is the retry key. Preserve input order
  // exactly — never sort.
  const batchSize = maxRecipientsPerBatch();
  const rows = input.recipients.map((r, i) => ({
    distribution_id: id,
    batch_index: Math.floor(i / batchSize),
    index_in_batch: i % batchSize,
    address: r.address,
    amount: r.amount,
    status: "pending" as const,
  }));

  const sql = db();
  try {
    await sql.transaction((tx) => [
      tx`
        INSERT INTO distributions (
          id, user_id, chain_id, multisend_address, name, token_address,
          token_symbol, token_decimals, total_amount, recipient_count,
          status, kind, execute_after, salt
        ) VALUES (
          ${id}, ${userId}, ${input.chainId}, ${multisendAddress}, ${input.name},
          ${input.tokenAddress}, ${input.tokenSymbol}, ${input.tokenDecimals},
          ${total.toString()}, ${input.recipients.length}, 'draft', ${input.kind},
          ${input.kind === "scheduled" && input.executeAfter ? new Date(input.executeAfter * 1000).toISOString() : null},
          ${salt}
        )
      `,
      tx`
        INSERT INTO recipients (
          distribution_id, batch_index, index_in_batch, address, amount, status
        )
        SELECT distribution_id::uuid, batch_index, index_in_batch,
               address::citext, amount::numeric, status::recipient_status
        FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS item(
          distribution_id text,
          batch_index integer,
          index_in_batch integer,
          address text,
          amount text,
          status text
        )
      `,
    ]);
  } catch (error) {
    console.error("Failed to create distribution", error);
    return NextResponse.json({ error: "Could not create distribution." }, { status: 500 });
  }

  return NextResponse.json({ id, salt }, { status: 201 });
}

export const dynamic = "force-dynamic";
