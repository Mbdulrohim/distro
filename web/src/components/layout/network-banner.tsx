"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { AlertTriangle, Loader2 } from "lucide-react";
import { MONAD_MAINNET_CHAIN_ID } from "@/config/chains";
import { Button } from "@/components/ui/button";

/**
 * Persistent wrong-network guard. FEATURES.md requires a "persistent,
 * unmissable network indicator" because a wrong-network action with real
 * funds must be hard to perform by accident, and DESIGN.md specifies a
 * full-width banner when off Monad Mainnet.
 *
 * The sign-in flow switches to mainnet before signing, but a user can switch
 * networks in their wallet at any point afterward — this is the only thing
 * that catches that. Silent when correct; blocking-loud when not.
 *
 * Uses the destructive role as the attention token because the semantic
 * `warning` role isn't wired into globals.css yet (that's F5 — see DESIGN.md
 * Don'ts). Swap to `warning` once it lands; the wrong-network state is a
 * warning, not a failure.
 */
export function NetworkBanner() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  // Silent when correct, or when there's no wallet to be on a network at all.
  if (!isConnected || chainId === MONAD_MAINNET_CHAIN_ID) return null;

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-destructive/30 bg-destructive/10 px-6 py-2.5 text-sm"
    >
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="size-4 shrink-0" />
        <span>
          Wrong network. Distro runs on <strong>Monad Mainnet</strong> only — actions stay disabled
          until you switch.
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => switchChain({ chainId: MONAD_MAINNET_CHAIN_ID })}
        disabled={isPending}
      >
        {isPending ? <Loader2 className="animate-spin" /> : null}
        Switch to Monad Mainnet
      </Button>
    </div>
  );
}
