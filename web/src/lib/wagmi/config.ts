import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { supportedChains } from "@/config/chains";

/**
 * wagmi config. Chains come from `supportedChains` — mainnet always, plus
 * testnet only when staging is explicitly enabled. A production build without
 * NEXT_PUBLIC_ENABLE_TESTNET is mainnet-only, so the app cannot connect to
 * any other network.
 *
 * The injected connector covers browser-extension wallets (MetaMask, Rabby).
 * Add WalletConnect once a project id is provisioned.
 */
export const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors: [injected({ shimDisconnect: true })],
  transports: Object.fromEntries(supportedChains.map((c) => [c.id, http()])),
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
