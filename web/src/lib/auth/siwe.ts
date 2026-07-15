import "server-only";
import { createPublicClient, http } from "viem";
import { monadMainnet, MONAD_MAINNET_CHAIN_ID } from "@/config/chains";

/**
 * Server-side SIWE message verification, bound to Monad Mainnet.
 *
 * Verifies the signature AND enforces:
 *  - the nonce matches the one this server issued (replay protection),
 *  - the domain matches this deployment (phishing/rebinding protection),
 *  - the chain id is Monad Mainnet (143) — mainnet-only requirement.
 *
 * Uses a public client so EIP-1271 (smart-contract wallet) signatures verify
 * too, not just EOA signatures.
 */

const publicClient = createPublicClient({
  chain: monadMainnet,
  transport: http(),
});

export interface VerifyArgs {
  message: string;
  signature: `0x${string}`;
  expectedNonce: string;
  expectedDomain: string;
}

export async function verifySignIn({
  message,
  signature,
  expectedNonce,
  expectedDomain,
}: VerifyArgs): Promise<boolean> {
  return publicClient.verifySiweMessage({
    message,
    signature,
    nonce: expectedNonce,
    domain: expectedDomain,
  });
}

export { MONAD_MAINNET_CHAIN_ID };
