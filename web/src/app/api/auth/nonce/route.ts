import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateSiweNonce } from "viem/siwe";
import { NONCE_COOKIE, NONCE_TTL_SECONDS } from "@/lib/auth/constants";

/**
 * Issue a SIWE nonce. Stored in a short-lived httpOnly cookie (not readable
 * by JS, so it can't be exfiltrated client-side) and echoed in the body for
 * the client to embed in the SIWE message. The verify route checks that the
 * signed message's nonce matches this cookie.
 */
export async function GET() {
  const nonce = generateSiweNonce();
  const cookieStore = await cookies();

  cookieStore.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: NONCE_TTL_SECONDS,
  });

  return NextResponse.json({ nonce });
}

export const dynamic = "force-dynamic";
