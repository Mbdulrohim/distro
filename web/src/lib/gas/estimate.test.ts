import { describe, it, expect } from "vitest";
import {
  estimateGasLimit,
  maxRecipientsPerBatch,
  planBatches,
  estimateCostWei,
  MONAD_TX_GAS_LIMIT,
  MEASURED_GAS_PER_RECIPIENT,
  CONSERVATIVE_GAS_PER_RECIPIENT,
} from "./estimate";

describe("estimateGasLimit", () => {
  it("is zero for an empty distribution", () => {
    expect(estimateGasLimit(0)).toBe(0n);
  });

  /// The floor (100k) exceeds a transfer's real cost (~31k), so a small batch
  /// is dominated by headroom the last transfer never spends.
  it("carries the contract's gas floor as headroom", () => {
    const oneRecipient = estimateGasLimit(1, MEASURED_GAS_PER_RECIPIENT);
    expect(oneRecipient).toBeGreaterThan(100_000n);
  });

  it("grows linearly with recipients", () => {
    const a = estimateGasLimit(100, MEASURED_GAS_PER_RECIPIENT);
    const b = estimateGasLimit(200, MEASURED_GAS_PER_RECIPIENT);
    expect(b - a).toBe(MEASURED_GAS_PER_RECIPIENT * 100n);
  });

  /// Cross-check against the real fork measurement: 200 real-USDC recipients
  /// consumed 6,335,797 gas. The estimate must cover it, and not by a mile.
  it("matches the measured 200-recipient run within the floor's headroom", () => {
    const measured = 6_335_797n;
    const estimate = estimateGasLimit(200, MEASURED_GAS_PER_RECIPIENT);
    expect(estimate).toBeGreaterThanOrEqual(measured);
    // Overhead is the floor minus a transfer's real cost — ~69k, ~1% here.
    expect(estimate - measured).toBeLessThan(100_000n);
  });
});

describe("maxRecipientsPerBatch", () => {
  it("keeps a full batch inside Monad's 30M per-tx cap", () => {
    for (const perRecipient of [MEASURED_GAS_PER_RECIPIENT, CONSERVATIVE_GAS_PER_RECIPIENT]) {
      const max = maxRecipientsPerBatch(perRecipient);
      expect(estimateGasLimit(max, perRecipient)).toBeLessThan(MONAD_TX_GAS_LIMIT);
    }
  });

  /// A heavier token must yield smaller batches — sizing every batch off USDC
  /// would overflow the cap on a token with more storage reads, reverting the
  /// run *after* the user already paid for the limit.
  it("shrinks batches for heavier tokens", () => {
    expect(maxRecipientsPerBatch(CONSERVATIVE_GAS_PER_RECIPIENT)).toBeLessThan(
      maxRecipientsPerBatch(MEASURED_GAS_PER_RECIPIENT),
    );
  });
});

describe("planBatches", () => {
  it("uses a single batch for a typical payroll", () => {
    const plan = planBatches(200);
    expect(plan.batchCount).toBe(1);
    expect(plan.batchSize).toBe(200);
  });

  it("splits when a distribution exceeds one transaction", () => {
    const max = maxRecipientsPerBatch();
    const plan = planBatches(max * 2 + 5);
    expect(plan.batchCount).toBe(3);
    expect(plan.batchSize).toBe(max);
  });

  it("every batch fits the per-tx cap", () => {
    for (const n of [1, 50, 500, 1000, 5000]) {
      const plan = planBatches(n);
      expect(plan.gasLimitPerBatch).toBeLessThan(MONAD_TX_GAS_LIMIT);
    }
  });

  it("accounts for a smaller final batch rather than over-charging it", () => {
    const max = maxRecipientsPerBatch();
    const plan = planBatches(max + 1);
    expect(plan.batchCount).toBe(2);
    // The tail batch has one recipient, so the total must be far below two
    // full batches — on Monad that difference is money.
    expect(plan.totalGasLimit).toBeLessThan(plan.gasLimitPerBatch * 2n);
  });

  it("is empty for zero recipients", () => {
    expect(planBatches(0)).toMatchObject({ batchCount: 0, totalGasLimit: 0n });
  });
});

describe("estimateCostWei", () => {
  /// Monad's minimum base fee is 100 gwei, and it charges the LIMIT.
  it("prices from the gas limit, not gas used", () => {
    const gasPrice = 100_000_000_000n; // 100 gwei
    const plan = planBatches(200, MEASURED_GAS_PER_RECIPIENT);
    const cost = estimateCostWei(plan.totalGasLimit, gasPrice);
    expect(cost).toBe(plan.totalGasLimit * gasPrice);
    // Sanity: a 200-person payroll is well under 1 MON at the floor price.
    expect(cost).toBeLessThan(10n ** 18n);
  });
});
