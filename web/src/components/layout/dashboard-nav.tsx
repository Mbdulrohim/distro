"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Distributions" },
  { href: "/dashboard/history", label: "History" },
  { href: "/dashboard/templates", label: "Templates" },
  { href: "/dashboard/settings", label: "Settings" },
];

/**
 * Secondary nav for the authenticated dashboard surface. A flat tab strip,
 * not a sidebar — the dashboard has five destinations total, which doesn't
 * earn the extra chrome a sidebar costs on smaller screens.
 */
// "/dashboard" itself is a prefix of every route here, so its match must
// exclude the other tabs' subtrees explicitly (detail pages and
// "/dashboard/new" belong to Distributions, not to any other tab).
const OTHER_PREFIXES = ITEMS.filter((i) => i.href !== "/dashboard").map((i) => i.href);

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border px-6" aria-label="Dashboard">
      <div className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto">
        {ITEMS.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard" || !OTHER_PREFIXES.some((p) => pathname.startsWith(p))
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
