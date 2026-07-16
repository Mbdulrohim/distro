import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { NetworkBanner } from "@/components/layout/network-banner";

/**
 * Dashboard shell. Access is enforced by middleware (src/middleware.ts) before
 * this ever renders; the layout only provides chrome.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      <NetworkBanner />
      <div className="flex-1">{children}</div>
    </div>
  );
}
