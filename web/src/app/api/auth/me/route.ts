import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";

/**
 * Return the current authenticated session, or `{ address: null }` when there
 * is none. Never 401s — it's a status probe the client uses to hydrate auth
 * state, not a protected resource.
 */
export async function GET() {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json({ address: null });
  }

  return NextResponse.json({ address: session.address, chainId: session.chainId });
}

export const dynamic = "force-dynamic";
