import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root explicitly — otherwise Next.js can misdetect it
  // when an unrelated lockfile exists further up the directory tree (e.g. in
  // the user's home directory), which breaks file tracing during build.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
