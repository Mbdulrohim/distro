import "server-only";
import { db } from "./client";
import { aggregateStats, type DashboardStats, type DistributionRow } from "./aggregate";

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

interface RecentDistributionRow {
  id: string;
  name: string;
  token_symbol: string;
  token_decimals: number;
  total_amount: string;
  recipient_count: number;
  status: string;
  kind: "immediate" | "scheduled";
  created_at: string;
}

const toRecent = (row: RecentDistributionRow): RecentDistribution => ({
  id: row.id,
  name: row.name,
  tokenSymbol: row.token_symbol,
  tokenDecimals: row.token_decimals,
  totalAmount: row.total_amount,
  recipientCount: row.recipient_count,
  status: row.status,
  kind: row.kind,
  createdAt: row.created_at,
});

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const rows = (await db()`
    SELECT status, token_symbol, token_decimals, total_amount, kind
    FROM distributions
    WHERE user_id = ${userId} AND deleted_at IS NULL
  `) as DistributionRow[];
  return aggregateStats(rows);
}

export async function getRecentDistributions(
  userId: string,
  limit = 5,
): Promise<RecentDistribution[]> {
  const rows = (await db()`
    SELECT id, name, token_symbol, token_decimals, total_amount,
           recipient_count, status, kind, created_at
    FROM distributions
    WHERE user_id = ${userId} AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT ${limit}
  `) as RecentDistributionRow[];
  return rows.map(toRecent);
}

export const HISTORY_GROUPS = ["active", "scheduled", "completed", "failed"] as const;
export type HistoryGroup = (typeof HISTORY_GROUPS)[number];

const GROUP_STATUSES: Record<HistoryGroup, readonly string[]> = {
  active: ["submitted", "executing"],
  scheduled: ["draft", "ready", "funded"],
  completed: ["completed"],
  failed: ["failed", "partially_completed", "cancelled"],
};

export interface HistoryPage {
  rows: RecentDistribution[];
  total: number;
}

export async function getHistory(
  userId: string,
  opts: { group?: HistoryGroup; page?: number; pageSize?: number } = {},
): Promise<HistoryPage> {
  const { group, page = 1, pageSize = 20 } = opts;
  const offset = (page - 1) * pageSize;
  const statuses = group ? GROUP_STATUSES[group] : null;

  const rows = (await db()`
    SELECT id, name, token_symbol, token_decimals, total_amount,
           recipient_count, status, kind, created_at,
           count(*) OVER ()::int AS total_count
    FROM distributions
    WHERE user_id = ${userId}
      AND deleted_at IS NULL
      AND (${statuses}::text[] IS NULL OR status::text = ANY(${statuses}::text[]))
    ORDER BY created_at DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `) as (RecentDistributionRow & { total_count: number })[];

  return { total: rows[0]?.total_count ?? 0, rows: rows.map(toRecent) };
}
