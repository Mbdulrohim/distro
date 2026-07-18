import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { aggregateStats, type DashboardStats } from "./aggregate";

/**
 * Dashboard reads. Thin fetches — the money arithmetic lives in ./aggregate.ts
 * as a pure, tested function, so it can be verified without a database.
 *
 * Every query is scoped to a single `userId` on the server, and that scoping IS
 * the access control today: the SIWE JWT isn't yet presented to Supabase as its
 * access token, so the RLS policies (correct as written) don't bite for the
 * service-role client. Never take the user id from client input — derive it
 * from the verified session.
 */

export type { DashboardStats, TokenTotal } from "./aggregate";

export interface RecentDistribution {
  id: string;
  name: string;
  tokenSymbol: string;
  tokenDecimals: number;
  totalAmount: string;
  recipientCount: number;
  status: string;
  kind: "immediate" | "scheduled";
  createdAt: string;
}

/** Headline counters + total distributed, grouped by token. */
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("distributions")
    .select("status, token_symbol, token_decimals, total_amount, kind")
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (error) throw new Error(`Failed to load dashboard stats: ${error.message}`);

  return aggregateStats(data ?? []);
}

/** Most recent distributions for the activity list. */
export async function getRecentDistributions(
  userId: string,
  limit = 5,
): Promise<RecentDistribution[]> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("distributions")
    .select(
      "id, name, token_symbol, token_decimals, total_amount, recipient_count, status, kind, created_at",
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load recent distributions: ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    tokenSymbol: r.token_symbol,
    tokenDecimals: r.token_decimals,
    totalAmount: r.total_amount,
    recipientCount: r.recipient_count,
    status: r.status,
    kind: r.kind,
    createdAt: r.created_at,
  }));
}

/**
 * History groups. Not raw status values — a distribution's lifecycle spans
 * more statuses than a user should have to know about (an "immediate" run is
 * never "ready" or "funded"; a "scheduled" one is never "submitted"), so the
 * filter is the four buckets that actually mean something to a creator.
 */
export const HISTORY_GROUPS = ["active", "scheduled", "completed", "failed"] as const;
export type HistoryGroup = (typeof HISTORY_GROUPS)[number];

/** Status values behind each group. */
const GROUP_STATUSES: Record<HistoryGroup, readonly string[]> = {
  // In progress right now, for either kind — a signed-and-mining Multisend
  // run, or an escrow with at least one executeChunk already confirmed.
  active: ["submitted", "executing"],
  // Committed and/or funded, waiting for its time — not yet started.
  scheduled: ["draft", "ready", "funded"],
  completed: ["completed"],
  // Nothing left to do and it didn't fully succeed: a real failure, a
  // partial run (money moved, some of it didn't land), or a cancelled escrow.
  failed: ["failed", "partially_completed", "cancelled"],
};

export interface HistoryPage {
  rows: RecentDistribution[];
  /** Total rows matching the filter, for pagination — not just this page's count. */
  total: number;
}

/**
 * The full, filterable distribution log (History page). Same shape as
 * `getRecentDistributions` but paginated and group-filterable — the
 * Dashboard's "recent" list is a slice of this, not a separate source.
 */
export async function getHistory(
  userId: string,
  opts: { group?: HistoryGroup; page?: number; pageSize?: number } = {},
): Promise<HistoryPage> {
  const supabase = createServiceRoleClient();
  const { group, page = 1, pageSize = 20 } = opts;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("distributions")
    .select(
      "id, name, token_symbol, token_decimals, total_amount, recipient_count, status, kind, created_at",
      { count: "exact" },
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (group) query = query.in("status", GROUP_STATUSES[group]);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to load distribution history: ${error.message}`);

  return {
    total: count ?? 0,
    rows: (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      tokenSymbol: r.token_symbol,
      tokenDecimals: r.token_decimals,
      totalAmount: r.total_amount,
      recipientCount: r.recipient_count,
      status: r.status,
      kind: r.kind,
      createdAt: r.created_at,
    })),
  };
}
