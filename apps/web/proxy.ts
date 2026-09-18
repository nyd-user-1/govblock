import { NextResponse, type NextRequest } from "next/server"

// Every crawler off the site, enforced (Brendan, 2026-09-17: "block them
// all"). robots.txt asks; this refuses. A request whose user agent names a
// crawler, an AI scraper, an SEO tool or a scraping library gets a 403 before
// any page renders or any query runs. Link previews (Slackbot, LinkedInBot,
// facebookexternalhit) are crawlers too and are refused with the rest.
// robots.txt itself stays readable, so a polite crawler learns why.

const CRAWLER = new RegExp(
  [
    "bot\\b", "bot/", "crawl", "spider", "slurp", "scrap", "archiver",
    "facebookexternalhit", "meta-external", "gptbot", "chatgpt", "oai-search", "claude", "anthropic", "ccbot",
    "bytespider", "perplexity", "amazonbot", "applebot", "cohere", "diffbot", "youbot", "timpibot", "imagesift",
    "ahrefs", "semrush", "mj12", "dotbot", "dataforseo", "serpstat", "seekport", "petalbot", "yandex", "baidu",
    "headlesschrome", "phantomjs", "python-requests", "python-urllib", "aiohttp", "httpx", "scrapy", "go-http-client",
    "java/", "okhttp", "libwww", "wget",
  ].join("|"),
  "i"
)

export function proxy(request: NextRequest) {
  const agent = request.headers.get("user-agent") ?? ""
  if (CRAWLER.test(agent)) return new NextResponse("Crawlers are not permitted on this site.", { status: 403, headers: { "cache-control": "no-store" } })
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|robots.txt|favicon.ico|icon.svg).*)"],
}
