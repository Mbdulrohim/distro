import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * User provisioning. A wallet that has signed in must have a `users` row,
 * because every distribution hangs off `user_id` — without this a signed-in
 * wallet can own nothing and the dashboard is permanently empty.
 *
 * Server-only and service-role by necessity: the anon client deliberately has
 * no insert grant on any table (see supabase/migrations/0002_rls_policies.sql),
 * so provisioning cannot happen from the browser. Authorization for this call
 * is the verified SIWE signature — never call it with an unverified address.
 */

/**
 * Return the user id for a wallet, creating the row on first sign-in.
 *
 * Idempotent, and safe against the race where two requests for the same new
 * wallet arrive together: the unique constraint on `wallet_address` decides,
 * and the loser reads back the winner's row rather than failing sign-in.
 */
export async function ensureUser(walletAddress: string): Promise<string> {
  const supabase = createServiceRoleClient();

  const existing = await supabase
    .from("users")
    .select("id")
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`Failed to look up user: ${existing.error.message}`);
  }
  if (existing.data) return existing.data.id;

  const inserted = await supabase
    .from("users")
    .insert({ wallet_address: walletAddress })
    .select("id")
    .single();

  if (inserted.error) {
    // 23505 = unique violation: a concurrent request won the race. Read theirs.
    if (inserted.error.code === "23505") {
      const retry = await supabase
        .from("users")
        .select("id")
        .eq("wallet_address", walletAddress)
        .single();
      if (retry.error) throw new Error(`Failed to resolve user: ${retry.error.message}`);
      return retry.data.id;
    }
    throw new Error(`Failed to create user: ${inserted.error.message}`);
  }

  return inserted.data.id;
}

/** Resolve a wallet to its user id, or null if it has never signed in. */
export async function findUserId(walletAddress: string): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (error) throw new Error(`Failed to look up user: ${error.message}`);
  return data?.id ?? null;
}

/** Account-level facts for the Settings page — nothing beyond what the row holds. */
export async function getUserProfile(
  walletAddress: string,
): Promise<{ walletAddress: string; memberSince: string } | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("users")
    .select("wallet_address, created_at")
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (error) throw new Error(`Failed to load user profile: ${error.message}`);
  if (!data) return null;
  return { walletAddress: data.wallet_address, memberSince: data.created_at };
}
