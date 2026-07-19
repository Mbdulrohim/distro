import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { isAddress } from "viem";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { findUserId } from "@/lib/db/users";
import { db } from "@/lib/db/client";
import { getDistributionFactoryAddress } from "@/config/contracts";
import { verifyEscrowAddress } from "@/lib/distributions/verify-receipt";

/**
 * Record a scheduled distribution's escrow address once `createDistribution`
 * confirms on-chain. Called once, right after
 * `createScheduledDistribution`'s `create:confirmed` event — the DB row is
 * the draft created first (lib/db pattern shared with the immediate path);
 * this is what turns it from "kind: scheduled, escrow_address: null" into a
 * row that actually points at a deployed clone.
 */

const escrowSchema = z.object({
  escrowAddress: z.string().refine(isAddress, "Not a valid address"),
});

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const parsed = escrowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Ownership + kind check. A distribution you don't own must 404, not leak
  // its existence; an immediate-kind row must never grow an escrow address.
  const distributions = (await db()`
    SELECT id, kind, escrow_address, chain_id, salt
    FROM distributions
    WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL
    LIMIT 1
  `) as {
    id: string;
    kind: "immediate" | "scheduled";
    escrow_address: string | null;
    chain_id: number;
    salt: string | null;
  }[];
  const dist = distributions[0];

  if (!dist || dist.kind !== "scheduled") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!dist.salt)
    return NextResponse.json({ error: "Distribution has no escrow salt." }, { status: 409 });
  try {
    await verifyEscrowAddress({
      chainId: dist.chain_id,
      factory: getDistributionFactoryAddress(dist.chain_id),
      creator: session.address as `0x${string}`,
      salt: dist.salt as `0x${string}`,
      escrow: parsed.data.escrowAddress as `0x${string}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not verify escrow address." },
      { status: 400 },
    );
  }
  // Idempotent: a retried post with the same address is a no-op success,
  // matching this address to a DIFFERENT one would mean two on-chain clones
  // think they're the same distribution — refuse that outright.
  if (
    dist.escrow_address &&
    dist.escrow_address.toLowerCase() !== parsed.data.escrowAddress.toLowerCase()
  ) {
    return NextResponse.json(
      { error: "Escrow address already recorded and differs." },
      { status: 409 },
    );
  }

  try {
    await db()`
      UPDATE distributions
      SET escrow_address = ${parsed.data.escrowAddress}, status = 'ready'
      WHERE id = ${id}
    `;
  } catch (error) {
    console.error("Failed to record escrow address", error);
    return NextResponse.json({ error: "Could not record the escrow address." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
