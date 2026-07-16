import { describe, it, expect } from "vitest";
import { createPublicClient, http, erc20Abi } from "viem";
import { monad } from "viem/chains";
import { getSupportedTokens } from "./registry";
import { NATIVE_SENTINEL } from "./types";

/**
 * LIVE verification of the token registry against Monad Mainnet.
 *
 * Excluded from the offline unit suite (vitest.config.ts) because it needs a
 * real RPC — run it deliberately:
 *
 *     npm run verify:tokens
 *
 * This exists because the registry's addresses were transcribed from the
 * monskills canonical table but could NOT be verified on-chain at authoring
 * time (the RPC was unreachable from that environment). A wrong token address
 * in a payroll product means users approve and send to the wrong contract, so
 * "we'll check later" needed to be an executable check, not a comment.
 *
 * **This must pass before mainnet launch.**
 */

const client = createPublicClient({
  chain: monad,
  transport: http(process.env.NEXT_PUBLIC_MONAD_MAINNET_RPC_URL || undefined),
});

const tokens = getSupportedTokens(monad.id).filter((t) => t.ref !== NATIVE_SENTINEL);

describe("token registry — live Monad Mainnet verification", () => {
  it("has tokens to verify", () => {
    expect(tokens.length).toBeGreaterThan(0);
  });

  for (const token of tokens) {
    describe(`${token.symbol} (${token.ref})`, () => {
      const address = token.ref as `0x${string}`;

      it("has contract code deployed", async () => {
        const code = await client.getCode({ address });
        expect(code, `no code at ${address} — the address is wrong`).toBeDefined();
        expect(code).not.toBe("0x");
      });

      it("reports the expected symbol", async () => {
        const symbol = await client.readContract({
          address,
          abi: erc20Abi,
          functionName: "symbol",
        });
        // The registry's symbol is an expectation; a mismatch means the address
        // is wrong or points at a look-alike. Fail loudly.
        expect(symbol.toLowerCase()).toBe(token.symbol.toLowerCase());
      });

      it("reports plausible decimals", async () => {
        const decimals = await client.readContract({
          address,
          abi: erc20Abi,
          functionName: "decimals",
        });
        expect(decimals).toBeGreaterThanOrEqual(0);
        expect(decimals).toBeLessThanOrEqual(36);
      });
    });
  }
});
