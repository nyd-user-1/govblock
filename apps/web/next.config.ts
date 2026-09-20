import type { NextConfig } from "next"

// The dev box (Brendan, 2026-09-13: "maximize speed of page load"). The EC2
// machine behind localhost:3001 has 16 GB and nothing else to do, so the
// limits below — every one of them chosen for an 8 GB Mac — loosen there.
// Its service unit sets this; the Mac never does. Loosen, not lift: on the
// 16 GB box, 120 routes kept for eight hours and every route warmed put the
// server at 14.3 GB and the box 6.5 GB into swap inside ninety minutes, which
// read as "sluggish again". The box is 32 GB since 2026-09-13, which is what
// the numbers below assume. The on-disk compile cache stays off even there:
// the disk is 82% full and the cache reached 11 GB in a day on the Mac.
const ROOMY = process.env.GOVBLOCK_DEV_BOX === "1"

// The public bucket's folder for the files that left public/, as lib/assets.ts has it.
const ASSET_BASE = process.env.NEXT_PUBLIC_ASSET_BASE ?? "https://govblock-geo-638175140432.s3.amazonaws.com/public"

const nextConfig: NextConfig = {
  // @aws-sdk/client-s3 is bundled, not left external (2026-09-15): two copies
  // resolve in the workspace (Remotion carries its own), so Turbopack named the
  // external with a hash the deployment's node_modules never carried, and every
  // route that reads the XML store answered "Internal Server Error" on Amplify.
  transpilePackages: ["@govblock/ui", "@aws-sdk/client-s3"],
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
    turbopackMemoryLimit: (ROOMY ? 4 : 1) * 1024 * 1024 * 1024,
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
  //
  // On the box: the last sixty routes stay compiled for two hours, so going
  // back to a page costs its render and nothing more.
  onDemandEntries: {
    maxInactiveAge: ROOMY ? 2 * 60 * 60 * 1000 : 30 * 1000,
    pagesBufferLength: ROOMY ? 60 : 2,
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
      // The changelogs renamed (Brendan, 2026-09-20): GovBlock's own release
      // notes went to /govblock-changelog so the second bill-stream changelog
      // could take /changelog; the first went to the lab, and its address
      // follows the second.
      { source: "/docs/changelog-v2", destination: "/changelog", permanent: false },
      { source: "/docs/changelog", destination: "/changelog", permanent: false },
      // /newsroom became /desk on 2026-09-11 (Brendan: "you've said desk so
      // many times"), a page per jurisdiction in the path.
      { source: "/newsroom", has: [{ type: "query", key: "state", value: "(?<state>[A-Za-z]{2})" }], destination: "/desk/:state", permanent: true },
      { source: "/newsroom", destination: "/desk", permanent: true },
      { source: "/public-laws", destination: "/bills/us", permanent: true },
      // The heavier static files moved to the public bucket (2026-09-19,
      // lib/assets.ts); their old addresses follow them there: the registry
      // that v0 and the shadcn CLI fetch, links to the PDFs and reports. Not
      // permanent, so the bucket can move again. /forms and /reports are pages
      // too, and only their files go.
      ...["chambers", "seals", "unite", "r"].map((folder) => ({ source: `/${folder}/:path*`, destination: `${ASSET_BASE}/${folder}/:path*`, permanent: false })),
      { source: "/forms/:file([^/]+\\.pdf)", destination: `${ASSET_BASE}/forms/:file`, permanent: false },
      { source: "/reports/:file([^/]+\\.pdf)", destination: `${ASSET_BASE}/reports/:file`, permanent: false },
      { source: "/reports/:file([^/]+\\.html)", destination: `${ASSET_BASE}/reports/:file`, permanent: false },
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
