import type { MetadataRoute } from "next"

// robots.txt (Brendan, 2026-09-14): every crawler off the whole site until
// further notice. The site had none, and the access log for the night of
// 2026-09-14 showed ClaudeBot walking 2,444 bill, committee and lobbying
// pages in twenty minutes, each a fresh read of the bill's text and its
// lobbying joins on the cluster the pipeline was writing to. Search engines
// come back when he says so.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] }
}
