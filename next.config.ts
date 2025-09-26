import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    turbo: {
      // Treat this folder as turbopack root to avoid monorepo detection warning locally
      root: __dirname,
    },
  },
};

export default nextConfig;
