import { monad, monadTestnet as viemMonadTestnet } from "viem/chains";
import type { Chain } from "viem";

/**
 * Chain configuration.
 *
 * **Monad Mainnet is the product** (docs/PRD.md, and Feature 1's explicit
 * "mainnet only" requirement). Testnet exists solely as a staging environment
 * for proving the execution path before an audit — docs/ARCHITECTURE.md calls
 * for exactly this separation ("fully separated testnet/staging vs mainnet,
 * separate deployed contract addresses, no shared state").
 *
 * Testnet is **opt-in via env and off by default**, so production cannot
 * silently accept a non-mainnet signature: the flag is read at build time and
 * a production deploy without it is mainnet-only, exactly as before.
 *
 * Chain data comes from viem's built-in definitions — never hand-rolled. An
 * operator-supplied RPC URL overrides the public default when provided.
 */

const STAGING_ENABLED = process.env.NEXT_PUBLIC_ENABLE_TESTNET === "true";

function withRpc(chain: Chain, override?: string): Chain {
  if (!override) return chain;
  return { ...chain, rpcUrls: { ...chain.rpcUrls, default: { http: [override] } } };
}

export const monadMainnet: Chain = withRpc(monad, process.env.NEXT_PUBLIC_MONAD_MAINNET_RPC_URL);

export const monadTestnet: Chain = withRpc(
  viemMonadTestnet,
  process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC_URL,
);

export const MONAD_MAINNET_CHAIN_ID = monad.id; // 143
export const MONAD_TESTNET_CHAIN_ID = viemMonadTestnet.id; // 10143

/** True when staging (testnet) is enabled for this build. */
export const isStagingEnabled = STAGING_ENABLED;

/**
 * Chains this build accepts. Mainnet is always first — it is the default the
 * wallet is asked to switch to, and the only chain in a production build.
 */
export const supportedChains: readonly [Chain, ...Chain[]] = STAGING_ENABLED
  ? [monadMainnet, monadTestnet]
  : [monadMainnet];

export const supportedChainIds: number[] = supportedChains.map((c) => c.id);

/** Single source of truth for "is this chain allowed?" — used by auth and UI alike. */
export function isSupportedChain(chainId: number | undefined): boolean {
  return chainId !== undefined && supportedChainIds.includes(chainId);
}

/** Human label for a chain id, for error copy. */
export function chainLabel(chainId: number): string {
  return supportedChains.find((c) => c.id === chainId)?.name ?? `chain ${chainId}`;
}
