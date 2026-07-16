/**
 * Types for the recipient pipeline: raw import → validated rows → canonical
 * payload. Amounts are handled in two representations and never confused:
 *  - `amountInput`  — the human string the user typed ("200.5").
 *  - `amount`       — base units as a bigint, derived against token decimals.
 * The database and the contract only ever see base units.
 */

/** A row as parsed from CSV/paste, before validation. */
export interface RawRecipient {
  /** 1-based line number in the source, for error reporting. */
  line: number;
  /** Raw address string, untrimmed of case (checksum validated later). */
  addressInput: string;
  /** Raw amount string in human units. */
  amountInput: string;
}

export type RecipientErrorCode =
  "invalid-address" | "invalid-amount" | "zero-amount" | "amount-too-large" | "missing-fields";

export interface RecipientError {
  line: number;
  code: RecipientErrorCode;
  message: string;
}

/** A row that passed all per-row checks. */
export interface ValidRecipient {
  line: number;
  /** Checksummed address. */
  address: `0x${string}`;
  /** Base units. */
  amount: bigint;
  /** Echoed human input, for display in the review table. */
  amountInput: string;
}

export interface DuplicateWarning {
  address: `0x${string}`;
  /** Lines on which this address appears (length ≥ 2). */
  lines: number[];
}

export interface ValidationResult {
  valid: ValidRecipient[];
  errors: RecipientError[];
  /** Non-blocking: duplicates are legal by design (a creator may pay twice). */
  duplicates: DuplicateWarning[];
  /** Sum of all valid amounts, base units. */
  total: bigint;
  /** True when there are zero blocking errors. */
  ok: boolean;
}

/** One recipient's contribution to a distribution payload. */
export interface PayloadEntry {
  address: `0x${string}`;
  amount: bigint;
}

/** A single `distribute` transaction's worth of recipients. */
export interface Batch {
  index: number;
  entries: PayloadEntry[];
  /** The canonical bytes for this batch, ready to pass to `distribute`. */
  payload: `0x${string}`;
}
