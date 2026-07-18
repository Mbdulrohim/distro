"use client";

import { useMemo, useState } from "react";
import { Clock, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { validateSchedule, nowSeconds } from "@/lib/schedule/validate";
import { MIN_LEAD_SECONDS } from "@/lib/schedule/types";
import type { ScheduleDraft } from "@/lib/schedule/types";

interface SchedulePickerProps {
  value: ScheduleDraft;
  onChange: (draft: ScheduleDraft, valid: boolean) => void;
  /** Whether the escrow contract is deployed on the connected chain — see
   * lib/schedule/types.ts: a stored timestamp with no escrow schedules
   * nothing, so "Schedule for later" must stay disabled until it is. */
  schedulingAvailable: boolean;
}

/**
 * Choose between sending now (`Multisend`, immediate) and scheduling for
 * later (the escrow contract, permissionless execution at `executeAfter`).
 *
 * "Schedule for later" is rendered but disabled when the escrow isn't
 * deployed on the connected chain — visibly inert, not hidden, so the
 * capability's existence is honest without offering a control that can't
 * work yet.
 */
export function SchedulePicker({ value, onChange, schedulingAvailable }: SchedulePickerProps) {
  // Local datetime-input string, converted to UTC unix seconds on change.
  const [localInput, setLocalInput] = useState("");

  const validation = useMemo(() => validateSchedule(value, nowSeconds()), [value]);

  function selectNow() {
    const draft: ScheduleDraft = { mode: "now" };
    onChange(draft, true);
  }

  function selectScheduled() {
    const draft: ScheduleDraft = { mode: "scheduled", executeAt: value.executeAt };
    onChange(draft, validateSchedule(draft, nowSeconds()).ok);
  }

  function onDatetimeChange(input: string) {
    setLocalInput(input);
    const executeAt = input ? Math.floor(new Date(input).getTime() / 1000) : undefined;
    const draft: ScheduleDraft = { mode: "scheduled", executeAt };
    onChange(draft, validateSchedule(draft, nowSeconds()).ok);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={selectNow}
          aria-pressed={value.mode === "now"}
          className={cn(
            "flex flex-col items-start gap-1.5 rounded-lg border px-4 py-3 text-left transition-colors",
            value.mode === "now" ? "border-ring bg-muted" : "border-border hover:bg-muted/50",
          )}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Send className="size-4" />
            Send now
          </span>
          <span className="text-xs text-muted-foreground">
            You sign, and it sends immediately. No custody — tokens move straight from your wallet.
          </span>
        </button>

        <button
          type="button"
          onClick={selectScheduled}
          disabled={!schedulingAvailable}
          aria-pressed={value.mode === "scheduled"}
          className={cn(
            "flex flex-col items-start gap-1.5 rounded-lg border px-4 py-3 text-left transition-colors",
            !schedulingAvailable
              ? "cursor-not-allowed border-border opacity-50"
              : value.mode === "scheduled"
                ? "border-ring bg-muted"
                : "border-border hover:bg-muted/50",
          )}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Clock className="size-4" />
            Schedule for later
          </span>
          <span className="text-xs text-muted-foreground">
            {schedulingAvailable
              ? "Escrows the funds now; anyone can trigger the run once the time arrives, even if you're offline."
              : 'Not available on this network yet — the escrow contract isn\'t deployed. Use "Send now" instead.'}
          </span>
        </button>
      </div>

      {value.mode === "scheduled" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="execute-at" className="text-sm font-medium">
            Run at
          </label>
          <input
            id="execute-at"
            type="datetime-local"
            value={localInput}
            min={new Date(Date.now() + MIN_LEAD_SECONDS * 1000).toISOString().slice(0, 16)}
            onChange={(e) => onDatetimeChange(e.target.value)}
            className="h-9 w-fit rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          {!validation.ok && validation.errors.length > 0 ? (
            <p className="text-xs text-destructive">{validation.errors[0].message}</p>
          ) : validation.ok && validation.executeAt ? (
            <p className="text-xs text-muted-foreground">
              Funds are locked in escrow from the moment you fund this distribution until it runs or
              you cancel it.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
