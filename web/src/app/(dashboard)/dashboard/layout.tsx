import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { NetworkBanner } from "@/components/layout/network-banner";
import { DashboardNav } from "@/components/layout/dashboard-nav";

/**
 * Dashboard shell. Access is enforced by middleware (src/middleware.ts) before
 * this ever renders; the layout only provides chrome.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      <NetworkBanner />
      <DashboardNav />
      <div className="flex-1">{children}</div>
    </div>
  );
}
