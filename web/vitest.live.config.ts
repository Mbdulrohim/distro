import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Config for LIVE tests that hit a real Monad RPC (`*.live.test.ts`).
 *
 * Separate from vitest.config.ts because the default suite excludes these —
 * an offline CI run must not fail on a network blip. Run deliberately:
 *
 *     npm run verify:tokens
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.live.test.ts"],
    // Real network round-trips; the default 5s is tight for a cold RPC.
    testTimeout: 30_000,
  },
});
