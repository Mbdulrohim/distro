import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root explicitly — otherwise Next.js can misdetect it
  // when an unrelated lockfile exists further up the directory tree (e.g. in
  // the user's home directory), which breaks file tracing during build.
  outputFileTracingRoot: path.join(__dirname),

  webpack: (config) => {
    // @wagmi/connectors ships an experimental "Tempo wallet" connector that
    // does an optional `import('accounts')` marked with a Turbopack-only hint
    // (`turbopackOptional`). Under webpack that optional dep hard-errors as
    // "Module not found: 'accounts'", even though it's never used. We don't
    // use the Tempo connector, so resolve it to an empty module.
    config.resolve.fallback = { ...config.resolve.fallback, accounts: false };
    return config;
  },
};

export default nextConfig;
