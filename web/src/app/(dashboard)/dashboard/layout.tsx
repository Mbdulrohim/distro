import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";

/**
 * Dashboard shell. Access is enforced by middleware (src/middleware.ts) before
 * this ever renders; the layout only provides chrome.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      <div className="flex-1">{children}</div>
    </div>
  );
}
