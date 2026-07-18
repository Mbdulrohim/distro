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
  createdAt: string;
}

/** Headline counters + total distributed, grouped by token. */
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("distributions")
    .select("status, token_symbol, token_decimals, total_amount")
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
      "id, name, token_symbol, token_decimals, total_amount, recipient_count, status, created_at",
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
    createdAt: r.created_at,
  }));
}

export const HISTORY_STATUSES = [
  "draft",
  "submitted",
  "completed",
  "partially_completed",
  "failed",
] as const;
export type HistoryStatus = (typeof HISTORY_STATUSES)[number];

export interface HistoryPage {
  rows: RecentDistribution[];
  /** Total rows matching the filter, for pagination — not just this page's count. */
  total: number;
}

/**
 * The full, filterable distribution log (History page). Same shape as
 * `getRecentDistributions` but paginated and status-filterable — the
 * Dashboard's "recent" list is a slice of this, not a separate source.
 */
export async function getHistory(
  userId: string,
  opts: { status?: HistoryStatus; page?: number; pageSize?: number } = {},
): Promise<HistoryPage> {
  const supabase = createServiceRoleClient();
  const { status, page = 1, pageSize = 20 } = opts;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("distributions")
    .select(
      "id, name, token_symbol, token_decimals, total_amount, recipient_count, status, created_at",
      { count: "exact" },
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status) query = query.eq("status", status);

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
      createdAt: r.created_at,
    })),
  };
}
