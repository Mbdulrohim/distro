import "server-only";
import { createPublicClient, http, type PublicClient } from "viem";
import { supportedChains, isSupportedChain } from "@/config/chains";

/**
 * Server-side SIWE message verification.
 *
 * Verifies the signature AND enforces:
 *  - the nonce matches the one this server issued (replay protection),
 *  - the domain matches this deployment (phishing/rebinding protection),
 *  - the chain is one this build supports (see below).
 *
 * **Chain policy.** Mainnet is always accepted. Testnet is accepted only when
 * staging is explicitly enabled at build time, so a production deploy still
 * refuses any non-mainnet signature — the mainnet-only guarantee is intact,
 * it's just no longer hardcoded in three places.
 *
 * Verification runs against a client for the *signed* chain, so EIP-1271
 * (smart-contract wallet) signatures resolve against the right network. A
 * mainnet-client check of a testnet contract signature would wrongly fail.
 */

const clients = new Map<number, PublicClient>();
for (const chain of supportedChains) {
  clients.set(chain.id, createPublicClient({ chain, transport: http() }) as PublicClient);
}

export interface VerifyArgs {
  message: string;
  signature: `0x${string}`;
  expectedNonce: string;
  expectedDomain: string;
  /** Chain id parsed from the SIWE message. Must be supported. */
  chainId: number;
}

export async function verifySignIn({
  message,
  signature,
  expectedNonce,
  expectedDomain,
  chainId,
}: VerifyArgs): Promise<boolean> {
  const client = clients.get(chainId);
  // Defence in depth: the route checks this too, but a client lookup miss must
  // never silently fall back to a different chain's verifier.
  if (!client || !isSupportedChain(chainId)) return false;

  return client.verifySiweMessage({
    message,
    signature,
    nonce: expectedNonce,
    domain: expectedDomain,
  });
}
