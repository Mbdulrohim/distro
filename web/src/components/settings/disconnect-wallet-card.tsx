"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/use-auth";

/** Real sign-out, wired to the same session used by the rest of the app. */
export function DisconnectWalletCard() {
  const { signOut, isSigningOut } = useAuth();

  return (
    <Button variant="secondary" size="sm" onClick={() => signOut()} disabled={isSigningOut}>
      {isSigningOut ? <Loader2 className="animate-spin" /> : null}
      Disconnect wallet
    </Button>
  );
}
