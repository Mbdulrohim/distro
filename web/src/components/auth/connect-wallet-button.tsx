"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { truncateAddress } from "@/lib/format";
import { useAuth } from "./use-auth";

/**
 * The single entry point for wallet auth in the UI. Renders the correct
 * control for every auth state — loading, signed-out, signing-in, signed-in —
 * and surfaces sign-in errors inline rather than via a transient toast.
 */
export function ConnectWalletButton({
  label = "Connect Wallet",
  size = "sm",
}: {
  /** Signed-out CTA text — callers on the marketing surface (e.g. the hero)
   * override this to match their own copy ("Start Distribution"). */
  label?: string;
  size?: "sm" | "default" | "lg";
}) {
  const {
    address,
    isAuthenticated,
    isSessionLoading,
    signIn,
    isSigningIn,
    signInError,
    signOut,
    isSigningOut,
  } = useAuth();

  if (isSessionLoading) {
    return (
      <Button variant="outline" size={size} disabled>
        <Loader2 className="animate-spin" />
        Loading
      </Button>
    );
  }

  if (isAuthenticated && address) {
    return (
      <div className="flex items-center gap-2">
        <span
          className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs text-muted-foreground"
          title={address}
        >
          {truncateAddress(address)}
        </span>
        <Button variant="ghost" size={size} onClick={() => signOut()} disabled={isSigningOut}>
          {isSigningOut ? <Loader2 className="animate-spin" /> : null}
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button size={size} onClick={() => signIn().catch(() => {})} disabled={isSigningIn}>
        {isSigningIn ? <Loader2 className="animate-spin" /> : null}
        {isSigningIn ? "Check your wallet…" : label}
      </Button>
      {signInError ? (
        <p className="max-w-64 text-right text-xs text-destructive">
          {signInError instanceof Error ? signInError.message : "Sign-in failed. Please try again."}
        </p>
      ) : null}
    </div>
  );
}
