import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { truncateAddress } from "@/lib/format";

/**
 * Protected dashboard. Middleware guards the route; this component independently
 * re-verifies the session server-side (defense in depth) and reads the wallet
 * address straight from the verified token — no client round-trip needed to
 * render the authenticated state.
 *
 * Foundation stage: this confirms auth works end-to-end. Real campaign
 * management lands in later features per docs/ROADMAP.md.
 */
export default async function DashboardPage() {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);

  // Middleware should prevent this, but never render authenticated chrome
  // without a verified session.
  if (!session) redirect("/");

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">You are signed in on Monad Mainnet.</p>
        </div>

        <dl className="grid gap-4 rounded-lg border border-border p-5">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted-foreground">Wallet</dt>
            <dd className="font-mono text-sm" title={session.address}>
              {truncateAddress(session.address, 6)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted-foreground">Network</dt>
            <dd className="text-sm">Monad Mainnet ({session.chainId})</dd>
          </div>
        </dl>
      </div>
    </main>
  );
}
