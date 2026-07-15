import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client (Route Handlers, Server Components, Server
 * Actions). Cookie-based session, anon key + RLS — same trust boundary as
 * the browser client. Use `createServiceRoleClient` only for privileged
 * server-only operations that must bypass RLS.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component with no request context to write
            // cookies into — safe to ignore when middleware handles refresh.
          }
        },
      },
    },
  );
}
