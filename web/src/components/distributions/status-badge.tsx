import { Check, X, Clock, Circle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Distribution status badge. Per DESIGN.md's Never-Color-Alone Rule, every
 * state carries an icon and a word as well as a colour — the meaning has to
 * survive a grayscale screenshot, and ~8% of men can't rely on the hue.
 *
 * `warning`/`success` semantic tokens aren't wired into globals.css yet (F5),
 * so this uses the tokens that exist. Swap when they land.
 */

const STATUS: Record<string, { label: string; icon: typeof Check; className: string }> = {
  draft: {
    label: "Draft",
    icon: Circle,
    className: "border-border bg-muted text-muted-foreground",
  },
  submitted: {
    label: "In flight",
    icon: Clock,
    className: "border-border bg-muted text-foreground",
  },
  completed: {
    label: "Completed",
    icon: Check,
    className: "border-border bg-muted text-foreground",
  },
  partially_completed: {
    label: "Partial",
    icon: AlertTriangle,
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  failed: {
    label: "Failed",
    icon: X,
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

export function StatusBadge({ status, count }: { status: string; count?: number }) {
  const s = STATUS[status] ?? {
    label: status,
    icon: Circle,
    className: "border-border bg-muted text-muted-foreground",
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
