import type { MetadataRoute } from "next"

// robots.txt (the lead, night of 2026-09-14): the site had none, and the
// access log showed ClaudeBot walking 2,444 bill, committee and lobbying
// pages in twenty minutes, each a fresh read of the bill's text and its
// lobbying joins on a cluster the pipeline was also writing to. AI crawlers
// are kept off the site; every other crawler is kept off the API, the
// workspace and the doors, which are not pages to index. Search engines
// keep the record pages. Brendan decides whether this ships to main.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: ["ClaudeBot", "Claude-Web", "anthropic-ai", "GPTBot", "ChatGPT-User", "CCBot", "Bytespider", "PerplexityBot", "Amazonbot", "Applebot-Extended", "Google-Extended"], disallow: "/" },
      { userAgent: "*", disallow: ["/api/", "/workspace/", "/auth", "/plan", "/signed-out", "/erd", "/routes"] },
    ],
  }
}
