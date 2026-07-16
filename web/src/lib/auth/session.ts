import "server-only";
// Import the narrow JWS-only subpaths, not the `jose` barrel — the barrel
// pulls in JWE/deflate code (DecompressionStream) that the Edge runtime flags
// as unsupported, even though our HS256 JWS path never uses it.
import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import type { JWTPayload } from "jose";
import { SESSION_TTL_SECONDS } from "./constants";

/**
 * SIWE session token: a signed JWT (HS256) carrying the authenticated wallet
 * address. Stateless — no server-side session store needed for Feature 1.
 * The signing secret is server-only (SESSION_SECRET, no NEXT_PUBLIC prefix).
 *
 * This is deliberately shaped so it can later be swapped for / mirrored into
 * a Supabase-RLS-compatible JWT (address as identity claim) without changing
 * callers — see docs/CTO_REVIEW.md (auth architecture).
 */

const ISSUER = "distro";
const AUDIENCE = "distro:session";

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET is missing or too short (need >= 32 chars). See .env.example.");
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload extends JWTPayload {
  /** Checksummed wallet address of the authenticated user. */
  address: string;
  /** Chain id the sign-in was bound to (Monad Mainnet = 143). */
  chainId: number;
}

export async function createSessionToken(address: string, chainId: number): Promise<string> {
  return new SignJWT({ address, chainId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(address)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

/**
 * Verify and decode a session token. Returns null on any failure (expired,
 * tampered, wrong issuer/audience) — never throws for an invalid token, so
 * callers can treat null as "not authenticated".
 */
export async function verifySessionToken(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload.address !== "string" || typeof payload.chainId !== "number") {
      return null;
    }
    return payload as SessionPayload;
  } catch {
    return null;
  }
}
