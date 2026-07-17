import Link from "next/link";
import { ConnectWalletButton } from "@/components/auth/connect-wallet-button";
import { DistroMark } from "@/components/brand/distro-mark";

/**
 * Top navigation bar. Present on both the marketing and dashboard surfaces so
 * the wallet auth control is always reachable.
 */
export function AppHeader() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-6">
      <Link href="/" className="flex items-center gap-2">
        <DistroMark className="h-5 w-5" />
        <span className="text-[0.95rem] font-semibold tracking-tight">Distro</span>
      </Link>
      <ConnectWalletButton />
    </header>
  );
}
