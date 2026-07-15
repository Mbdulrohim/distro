import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, NONCE_COOKIE } from "@/lib/auth/constants";

/**
 * Clear the session (and any dangling nonce). Idempotent — safe to call when
 * already logged out.
 */
export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(NONCE_COOKIE);
  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
