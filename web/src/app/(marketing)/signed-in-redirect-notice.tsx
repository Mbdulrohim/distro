"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/use-auth";

/**
 * Shown when a user is redirected here from a protected route. Explains why
 * they're seeing the landing page, and forwards them to their original
 * destination the moment authentication completes.
 */
export function SignedInRedirectNotice() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  const target = searchParams.get("redirect") ?? "/dashboard";

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(target);
    }
  }, [isAuthenticated, router, target]);

  if (isAuthenticated) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
      Please connect your wallet to continue to{" "}
      <span className="font-mono text-foreground">{target}</span>.
    </div>
  );
}
