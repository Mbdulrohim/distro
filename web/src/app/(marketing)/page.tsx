import Link from "next/link";
import { AppHeader } from "@/components/layout/app-header";
import { SignedInRedirectNotice } from "./signed-in-redirect-notice";

/**
 * Landing / sign-in surface. Foundation stage: the product's value prop plus
 * the wallet auth entry point (in the header). When a user is bounced here
 * from a protected route, we show a short notice explaining why.
 */
export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-16">
        {redirect ? <SignedInRedirectNotice /> : null}
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            Token distribution infrastructure for Monad.
          </h1>
          <p className="text-muted-foreground">
            Connect your wallet to access the dashboard. DISTRO runs on Monad
            Mainnet only.
          </p>
        </div>
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Go to dashboard →
          </Link>
        </div>
      </main>
    </>
  );
}
