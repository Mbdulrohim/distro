import { describe, it, expect } from "vitest";
import { aggregateStats, type DistributionRow } from "./aggregate";

const row = (
  status: string,
  token_symbol = "USDC",
  total_amount = "0",
  token_decimals = 6,
): DistributionRow => ({ status, token_symbol, token_decimals, total_amount });

describe("aggregateStats — counters", () => {
  it("counts each status into the right bucket", () => {
    const s = aggregateStats([
      row("draft"),
      row("draft"),
      row("submitted"),
      row("completed"),
      row("failed"),
    ]);
    expect(s.drafts).toBe(2);
    expect(s.inFlight).toBe(1);
    expect(s.completed).toBe(1);
    expect(s.failed).toBe(1);
  });

  it("counts a partial run as needing attention, not as completed", () => {
    const s = aggregateStats([row("partially_completed")]);
    expect(s.completed).toBe(0);
    expect(s.failed).toBe(1);
  });

  it("returns zeroes for no distributions", () => {
    const s = aggregateStats([]);
    expect(s).toEqual({
      totalDistributed: [],
      inFlight: 0,
      completed: 0,
      failed: 0,
      drafts: 0,
    });
  });
});

describe("aggregateStats — total distributed", () => {
  it("sums only money that actually moved", () => {
    const s = aggregateStats([
      row("completed", "USDC", "100"),
      row("partially_completed", "USDC", "50"),
      row("submitted", "USDC", "999"), // outcome unknown — must not count
      row("draft", "USDC", "999"), // never sent
      row("failed", "USDC", "999"), // nothing moved
    ]);
    expect(s.totalDistributed).toEqual([{ tokenSymbol: "USDC", tokenDecimals: 6, total: "150" }]);
  });

  it("groups by token instead of summing across them", () => {
    const s = aggregateStats([
      row("completed", "USDC", "100", 6),
      row("completed", "MON", "200", 18),
    ]);
    expect(s.totalDistributed).toHaveLength(2);
    expect(s.totalDistributed).toContainEqual({
      tokenSymbol: "USDC",
      tokenDecimals: 6,
      total: "100",
    });
    expect(s.totalDistributed).toContainEqual({
      tokenSymbol: "MON",
      tokenDecimals: 18,
      total: "200",
    });
  });

  it("keeps full precision past Number.MAX_SAFE_INTEGER", () => {
    // ~1.23M tokens at 18dp. Number() would round this and silently lose money.
    const big = "1234567890123456789012345";
    const s = aggregateStats([row("completed", "MON", big, 18), row("completed", "MON", "1", 18)]);
    expect(s.totalDistributed[0].total).toBe("1234567890123456789012346");
    // Why bigint is mandatory: Number cannot even distinguish x from x+1 at
    // this magnitude — both collapse to the same float. A Number-based sum
    // would lose a whole token and report the loss as success.
    expect(Number(big)).toBe(Number("1234567890123456789012346"));
    expect(BigInt(big)).not.toBe(BigInt("1234567890123456789012346"));
  });

  it("is empty when nothing has been paid out", () => {
    expect(aggregateStats([row("draft"), row("submitted")]).totalDistributed).toEqual([]);
  });
});
