import { describe, it, expect } from "vitest";
import { mergeDuplicates } from "./merge";
import { formatAmount, formatAmountWithSymbol } from "./format";
import type { ValidRecipient } from "./types";

const r = (line: number, address: string, amount: bigint): ValidRecipient => ({
  line,
  address: address as `0x${string}`,
  amount,
  amountInput: String(amount),
});

const A = "0x1111111111111111111111111111111111111111";
const B = "0x2222222222222222222222222222222222222222";

describe("mergeDuplicates", () => {
  it("sums amounts for the same address, preserving first-seen order", () => {
    const merged = mergeDuplicates([r(1, A, 100n), r(2, B, 5n), r(3, A, 50n)]);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ address: A, amount: 150n, line: 1 });
    expect(merged[1]).toMatchObject({ address: B, amount: 5n });
  });

  it("is a no-op when there are no duplicates", () => {
    const input = [r(1, A, 1n), r(2, B, 2n)];
    expect(mergeDuplicates(input)).toEqual(input);
  });

  it("collapses three of the same address into one", () => {
    const merged = mergeDuplicates([r(1, A, 1n), r(2, A, 2n), r(3, A, 3n)]);
    expect(merged).toHaveLength(1);
    expect(merged[0].amount).toBe(6n);
  });
});

describe("formatAmount / formatAmountWithSymbol", () => {
  it("converts base units to human units against decimals", () => {
    expect(formatAmount(200_000_000n, 6)).toBe("200"); // USDC-style
    expect(formatAmount(1_500_000_000_000_000_000n, 18)).toBe("1.5");
  });

  it("groups thousands and appends the symbol", () => {
    expect(formatAmountWithSymbol(48_300_000_000n, 6, "USDC")).toBe("48,300 USDC");
    expect(formatAmountWithSymbol(1_234_500_000_000_000_000_000n, 18, "MON")).toBe("1,234.5 MON");
  });
});
