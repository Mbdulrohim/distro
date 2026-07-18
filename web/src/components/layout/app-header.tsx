import Link from "next/link";
import { ConnectWalletButton } from "@/components/auth/connect-wallet-button";
import { DistroMark } from "@/components/brand/distro-mark";

/**
 * Top navigation bar. Present on both the marketing and dashboard surfaces so
 * the wallet auth control is always reachable.
 */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="group flex items-center gap-2.5 text-primary transition-opacity hover:opacity-80"
        >
          <DistroMark className="h-5 w-5 transition-transform duration-300 ease-out group-hover:scale-110" />
          <span className="text-[0.95rem] font-semibold tracking-tight text-foreground">
            Distro
          </span>
        </Link>
        <ConnectWalletButton />
      </div>
    </header>
  );
}
