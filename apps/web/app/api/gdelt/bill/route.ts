import { unstable_cache } from "next/cache"

// One bill's coverage, fetched when a reader asks for it (Brendan, 2026-09-16:
// "per bill is demand driven by trigger") and kept for a week.
//
// GDELT's article API allows about one call every five minutes and turns away
// a plain script's user agent, so this is never on a page load and never on a
// schedule: a reader presses Coverage, two calls go out, and the answer is
// cached against the phrase so the next reader pays nothing. When GDELT
// refuses, the route says so rather than pretending the bill has no coverage.

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
const DOC = "https://api.gdeltproject.org/api/v2/doc/doc"

type Article = { url: string; title: string; seendate: string; domain: string; socialimage?: string }
type Point = { date: string; value: number; norm?: number }

async function ask(params: Record<string, string>) {
  const url = `${DOC}?${new URLSearchParams({ format: "json", ...params })}`
  const answer = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(60_000), cache: "no-store" })
  const text = await answer.text()
  if (!answer.ok || !text.trim().startsWith("{")) throw new Error(answer.status === 429 || /limit requests/i.test(text) ? "busy" : `gdelt ${answer.status}`)
  return JSON.parse(text)
}

const coverage = (phrase: string) =>
  unstable_cache(
    async () => {
      const query = `"${phrase}" sourcecountry:US`
      const volume = await ask({ query, mode: "timelinevolraw", timespan: "12m" })
      const rows: Point[] = volume.timeline?.[0]?.data ?? []
      // A second call only when the first found something.
      const articles: Article[] = rows.some((p) => p.value > 0) ? ((await ask({ query, mode: "artlist", maxrecords: "40", sort: "datedesc", timespan: "3m" })).articles ?? []) : []
      const day = (stamp: string) => `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`
      return {
        phrase,
        readAt: new Date().toISOString().slice(0, 16).replace("T", " "),
        total: rows.reduce((n, p) => n + p.value, 0),
        curve: rows.map((p) => ({ date: day(p.date), articles: p.value, share: p.norm ? (p.value / p.norm) * 100 : 0 })),
        articles: articles.slice(0, 20).map((a) => ({ url: a.url, title: a.title, domain: a.domain, date: day(a.seendate), image: a.socialimage || null })),
      }
    },
    ["gdelt-bill", phrase],
    { revalidate: 60 * 60 * 24 * 7, tags: ["gdelt-bill"] }
  )()

export async function POST(request: Request) {
  const { phrase } = (await request.json().catch(() => ({}))) as { phrase?: string }
  if (!phrase || phrase.length < 3 || phrase.length > 80) return Response.json({ error: "Name the bill as the press names it." }, { status: 400 })
  try {
    return Response.json(await coverage(phrase.trim()))
  } catch (error) {
    const busy = (error as Error).message === "busy"
    return Response.json(
      { error: busy ? "GDELT answers only about one of these requests every five minutes, and that slot is taken. Wait five minutes and press again." : "GDELT did not answer." },
      { status: busy ? 429 : 502 }
    )
  }
}
