"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { formatScheduleForDisplay } from "@/lib/schedule/validate";

/** Ticking countdown to a unix-seconds timestamp, formatted as a compact
 * "Xd Yh Zm" (dropping leading zero units). Ticks client-side only — never
 * server-rendered, since "now" isn't a stable value across a render. */
function useCountdown(targetSeconds: number): { label: string; arrived: boolean } {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Math.floor(Date.now() / 1000));
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null) return { label: "", arrived: false };

  const remaining = targetSeconds - now;
  if (remaining <= 0) return { label: "Arrived", arrived: true };

  const days = Math.floor(remaining / 86_400);
  const hours = Math.floor((remaining % 86_400) / 3_600);
  const minutes = Math.floor((remaining % 3_600) / 60);
  const seconds = remaining % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (days > 0 || hours > 0) parts.push(`${hours}h`);
  if (days === 0 && (hours > 0 || minutes > 0)) parts.push(`${minutes}m`);
  if (days === 0 && hours === 0) parts.push(`${seconds}s`);

  return { label: parts.join(" "), arrived: false };
}

/**
 * Live countdown to a scheduled distribution's `executeAfter`. Purely a
 * display — the contract, not this component, is the actual authority on
 * whether execution is allowed; this just tells a creator how long until it
 * will be.
 */
export function ScheduleCountdown({ executeAfter }: { executeAfter: number }) {
  const { label, arrived } = useCountdown(executeAfter);
  const { local, utc } = formatScheduleForDisplay(executeAfter);

  if (label === "") {
    // First client render, before the interval effect has run — avoid a
    // flash of "0s" or a hydration mismatch against the server-rendered shell.
    return null;
  }

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
      <Clock className="size-3.5" />
      {arrived ? (
        <span className="text-info">Scheduled time has arrived</span>
      ) : (
        <span>
          Executes in {label} — {local} ({utc})
        </span>
      )}
    </span>
  );
}
