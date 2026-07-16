import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // `*.live.test.ts` hits a real RPC and is therefore not part of the offline
    // unit suite (CI would fail on a network blip, not a real defect). Run it
    // deliberately with `npm run verify:tokens`.
    exclude: ["**/node_modules/**", "**/*.live.test.ts"],
  },
});
