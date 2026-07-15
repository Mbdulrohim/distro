import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { monadMainnet } from "@/config/chains";

/**
 * Mainnet-only wagmi config. Single chain (Monad Mainnet, id 143) — the app
 * must never connect to any other network. The injected connector covers
 * browser-extension wallets (MetaMask, Rabby, etc.); add WalletConnect here
 * once a project id is provisioned (NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID).
 */
export const wagmiConfig = createConfig({
  chains: [monadMainnet],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [monadMainnet.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
