/**
 * Pure aggregation for the dashboard. Deliberately separated from the database
 * query (lib/db/dashboard.ts) so the money arithmetic is testable without a
 * database — the query becomes a thin fetch, and the logic that decides what
 * "total distributed" means is verified in isolation.
 */

export interface DistributionRow {
  status: string;
  token_symbol: string;
  token_decimals: number;
  /** numeric(78,0) arrives from Postgres as a string. */
  total_amount: string;
  kind?: "immediate" | "scheduled";
}

export interface TokenTotal {
  tokenSymbol: string;
  tokenDecimals: number;
  /** Base units as a string — bigint doesn't survive JSON. */
  total: string;
}

export interface DashboardStats {
  totalDistributed: TokenTotal[];
  inFlight: number;
  completed: number;
  failed: number;
  drafts: number;
  /** Every row, of either kind — the headline count. */
  totalDistributions: number;
  /** `kind: "scheduled"` rows not yet executing/finished — committed and/or
   * funded, waiting for their time. */
  scheduled: number;
}

/** Statuses whose money actually moved. */
const PAID_STATUSES = new Set(["completed", "partially_completed"]);

export function aggregateStats(rows: DistributionRow[]): DashboardStats {
  const byToken = new Map<string, { decimals: number; total: bigint }>();

  for (const r of rows) {
    // A `submitted` run's outcome isn't known yet; counting it would overstate
    // what was actually paid.
    if (!PAID_STATUSES.has(r.status)) continue;
    const prev = byToken.get(r.token_symbol);
    // BigInt, never Number: 2^53 is ~9e15, and 18-decimal base units blow past
    // that at ~0.01 tokens. Number() here would silently lose precision.
    const amount = BigInt(r.total_amount);
    byToken.set(r.token_symbol, {
      decimals: r.token_decimals,
      total: (prev?.total ?? 0n) + amount,
    });
  }

  const count = (s: string) => rows.filter((r) => r.status === s).length;
  // "scheduled" kind is only meaningful for Tier-2 rows; default (undefined,
  // pre-migration rows or a bare test fixture) reads as "immediate", never
  // as scheduled.
  const scheduledCount = rows.filter(
    (r) => r.kind === "scheduled" && (r.status === "ready" || r.status === "funded"),
  ).length;

  return {
    // Grouped by token, never summed across tokens: base units are relative to
    // each token's own decimals, so 100 USDC (6dp) + 100 MON (18dp) is a
    // meaningless number.
    totalDistributed: [...byToken.entries()].map(([tokenSymbol, v]) => ({
      tokenSymbol,
      tokenDecimals: v.decimals,
      total: v.total.toString(),
    })),
    // "submitted" (immediate, mid-transaction) and "executing" (scheduled,
    // at least one chunk run) are both genuinely in-flight right now.
    inFlight: count("submitted") + count("executing"),
    completed: count("completed"),
    // Partial runs have undelivered payments needing action — they belong with
    // failures, not quietly filed as completed.
    failed: count("failed") + count("partially_completed"),
    drafts: count("draft"),
    totalDistributions: rows.length,
    scheduled: scheduledCount,
  };
}
