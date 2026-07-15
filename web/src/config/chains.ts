import { defineChain } from "viem";

/**
 * Monad chain definitions. IDs are fixed protocol values, not configuration —
 * see the monskills `addresses` reference before touching these.
 * testnet = 10143, mainnet = 143.
 */

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC_URL ?? ""] },
  },
  testnet: true,
});

export const monadMainnet = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_MONAD_MAINNET_RPC_URL ?? ""] },
  },
});

export const activeChain =
  process.env.NEXT_PUBLIC_MONAD_CHAIN === "mainnet" ? monadMainnet : monadTestnet;
