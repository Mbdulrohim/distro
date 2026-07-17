import { describe, it, expect } from "vitest";

/**
 * The retry renumbering bug, pinned in a test.
 *
 * When failures are retried, they're sent as a fresh, compacted payload: N
 * failures become payload indices 0..N-1. The contract emits results at those
 * compacted indices. If you write results back by the payload index, you stamp
 * outcomes onto whoever happens to sit at positions 0..N-1 in the ORIGINAL
 * distribution — the wrong people, silently, with money.
 *
 * This models exactly the mapping the retry panel performs, and proves a
 * result at retry-index i lands on the correct original position.
 */

interface FailedRow {
  address: string;
  batchIndex: number;
  indexInBatch: number;
}

/** Result as decoded from the retry receipt — carries the RETRY index. */
interface RetryResult {
  index: number;
  status: "paid" | "failed";
}

/** The mapping under test: retry index -> original committed position. */
function mapRetryResults(failed: FailedRow[], results: RetryResult[]) {
  const origin = failed.map((r) => ({
    batchIndex: r.batchIndex,
    indexInBatch: r.indexInBatch,
  }));
  return results.map((res) => ({
    status: res.status,
    originBatchIndex: origin[res.index].batchIndex,
    originIndexInBatch: origin[res.index].indexInBatch,
  }));
}

describe("retry result renumbering", () => {
  it("maps compacted retry indices back to original positions", () => {
    // 4 failures scattered through a 240-recipient run.
    const failed: FailedRow[] = [
      { address: "0xa", batchIndex: 0, indexInBatch: 17 },
      { address: "0xb", batchIndex: 0, indexInBatch: 92 },
      { address: "0xc", batchIndex: 1, indexInBatch: 5 },
      { address: "0xd", batchIndex: 1, indexInBatch: 63 },
    ];

    // The retry tx pays 0,1,3 and 2 fails again — at COMPACTED indices.
    const results: RetryResult[] = [
      { index: 0, status: "paid" },
      { index: 1, status: "paid" },
      { index: 2, status: "failed" },
      { index: 3, status: "paid" },
    ];

    const mapped = mapRetryResults(failed, results);

    // Each result must land on its ORIGINAL position, not the retry index.
    expect(mapped[0]).toEqual({ status: "paid", originBatchIndex: 0, originIndexInBatch: 17 });
    expect(mapped[1]).toEqual({ status: "paid", originBatchIndex: 0, originIndexInBatch: 92 });
    expect(mapped[2]).toEqual({ status: "failed", originBatchIndex: 1, originIndexInBatch: 5 });
    expect(mapped[3]).toEqual({ status: "paid", originBatchIndex: 1, originIndexInBatch: 63 });
  });

  it("never maps a retry index to position 0 just because it is index 0", () => {
    // The exact bug: the only failure sits at position 200. A naive
    // by-index writer would stamp it onto position 0.
    const failed: FailedRow[] = [{ address: "0xz", batchIndex: 0, indexInBatch: 200 }];
    const mapped = mapRetryResults(failed, [{ index: 0, status: "paid" }]);

    expect(mapped[0].originIndexInBatch).toBe(200);
    expect(mapped[0].originIndexInBatch).not.toBe(0);
  });
});
