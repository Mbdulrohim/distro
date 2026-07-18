"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/use-auth";

/**
 * Always mounted on the marketing page, renders nothing. The moment a
 * session becomes authenticated — whether the visitor arrived via the
 * middleware's `?redirect=` bounce-back or just clicked "Connect Wallet" in
 * the header on a plain landing-page visit — this sends them on to the
 * dashboard (or their original destination). Without this, connecting from
 * the header directly left a signed-in visitor stranded on the marketing
 * page with no automatic next step.
 */
export function AuthRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  const target = searchParams.get("redirect") ?? "/dashboard";

  useEffect(() => {
    if (isAuthenticated) router.replace(target);
  }, [isAuthenticated, router, target]);

  return null;
}
