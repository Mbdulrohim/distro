import { createConfig, http } from "wagmi";
import { monadMainnet, monadTestnet } from "@/config/chains";

/**
 * Foundation-only wagmi config: chains + transports, no connectors wired up
 * yet. Wallet connection goes through the monskills `wallet-integration`
 * (Para) skill when that work starts — do not hand-roll a connector set here.
 */
export const wagmiConfig = createConfig({
  chains: [monadTestnet, monadMainnet],
  transports: {
    [monadTestnet.id]: http(),
    [monadMainnet.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
