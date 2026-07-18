"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/use-auth";

/**
 * Always mounted on the marketing page, renders nothing. The moment a
 * session BECOMES authenticated — whether the visitor arrived via the
 * middleware's `?redirect=` bounce-back or just clicked "Connect Wallet" in
 * the header on a plain landing-page visit — this sends them on to the
 * dashboard (or their original destination). Without this, connecting from
 * the header directly left a signed-in visitor stranded on the marketing
 * page with no automatic next step.
 *
 * Fires only on the false -> true transition, never merely because
 * `isAuthenticated` is already true. Without that guard, an already-signed-in
 * visitor who deliberately navigates back to "/" (e.g. clicking the logo from
 * the dashboard) gets bounced straight back to /dashboard, making the logo
 * link look broken — it's not a link bug, it's this component redirecting
 * every render instead of only right after sign-in actually completes.
 */
export function AuthRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  const target = searchParams.get("redirect") ?? "/dashboard";
  const wasAuthenticated = useRef(isAuthenticated);

  useEffect(() => {
    if (isAuthenticated && !wasAuthenticated.current) {
      router.replace(target);
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated, router, target]);

  return null;
}
