import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import "server-only";

/**
 * Service-role Supabase client. Bypasses RLS entirely — never import this
 * module from client components, and never pass this client (or the key) to
 * the browser. `server-only` makes an accidental client-side import a build
 * error rather than a runtime leak. Reserve for indexer/webhook/admin paths
 * that have their own authorization check.
 */
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
