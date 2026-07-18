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

type StatusMeta = { label: string; icon: typeof Check; className: string; live?: boolean };

const STATUS: Record<string, StatusMeta> = {
  draft: {
    label: "Draft",
    icon: Circle,
    // Neutral: nothing has happened yet, so no state colour is warranted.
    className: "border-border bg-surface-2 text-muted-foreground",
  },
  submitted: {
    label: "In flight",
    icon: Clock,
    // Pending — outcome genuinely unknown until the receipt lands. `live`
    // adds a quiet pulse so an in-progress run reads as active, not stalled.
    className: "border-info/30 bg-info-surface text-info",
    live: true,
  },
  // Tier-2 (escrow) states — committed but not yet funded, or funded and
  // waiting for its scheduled time. Distinct from "draft": the recipient
  // list is already committed on-chain by this point.
  ready: {
    label: "Ready to fund",
    icon: Circle,
    className: "border-border bg-surface-2 text-muted-foreground",
  },
  funded: {
    label: "Scheduled",
    icon: Clock,
    className: "border-info/30 bg-info-surface text-info",
  },
  executing: {
    label: "Executing",
    icon: Clock,
    className: "border-info/30 bg-info-surface text-info",
    live: true,
  },
  cancelled: {
    label: "Cancelled",
    icon: X,
    className: "border-border bg-surface-2 text-muted-foreground",
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
  const s: StatusMeta = STATUS[status] ?? {
    label: status,
    icon: Circle,
    className: "border-border bg-surface-2 text-muted-foreground",
  };
  const Icon = s.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        s.className,
      )}
    >
      {s.live ? (
        // A soft pulsing dot for an active run — the one place motion earns
        // its keep on the flat dashboard. `motion-reduce` stills it.
        <span className="relative flex size-2" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex size-2 rounded-full bg-current" />
        </span>
      ) : (
        <Icon className="size-3" aria-hidden />
      )}
      {s.label}
      {count !== undefined && count > 0 ? ` · ${count} failed` : null}
    </span>
  );
}
