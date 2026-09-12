import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@govblock/ui"],
  // The block docs page reads each block's source at build time, and the
  // tracer, unable to scope that read, carried the whole project into the
  // compute bundle on every deploy (Next's own warning; Amplify's 220 MB cap,
  // jobs 255–257, 2026-09-11). The page is fully static and no other slug
  // exists, so at runtime it needs nothing traced at all.
  outputFileTracingExcludes: { "/docs/blocks/[slug]": ["**/*"] },
  // The inspector is development-only, and the guard inside it is not what
  // keeps it out of the build: an internal early return makes the body
  // unreachable while the module still ships (verified in 44b — its strings
  // survived into two production chunks). Aliasing the import to an empty stub
  // is what actually excludes it.
  turbopack: {
    resolveAlias:
      process.env.NODE_ENV === "development"
        ? {}
        : { "@/components/dev/inspector": "./components/dev/inspector.stub.tsx" },
  },
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
    turbopackMemoryLimit: 1024 * 1024 * 1024,
  },
  // Dev only, and the reason is the machine rather than the app (Brendan,
  // 2026-09-08, on an 8 GB Mac six days up with 46 million swapouts behind it).
  //
  // Next keeps the last `pagesBufferLength` routes compiled and drops anything
  // untouched for `maxInactiveAge`. The defaults are five routes and a minute,
  // which suit a laptop with room; this app has 75 pages and 25 API routes, and
  // wandering through ten of them holds ten module graphs at once. Two routes
  // and fifteen seconds is the setting for reading and editing one page at a
  // time. What it costs is a recompile when you go back to a page you left
  // sitting, which is why the age is thirty seconds and not the fifteen this
  // started at (Brendan, 2026-09-09) — worth measuring rather than trusting,
  // because the handler is
  // wired into Turbopack's hot reloader but how much it frees on the Rust side
  // is not something this note can promise.
  onDemandEntries: {
    maxInactiveAge: 30 * 1000,
    pagesBufferLength: 2,
  },
  // "View as Markdown": a page's address with .md on the end answers with the
  // page as markdown (app/api/markdown), for the pages that have one.
  // Headers every response carries (2026-09-12, after an audit found none):
  // nothing is sniffed into a script, and referrers stop at the origin. A
  // content-security policy is the next step and needs a pass over every
  // inline style the editors and the map emit before it can be strict.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ]
  },
  async rewrites() {
    return [{ source: "/:path*.md", destination: "/api/markdown/:path*" }]
  },
  // The record moved out of /docs (Brendan, 2026-09-10): a living page and the
  // documentation for installing it were competing for one name, and the page
  // was winning. Permanent, so the old paths do not linger as two ways to
  // reach the same thing.
  async redirects() {
    const moved: [string, string][] = [
      ["/docs/bills", "/bills"],
      ["/docs/committees", "/committees"],
      ["/docs/directory", "/members"],
      ["/docs/amendments", "/amendments"],
      ["/docs/departments", "/departments"],
      ["/docs/forms", "/forms"],
      ["/docs/hearings", "/hearings"],

      ["/docs/lobbying", "/lobbying"],
      ["/docs/meetings", "/meetings"],
      ["/docs/money", "/money"],
      ["/docs/nominations", "/nominations"],
      ["/docs/record", "/record"],
      ["/docs/reports", "/reports"],
      ["/docs/roll-call-votes", "/roll-call-votes"],
    ]
    return [
      ...moved.flatMap(([from, to]) => [
        { source: from, destination: to, permanent: true },
        { source: `${from}/:path*`, destination: `${to}/:path*`, permanent: true },
      ]),
      // The enacted stage came off the bills page on 2026-09-11 (Brendan:
      // "that tab doesn't belong there at all"); the old addresses land on
      // Congress's bills. /docs/laws went to /public-laws for a few hours on
      // 2026-09-10.
      { source: "/docs/laws", destination: "/bills/us", permanent: true },
      // /newsroom became /desk on 2026-09-11 (Brendan: "you've said desk so
      // many times"), a page per jurisdiction in the path.
      { source: "/newsroom", has: [{ type: "query", key: "state", value: "(?<state>[A-Za-z]{2})" }], destination: "/desk/:state", permanent: true },
      { source: "/newsroom", destination: "/desk", permanent: true },
      { source: "/public-laws", destination: "/bills/us", permanent: true },
      // The old combined browser is the Tags page; a term's own page is now
      // filed under the kind it is.
      { source: "/docs/subjects", destination: "/tags", permanent: true },
      {
        source: "/docs/subjects/:state/:slug",
        destination: "/policy-areas/:state/:slug",
        permanent: true,
      },
    ]
  },
  // The in-memory response cache, 50 MB by default. Small next to the rest, and
  // free to give up while exploring: nothing here is measured on a warm cache.
  cacheMaxMemorySize: 0,
}

export default nextConfig
