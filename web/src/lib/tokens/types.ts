/**
 * Token model for distribution. Two kinds exist and they are not
 * interchangeable:
 *
 *  - **ERC-20** — distributable today. `Multisend` moves them with
 *    `transferFrom`, so a failed transfer leaves the tokens in the sender's
 *    wallet and the contract's balance is always zero.
 *  - **Native MON** — NOT distributable by the current contract. Sending it
 *    requires `msg.value` to enter the contract up front, so a failed transfer
 *    strands funds there, breaking the zero-balance invariant that lets
 *    `Multisend` be stateless. See docs/CONTRACT_SPEC.md (open question O5).
 *    MON is distributed as **WMON** (wrapped) instead — the standard WETH
 *    pattern.
 */

/** Sentinel for the chain's native currency (MON). Not a real contract. */
export const NATIVE_SENTINEL = "native" as const;

export type TokenRef = `0x${string}` | typeof NATIVE_SENTINEL;

export interface RegistryToken {
  ref: TokenRef;
  /** Expected symbol, used to cross-check the on-chain value. */
  symbol: string;
  name: string;
  /** True only for native MON. */
  isNative: boolean;
  /**
   * Whether this token can actually be distributed by the current contract.
   * Native MON is false — see the note above.
   */
  distributable: boolean;
  /** Shown when `distributable` is false, so the UI never dead-ends. */
  unsupportedReason?: string;
}

/** A token resolved against the chain — decimals are always read, never assumed. */
export interface ResolvedToken {
  ref: TokenRef;
  address?: `0x${string}`;
  symbol: string;
  decimals: number;
  isNative: boolean;
  distributable: boolean;
  unsupportedReason?: string;
}

export interface TokenSelection extends ResolvedToken {
  /** Creator's balance in base units, if loaded. */
  balance?: bigint;
}
