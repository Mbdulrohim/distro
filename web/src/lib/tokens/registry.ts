import { MONAD_MAINNET_CHAIN_ID } from "@/config/chains";
import { NATIVE_SENTINEL, type RegistryToken } from "./types";

/**
 * Supported-token registry for Monad Mainnet (143).
 *
 * PROVENANCE — read before touching this file.
 * Every address below comes from the monskills `addresses` skill's canonical
 * Monad-mainnet table (the source CLAUDE.md mandates). None were invented, and
 * none may be added from memory: a wrong token address in a payroll product
 * means users approve and send to the wrong contract.
 *
 * ⚠️ NOT YET INDEPENDENTLY VERIFIED ON-CHAIN. Verification (`cast code` +
 * `symbol()` against rpc.monad.xyz) could not run in the environment these were
 * added from — DNS could not resolve the RPC. Run `npm run verify:tokens`
 * before mainnet launch and record the result here.
 *
 * Two deliberate safeguards make an unverified entry fail safe rather than
 * silently move money:
 *  1. `decimals` is absent by design — always read on-chain (useTokenInfo). A
 *     wrong decimals value is a 10^n money bug.
 *  2. `symbol` is an *expectation*, cross-checked against the on-chain
 *     `symbol()` at resolve time. A wrong address mismatches and is refused.
 */

const MONAD_MAINNET_TOKENS: RegistryToken[] = [
  {
    ref: NATIVE_SENTINEL,
    symbol: "MON",
    name: "Monad",
    isNative: true,
    // Shown with its balance (users hold MON for gas), but not distributable —
    // the contract has no native path. WMON is the distributable form.
    distributable: false,
    unsupportedReason:
      "Native MON can't be distributed directly — distribute WMON (Wrapped MON) instead.",
  },
  {
    ref: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A",
    symbol: "WMON",
    name: "Wrapped MON",
    isNative: false,
    distributable: true,
  },
  {
    ref: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
    symbol: "USDC",
    name: "USD Coin",
    isNative: false,
    distributable: true,
  },
  {
    ref: "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
    symbol: "USDT0",
    name: "Tether USD",
    isNative: false,
    distributable: true,
  },
  {
    ref: "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a",
    symbol: "AUSD",
    name: "Agora USD",
    isNative: false,
    distributable: true,
  },
  {
    ref: "0xEE8c0E9f1BFFb4Eb878d8f15f368A02a35481242",
    symbol: "WETH",
    name: "Wrapped Ether",
    isNative: false,
    distributable: true,
  },
  {
    ref: "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c",
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    isNative: false,
    distributable: true,
  },
];

/** Supported tokens for a chain. Any other token is usable via custom address. */
export function getSupportedTokens(chainId: number): RegistryToken[] {
  return chainId === MONAD_MAINNET_CHAIN_ID ? MONAD_MAINNET_TOKENS : [];
}

/** Registry entry for a ref, if it's a known token. */
export function findRegistryToken(chainId: number, ref: string): RegistryToken | undefined {
  return getSupportedTokens(chainId).find((t) => t.ref.toLowerCase() === ref.toLowerCase());
}
