import {
  MAX_HORIZON_SECONDS,
  MIN_LEAD_SECONDS,
  type ScheduleDraft,
  type ScheduleError,
  type ScheduleValidation,
} from "./types";

/**
 * Validate a schedule draft against the current time.
 *
 * `now` is injected rather than read from the clock so this is deterministic
 * and testable — and so a caller can pass chain time instead of browser time,
 * which is the value that actually decides whether `executeAfter` has passed.
 */
export function validateSchedule(draft: ScheduleDraft, nowSeconds: number): ScheduleValidation {
  // "Execute now" carries no timestamp to validate; the creator is present and
  // signing, so the schedule is simply "when they click".
  if (draft.mode === "now") {
    return { ok: true, errors: [], executeAt: undefined };
  }

  const errors: ScheduleError[] = [];
  const at = draft.executeAt;

  if (at === undefined) {
    errors.push({ code: "missing-time", message: "Pick a date and time to run this." });
    return { ok: false, errors };
  }

  if (!Number.isFinite(at) || !Number.isInteger(at) || at <= 0) {
    errors.push({ code: "invalid-time", message: "That date and time isn't valid." });
    return { ok: false, errors };
  }

  if (at <= nowSeconds) {
    errors.push({ code: "in-past", message: "That time has already passed." });
  } else if (at < nowSeconds + MIN_LEAD_SECONDS) {
    // Deliberately a distinct error from "in-past": the user's intent is clear
    // and the fix is specific, so name it.
    errors.push({
      code: "too-soon",
      message: `Schedule at least ${MIN_LEAD_SECONDS / 60} minutes out, or choose "execute now" instead.`,
    });
  }

  if (at > nowSeconds + MAX_HORIZON_SECONDS) {
    errors.push({
      code: "too-far",
      message:
        "That's more than a year away — check the date. Your funds would be locked until then.",
    });
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, errors: [], executeAt: at };
}

/** Current time as UTC unix seconds. */
export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Format a scheduled time for display: local time plus an explicit UTC echo.
 *
 * Both are shown always, never just one. A payroll operator scheduling from a
 * different timezone than their team is the normal case, not the edge case,
 * and "9:00" without a zone is how a run lands on the wrong day.
 */
export function formatScheduleForDisplay(executeAt: number): { local: string; utc: string } {
  const date = new Date(executeAt * 1000);
  return {
    local: date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
    utc: `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`,
  };
}
