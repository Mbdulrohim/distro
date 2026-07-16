import { Check, X, Clock, Circle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Distribution status badge — the clearest expression of DESIGN.md's
 * Functional Color Rule: every hue here names a payment state, and nothing is
 * coloured for decoration. On a monochrome screen these are the only colour,
 * which is exactly why they read instantly.
 *
 * Never-Color-Alone Rule: each state carries an icon AND a word as well as a
 * colour. The meaning survives a grayscale screenshot, and doesn't depend on
 * hue discrimination (~8% of men can't rely on it).
 */

const STATUS: Record<string, { label: string; icon: typeof Check; className: string }> = {
  draft: {
    label: "Draft",
    icon: Circle,
    // Neutral: nothing has happened yet, so no state colour is warranted.
    className: "border-border bg-surface-2 text-muted-foreground",
  },
  submitted: {
    label: "In flight",
    icon: Clock,
    // Pending — outcome genuinely unknown until the receipt lands.
    className: "border-info/30 bg-info-surface text-info",
  },
  completed: {
    label: "Completed",
    icon: Check,
    className: "border-success/30 bg-success-surface text-success",
  },
  partially_completed: {
    label: "Partial",
    icon: AlertTriangle,
    // Attention, not alarm: money moved, some of it didn't land, and it's
    // retryable. Warning rather than destructive.
    className: "border-warning/30 bg-warning-surface text-warning",
  },
  failed: {
    label: "Failed",
    icon: X,
    className: "border-destructive/30 bg-destructive-surface text-destructive",
  },
};

export function StatusBadge({ status, count }: { status: string; count?: number }) {
  const s = STATUS[status] ?? {
    label: status,
    icon: Circle,
    className: "border-border bg-surface-2 text-muted-foreground",
  };
  const Icon = s.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        s.className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {s.label}
      {count !== undefined && count > 0 ? ` · ${count} failed` : null}
    </span>
  );
}
