import Link from "next/link";
import { ConnectWalletButton } from "@/components/auth/connect-wallet-button";

/**
 * Top navigation bar. Present on both the marketing and dashboard surfaces so
 * the wallet auth control is always reachable.
 */
export function AppHeader() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-6">
      <Link href="/" className="font-mono text-sm font-semibold tracking-tight">
        DISTRO
      </Link>
      <ConnectWalletButton />
    </header>
  );
}
