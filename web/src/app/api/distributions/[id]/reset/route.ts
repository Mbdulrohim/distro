import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { findUserId } from "@/lib/db/users";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Reset a distribution from submitted/failed/partially_completed back to draft.
 * Allows re-execution after an error or partial completion.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const userId = await findUserId(session.address);
  if (!userId) return NextResponse.json({ error: "Account not provisioned." }, { status: 409 });

  const supabase = createServiceRoleClient();

  // Ownership check
  const { data: dist } = await supabase
    .from("distributions")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .single();

  if (!dist) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Only allow reset from certain states
  if (!["submitted", "partially_completed", "failed"].includes(dist.status)) {
    return NextResponse.json({ error: `Cannot reset from ${dist.status} state.` }, { status: 400 });
  }

  // Reset to draft
  const { error } = await supabase
    .from("distributions")
    .update({
      status: "draft",
      submitted_at: null,
      completed_at: null,
    })
    .eq("id", id);

  if (error) {
    console.error("Failed to reset distribution", error);
    return NextResponse.json({ error: "Could not reset distribution." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
