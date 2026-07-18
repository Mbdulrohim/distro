"use client";

import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/use-auth";

/**
 * Shown when a user is redirected here from a protected route. Explains why
 * they're seeing the landing page. The actual navigation once signed in is
 * `AuthRedirect`'s job (always mounted on this page) — this component is
 * purely the explanatory banner, so there's only one place that decides
 * when to navigate.
 */
export function SignedInRedirectNotice() {
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  const target = searchParams.get("redirect") ?? "/dashboard";

  if (isAuthenticated) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
      Please connect your wallet to continue to{" "}
      <span className="font-mono text-foreground">{target}</span>.
    </div>
  );
}
