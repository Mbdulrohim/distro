import { monad } from "viem/chains";
import type { Chain } from "viem";

/**
 * Monad Mainnet only. DISTRO is a mainnet product (see docs/PRD.md) and
 * Feature 1 is explicitly mainnet-only — there is intentionally no testnet
 * chain in the active config.
 *
 * Chain id 143 and the canonical RPC/explorer set come from viem's built-in
 * `monad` chain, not a hand-rolled definition — do not hardcode chain data.
 * An operator-supplied RPC URL (private/rate-limited endpoint) overrides the
 * public default when provided.
 */
const rpcOverride = process.env.NEXT_PUBLIC_MONAD_MAINNET_RPC_URL;

export const monadMainnet: Chain = rpcOverride
  ? {
      ...monad,
      rpcUrls: {
        ...monad.rpcUrls,
        default: { http: [rpcOverride] },
      },
    }
  : monad;

export const MONAD_MAINNET_CHAIN_ID = monad.id; // 143
