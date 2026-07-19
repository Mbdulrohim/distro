import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { findUserId } from "@/lib/db/users";
import { db } from "@/lib/db/client";

/** Reset a fully failed distribution so it can be executed again safely. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const userId = await findUserId(session.address);
  if (!userId) return NextResponse.json({ error: "Account not provisioned." }, { status: 409 });

  const sql = db();
  const distributions = (await sql`
    SELECT d.id, d.status,
           EXISTS (
             SELECT 1 FROM recipients r
             WHERE r.distribution_id = d.id AND r.status = 'paid'
           ) AS has_paid_recipients
    FROM distributions d
    WHERE d.id = ${id} AND d.user_id = ${userId} AND d.deleted_at IS NULL
    LIMIT 1
  `) as { id: string; status: string; has_paid_recipients: boolean }[];
  const dist = distributions[0];

  if (!dist) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // A submitted transaction may already be mined, and a partial distribution
  // has already paid someone. Resetting either to a full draft could double-pay
  // recipients, so those states must use sync/retry instead.
  if (dist.status !== "failed" || dist.has_paid_recipients) {
    return NextResponse.json({ error: `Cannot reset from ${dist.status} state.` }, { status: 400 });
  }

  try {
    await sql.transaction((tx) => [
      tx`
        UPDATE distributions
        SET status = 'draft', submitted_at = NULL, completed_at = NULL
        WHERE id = ${id}
      `,
      tx`
        UPDATE recipients
        SET transaction_id = NULL, status = 'pending', failure_reason = NULL, paid_at = NULL
        WHERE distribution_id = ${id}
      `,
      tx`DELETE FROM distribution_transactions WHERE distribution_id = ${id}`,
    ]);
  } catch (error) {
    console.error("Failed to reset distribution", error);
    return NextResponse.json({ error: "Could not reset distribution." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
