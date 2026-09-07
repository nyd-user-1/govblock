import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@govblock/ui"],
  experimental: {
    // The /docs pages prerender against the live database. Eight at a time per
    // worker was the default; against a just-resumed Aurora that stampede is
    // what made every page take over a minute (job 193, 2026-09-03).
    staticGenerationMaxConcurrency: 3,
    staticGenerationRetryCount: 3,
    // The dev server on an 8 GB Mac (Brendan, 2026-09-07: "it can't go above
    // 2-3 GB"). Next 16 keeps Turbopack's dev cache on disk between runs —
    // 11 GB under .next/dev after one day — and maps it back in at start, so
    // a fresh server opened at 5 GB. Off. And Turbopack drops what it has
    // compiled once it holds this much, rather than growing without bound.
    turbopackFileSystemCacheForDev: false,
    turbopackMemoryLimit: 1536 * 1024 * 1024,
  },
}

export default nextConfig
