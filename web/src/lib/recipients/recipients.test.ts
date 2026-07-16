import { describe, it, expect } from "vitest";
import { parseRecipients } from "./parse";
import { validateRecipients, MAX_AMOUNT } from "./validate";
import { encodeEntry, encodePayload, splitIntoBatches } from "./encode";

/**
 * The canonical fixture. The SAME address+amount and the SAME expected bytes
 * are asserted in the Foundry suite (contracts/test/Multisend.encoding.t.sol),
 * proving the TS encoder and the Solidity decoder agree byte-for-byte. If you
 * change one side, this fixture must fail on the other.
 */
const FIXTURE_ADDRESS = "0x1111111111111111111111111111111111111111" as const;
const FIXTURE_AMOUNT = 1_000_000_000_000_000_000n; // 1e18 (1 token at 18 decimals)
const FIXTURE_ENTRY_HEX =
  "0x111111111111111111111111111111111111111100000000000000000de0b6b3a7640000";

describe("encode — canonical payload (cross-checked with Multisend.sol)", () => {
  it("encodes one entry as 36 bytes: address(20) ‖ uint128 amount(16)", () => {
    const hex = encodeEntry({ address: FIXTURE_ADDRESS, amount: FIXTURE_AMOUNT });
    expect(hex).toBe(FIXTURE_ENTRY_HEX);
    expect((hex.length - 2) / 2).toBe(36);
  });

  it("concatenates entries in order", () => {
    const payload = encodePayload([
      { address: FIXTURE_ADDRESS, amount: FIXTURE_AMOUNT },
      { address: "0x2222222222222222222222222222222222222222", amount: 2n },
    ]);
    expect(payload.startsWith(FIXTURE_ENTRY_HEX)).toBe(true);
    expect((payload.length - 2) / 2).toBe(72);
  });

  it("rejects an amount over uint128", () => {
    expect(() => encodeEntry({ address: FIXTURE_ADDRESS, amount: MAX_AMOUNT + 1n })).toThrow();
  });

  it("rejects an empty payload", () => {
    expect(() => encodePayload([])).toThrow();
  });
});

describe("splitIntoBatches", () => {
  const entries = Array.from({ length: 250 }, (_, i) => ({
    address: `0x${(i + 1).toString(16).padStart(40, "0")}` as `0x${string}`,
    amount: 1n,
  }));

  it("splits by maxPerBatch and preserves order", () => {
    const batches = splitIntoBatches(entries, 100);
    expect(batches.map((b) => b.entries.length)).toEqual([100, 100, 50]);
    expect(batches[0].index).toBe(0);
    // First entry of batch 1 is the 101st overall.
    expect(batches[1].entries[0].address).toBe(entries[100].address);
  });

  it("rejects a non-positive batch size", () => {
    expect(() => splitIntoBatches(entries, 0)).toThrow();
  });
});

describe("parse", () => {
  it("parses address,amount lines, skipping a header and blank lines", () => {
    const rows = parseRecipients(
      "address,amount\n0x1111111111111111111111111111111111111111,200\n\n0x2222222222222222222222222222222222222222,50\n",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ line: 2, addressInput: expect.stringContaining("0x1111") });
  });

  it("tolerates a BOM, CRLF, and tab/semicolon separators", () => {
    const rows = parseRecipients(
      "﻿0x1111111111111111111111111111111111111111\t200\r\n0x2222222222222222222222222222222222222222;50",
    );
    expect(rows).toHaveLength(2);
    expect(rows[1].amountInput).toBe("50");
  });

  it("preserves a row missing its amount for validation to flag", () => {
    const rows = parseRecipients("0x1111111111111111111111111111111111111111");
    expect(rows[0].amountInput).toBe("");
  });
});

describe("validate", () => {
  const A = "0x1111111111111111111111111111111111111111";
  const B = "0x2222222222222222222222222222222222222222";

  it("accepts valid rows and sums the total in base units", () => {
    const res = validateRecipients(
      [
        { line: 1, addressInput: A, amountInput: "1.5" },
        { line: 2, addressInput: B, amountInput: "2" },
      ],
      18,
    );
    expect(res.ok).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(res.total).toBe(3_500_000_000_000_000_000n);
    expect(res.valid[0].amount).toBe(1_500_000_000_000_000_000n);
  });

  it("converts against token decimals", () => {
    const res = validateRecipients([{ line: 1, addressInput: A, amountInput: "200" }], 6);
    expect(res.valid[0].amount).toBe(200_000_000n); // 200 * 10^6 (USDC-style)
  });

  it("flags invalid addresses, zero, non-numeric, and over-max amounts", () => {
    const res = validateRecipients(
      [
        { line: 1, addressInput: "0xnope", amountInput: "1" },
        { line: 2, addressInput: A, amountInput: "0" },
        { line: 3, addressInput: B, amountInput: "abc" },
        { line: 4, addressInput: A, amountInput: "999999999999999999999999999999999999999999" },
      ],
      18,
    );
    expect(res.ok).toBe(false);
    const codes = res.errors.map((e) => e.code).sort();
    expect(codes).toEqual(["amount-too-large", "invalid-address", "invalid-amount", "zero-amount"]);
  });

  it("flags a row missing fields", () => {
    const res = validateRecipients([{ line: 1, addressInput: A, amountInput: "" }], 18);
    expect(res.errors[0].code).toBe("missing-fields");
  });

  it("warns on duplicate addresses without blocking (paying twice is legal)", () => {
    const res = validateRecipients(
      [
        { line: 1, addressInput: A, amountInput: "1" },
        { line: 2, addressInput: A, amountInput: "2" },
      ],
      18,
    );
    expect(res.ok).toBe(true);
    expect(res.duplicates).toHaveLength(1);
    expect(res.duplicates[0].lines).toEqual([1, 2]);
    expect(res.total).toBe(3_000_000_000_000_000_000n);
  });

  it("checksums addresses in the valid output", () => {
    const res = validateRecipients(
      [{ line: 1, addressInput: A.toLowerCase(), amountInput: "1" }],
      18,
    );
    expect(res.valid[0].address).toBe(A);
  });
});
