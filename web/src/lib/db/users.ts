import "server-only";
import { db } from "./client";

interface UserIdRow {
  id: string;
}

/**
 * Return the user id for a wallet, creating the row on first sign-in.
 * `ON CONFLICT` makes concurrent first-sign-in requests safe and idempotent.
 */
export async function ensureUser(walletAddress: string): Promise<string> {
  const rows = (await db()`
    INSERT INTO users (wallet_address)
    VALUES (${walletAddress})
    ON CONFLICT (wallet_address) DO UPDATE
      SET wallet_address = EXCLUDED.wallet_address
    RETURNING id
  `) as UserIdRow[];

  return rows[0].id;
}

/** Resolve a wallet to its user id, or null if it has never signed in. */
export async function findUserId(walletAddress: string): Promise<string | null> {
  const rows = (await db()`
    SELECT id FROM users WHERE wallet_address = ${walletAddress} LIMIT 1
  `) as UserIdRow[];
  return rows[0]?.id ?? null;
}

/** Account-level facts for the Settings page — nothing beyond what the row holds. */
export async function getUserProfile(
  walletAddress: string,
): Promise<{ walletAddress: string; memberSince: string } | null> {
  const rows = (await db()`
    SELECT wallet_address, created_at
    FROM users
    WHERE wallet_address = ${walletAddress}
    LIMIT 1
  `) as { wallet_address: string; created_at: string }[];

  const row = rows[0];
  return row ? { walletAddress: row.wallet_address, memberSince: row.created_at } : null;
}
