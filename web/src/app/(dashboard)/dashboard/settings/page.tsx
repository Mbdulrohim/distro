import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { getUserProfile } from "@/lib/db/users";
import { chainLabel, supportedChains } from "@/config/chains";
import { DisconnectWalletCard } from "@/components/settings/disconnect-wallet-card";

/**
 * Account settings. Deliberately small: there is no notification-preference
 * or org/team schema yet, so this shows only what actually exists — wallet
 * identity and session network — rather than inventing fields with nowhere
 * real to save.
 */
export default async function SettingsPage() {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/");

  const profile = await getUserProfile(session.address);
  const explorer = supportedChains.find((c) => c.id === session.chainId)?.blockExplorers?.default
    .url;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10 sm:py-12">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Dashboard
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your account and connected wallet.</p>
      </div>

      <div className="flex flex-col gap-6">
        <section className="rounded-xl border border-border p-6">
          <h2 className="text-sm font-medium">Account</h2>
          <dl className="mt-4 flex flex-col gap-3 text-sm">
            <Row label="Wallet address">
              <span className="flex items-center gap-1.5 font-mono">
                {session.address}
                {explorer ? (
                  <a
                    href={`${explorer}/address/${session.address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="View on block explorer"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                ) : null}
              </span>
            </Row>
            <Row label="Network">{chainLabel(session.chainId)}</Row>
            {profile ? (
              <Row label="Member since">{new Date(profile.memberSince).toLocaleDateString()}</Row>
            ) : null}
          </dl>
        </section>

        <section className="rounded-xl border border-border p-6">
          <h2 className="text-sm font-medium">Wallet</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Distro never has access to your private key — every transaction is signed in your own
            wallet.
          </p>
          <DisconnectWalletCard />
        </section>
      </div>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
