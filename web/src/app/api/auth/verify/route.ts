import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { parseSiweMessage } from "viem/siwe";
import { getAddress } from "viem";
import { verifySignIn } from "@/lib/auth/siwe";
import { isSupportedChain } from "@/config/chains";
import { createSessionToken } from "@/lib/auth/session";
import { ensureUser } from "@/lib/db/users";
import { NONCE_COOKIE, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth/constants";

/**
 * Verify a signed SIWE message and, on success, issue a session cookie.
 *
 * Rejects (401) unless the signature is valid AND the message is bound to the
 * nonce this server issued, this deployment's domain, and a chain this build
 * supports (mainnet always; testnet only when staging is enabled).
 */
export async function POST(request: Request) {
  let body: { message?: unknown; signature?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { message, signature } = body;
  if (typeof message !== "string" || typeof signature !== "string") {
    return NextResponse.json(
      { error: "Both `message` and `signature` are required." },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const expectedNonce = cookieStore.get(NONCE_COOKIE)?.value;
  if (!expectedNonce) {
    return NextResponse.json(
      { error: "No sign-in in progress or nonce expired. Request a new nonce." },
      { status: 400 },
    );
  }

  // Reject an unsupported chain before spending a verification round-trip.
  // In a production build (staging off) this is mainnet-only, unchanged.
  const parsed = parseSiweMessage(message);
  if (!isSupportedChain(parsed.chainId)) {
    return NextResponse.json(
      { error: "Sign-in must be on a supported Monad network." },
      { status: 400 },
    );
  }
  if (!parsed.address) {
    return NextResponse.json({ error: "Malformed SIWE message." }, { status: 400 });
  }

  const expectedDomain = new URL(request.url).host;

  const valid = await verifySignIn({
    message,
    signature: signature as `0x${string}`,
    expectedNonce,
    expectedDomain,
    chainId: parsed.chainId!,
  });

  if (!valid) {
    return NextResponse.json({ error: "Signature verification failed." }, { status: 401 });
  }

  // Single-use nonce: clear it so the same signature can't be replayed.
  cookieStore.delete(NONCE_COOKIE);

  const address = getAddress(parsed.address);

  // Provision the user row before issuing a session. Ordered deliberately: a
  // session whose wallet has no `users` row can own no distributions, so
  // handing one out would produce an account that silently cannot work.
  // The verified signature above is this call's authorization.
  try {
    await ensureUser(address);
  } catch (error) {
    console.error("Sign-in failed: could not provision user", error);
    return NextResponse.json(
      { error: "Sign-in temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }

  const token = await createSessionToken(address, parsed.chainId!);

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  return NextResponse.json({ address });
}

export const dynamic = "force-dynamic";
