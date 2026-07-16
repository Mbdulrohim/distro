/**
 * Schedule model for a distribution.
 *
 * Two execution modes, and the difference is architectural, not cosmetic:
 *
 *  - **now** — the creator is present and signs. `Multisend` moves tokens
 *    straight from their wallet. No custody, no state, nothing to hold.
 *  - **scheduled** — the creator is offline when it fires. This REQUIRES the
 *    escrow (docs/CONTRACT_SPEC.md): funds pre-committed to a per-distribution
 *    contract, `executeAfter` enforced on-chain, execution permissionless so a
 *    run survives Distro being down.
 *
 * A stored timestamp alone does not schedule anything. Without escrow the
 * scheduled time arrives and nothing happens — silently. That is why
 * `scheduled` mode must stay unavailable in the UI until the escrow ships.
 */

export type ExecutionMode = "now" | "scheduled";

export interface ScheduleDraft {
  mode: ExecutionMode;
  /**
   * Unix seconds, UTC. Only meaningful when mode is "scheduled".
   * Stored and compared in UTC always; local time is a display concern —
   * a payroll run must not shift because someone flew to another timezone.
   */
  executeAt?: number;
}

export type ScheduleErrorCode =
  "missing-time" | "in-past" | "too-soon" | "too-far" | "invalid-time";

export interface ScheduleError {
  code: ScheduleErrorCode;
  message: string;
}

export interface ScheduleValidation {
  ok: boolean;
  errors: ScheduleError[];
  /** Normalized value: undefined for "now", a UTC unix second for "scheduled". */
  executeAt?: number;
}

/**
 * Minimum lead time for a scheduled run.
 *
 * `executeAfter` is enforced against `block.timestamp`, but the user picks a
 * time using their browser's clock — which can be minutes off. A schedule 30
 * seconds out against a fast local clock is rejected on-chain and reads as a
 * broken product. Below this floor the honest answer is "execute now", so we
 * say that instead of pretending to schedule.
 */
export const MIN_LEAD_SECONDS = 5 * 60;

/**
 * Maximum horizon. A run scheduled beyond a year is near-certainly a typo (a
 * mis-picked year), and it would lock the creator's capital in escrow for that
 * whole time. Guard the mistake rather than honor it.
 */
export const MAX_HORIZON_SECONDS = 365 * 24 * 60 * 60;

/**
 * Distribution states in which the schedule may still be edited.
 *
 * Once created on-chain, `executeAfter` is immutable — the contract is a clone
 * with no setter (docs/CONTRACT_ARCHITECTURE.md, upgrade strategy). So editing
 * is a pre-signature affordance only: change it while it's a draft, or cancel
 * and redeploy. The UI must never imply a committed schedule can be nudged.
 */
export const EDITABLE_STATUSES = ["draft"] as const;

export function isScheduleEditable(status: string): boolean {
  return (EDITABLE_STATUSES as readonly string[]).includes(status);
}
