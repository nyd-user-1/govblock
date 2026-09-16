// The deep lens: GDELT finds the bills the press is writing about, and Event
// Registry (NewsAPI.ai) says what that coverage is worth — who shared it, how
// much the outlet matters, which people and organisations it is really about,
// which stories are the same story, and the dates it points forward to.
//
//   node scripts/deep-lens/examples.mjs
//
// One request per bill, articles sorted by social score, every enrichment
// switched on. The targets come from GDELT's day file, not from a guess: the
// bills whose own congress.gov pages the most stories linked to on
// 2026-09-15. Writes apps/web/lib/data/deep-lens.json — a dated sample the
// /deep-lens page shows as-is. Article bodies come back from the API and are
// never written: a public page cannot republish them.

import { readFileSync, writeFileSync } from "node:fs"

const ENV = readFileSync(new URL("../../apps/web/.env.local", import.meta.url), "utf8")
const KEY = ENV.match(/^NEWSAPIAI_API_KEY=(.*)$/m)?.[1]?.replace(/^["']|["']$/g, "")
if (!KEY) throw new Error("NEWSAPIAI_API_KEY is not set")

const DAY = JSON.parse(readFileSync(new URL("../../apps/web/lib/data/gdelt-days.json", import.meta.url), "utf8"))["2026-09-15"]
const MEMBERS = JSON.parse(readFileSync(new URL("../../apps/web/lib/data/members-us.json", import.meta.url), "utf8")).filter((m) => m.active)
const OUT = new URL("../../apps/web/lib/data/deep-lens.json", import.meta.url)

// The press's name for each bill, and its number as GDELT linked it.
const TARGETS = [
  { bill: "H.R. 3633", title: "Digital Asset Market Clarity Act", keyword: "CLARITY Act" },
  { bill: "H.R. 9917", title: "AI Kill Switch Act", keyword: "AI Kill Switch Act" },
  { bill: "H.R. 7567", title: "Farm, Food, and National Security Act of 2026", keyword: "farm bill" },
  { bill: "H.R. 7802", title: "DISCLOSE Act of 2026", keyword: "DISCLOSE Act" },
  { bill: null, title: "SAVE America Act", keyword: "SAVE America Act" },
]

const START = "2026-09-02"
const END = "2026-09-16"
const host = (url) => {
  try {
    return new URL(url).host.replace(/^www\./, "")
  } catch {
    return url
  }
}

async function articles(keyword) {
  const body = {
    action: "getArticles",
    keyword,
    keywordLoc: "body",
    lang: "eng",
    sourceLocationUri: "http://en.wikipedia.org/wiki/United_States",
    dateStart: START,
    dateEnd: END,
    articlesPage: 1,
    articlesCount: 100,
    articlesSortBy: "socialScore",
    resultType: "articles",
    dataType: ["news", "blog"],
    includeArticleConcepts: true,
    includeArticleCategories: true,
    includeArticleSocialScore: true,
    includeArticleLocation: true,
    includeArticleImage: true,
    includeArticleLinks: true,
    includeArticleExtractedDates: true,
    includeArticleEventUri: true,
    includeArticleDuplicateList: true,
    includeSourceRanking: true,
    includeSourceLocation: true,
    includeConceptLabel: true,
    apiKey: KEY,
  }
  const r = await fetch("https://eventregistry.org/api/v1/article/getArticles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`event registry ${r.status}`)
  return (await r.json()).articles
}

const memberFor = (label) => {
  const m = MEMBERS.find((x) => x.name === label || `${x.first_name} ${x.last_name}` === label)
  return m ? { id: m.people_id, name: m.name, party: m.party, role: m.role, district: m.district, photo: m.photo_url ?? null, state: m.district?.split("-")[1] ?? "US", chamber: m.chamber ?? null } : null
}

const examples = []
for (const target of TARGETS) {
  const answer = await articles(target.keyword)
  const results = answer.results ?? []
  const gdelt = DAY.bills.find((b) => b.label === target.bill)
  const gdeltUrls = new Set((gdelt?.stories ?? []).map((s) => s.url))
  // The same story lives at several addresses — a wire piece at every station
  // that ran it — so a GDELT story matches on its address or its headline.
  const norm = (text) => String(text ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim().slice(0, 60)
  const gdeltTitles = new Set((gdelt?.stories ?? []).map((s) => norm(s.title)).filter((t) => t.length > 20))
  const isGdelt = (a) => gdeltUrls.has(a.url) || gdeltTitles.has(norm(a.title))

  const shares = (a) => Object.values(a.shares ?? {}).reduce((n, v) => n + (Number(v) || 0), 0)
  const rank = (a) => a.source?.ranking?.importanceRank ?? null

  // People and organisations, resolved to one Wikipedia entry each.
  const concepts = new Map()
  for (const a of results) {
    for (const c of a.concepts ?? []) {
      if (!["person", "org"].includes(c.type)) continue
      const label = c.label?.eng ?? c.uri
      const at = concepts.get(c.uri) ?? { uri: c.uri, label, type: c.type, articles: 0, score: 0 }
      at.articles += 1
      at.score += c.score ?? 0
      concepts.set(c.uri, at)
    }
  }

  const categories = new Map()
  for (const a of results) for (const c of a.categories ?? []) categories.set(c.label, (categories.get(c.label) ?? 0) + 1)

  // Stories: articles Event Registry filed under the same event.
  const events = new Map()
  for (const a of results) if (a.eventUri) events.set(a.eventUri, [...(events.get(a.eventUri) ?? []), a])

  // Dates the coverage points at, from today on.
  const ahead = new Map()
  for (const a of results) {
    for (const d of a.extractedDates ?? []) {
      const date = d.date ?? d.amb ?? ""
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < "2026-09-16") continue
      const at = ahead.get(date) ?? { date, articles: 0, example: { title: a.title, url: a.url, source: a.source?.title ?? host(a.url) } }
      at.articles += 1
      ahead.set(date, at)
    }
  }

  const slim = (a) => ({
    title: a.title,
    url: a.url,
    source: a.source?.title ?? host(a.url),
    host: host(a.url),
    date: a.date,
    image: a.image ?? null,
    sentiment: typeof a.sentiment === "number" ? Math.round(a.sentiment * 100) / 100 : null,
    shares: shares(a),
    shareBreakdown: a.shares ?? {},
    importanceRank: rank(a),
    authors: (a.authors ?? []).map((x) => x.name).filter(Boolean).slice(0, 3),
    duplicate: Boolean(a.isDuplicate),
    inGdelt: isGdelt(a),
  })

  const bySource = [...results].filter((a) => rank(a)).sort((a, b) => rank(a) - rank(b))
  const unique = results.filter((a) => !a.isDuplicate)

  examples.push({
    ...target,
    window: { start: START, end: END },
    gdelt: { stories: gdelt?.stories.length ?? 0, urls: [...gdeltUrls] },
    total: answer.totalResults ?? results.length,
    read: results.length,
    duplicates: results.length - unique.length,
    overlap: results.filter(isGdelt).length,
    sentiment: results.filter((a) => typeof a.sentiment === "number").map((a) => Math.round(a.sentiment * 10) / 10),
    mostShared: [...results].sort((a, b) => shares(b) - shares(a)).slice(0, 8).map(slim),
    weightiest: bySource.slice(0, 8).map(slim),
    people: [...concepts.values()].filter((c) => c.type === "person").sort((a, b) => b.articles - a.articles).slice(0, 10).map((c) => ({ ...c, member: memberFor(c.label) })),
    organisations: [...concepts.values()].filter((c) => c.type === "org").sort((a, b) => b.articles - a.articles).slice(0, 8),
    categories: [...categories].sort((a, b) => b[1] - a[1]).slice(0, 6),
    stories: [...events.values()].sort((a, b) => b.length - a.length).slice(0, 5).map((group) => ({ articles: group.length, outlets: new Set(group.map((a) => host(a.url))).size, lead: slim(group[0]) })),
    ahead: [...ahead.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8),
    gdeltStories: (gdelt?.stories ?? []).map((s) => {
      const match = results.find((a) => a.url === s.url || (norm(a.title) === norm(s.title) && norm(s.title).length > 20))
      return { title: s.title, url: s.url, source: s.source, enriched: match ? slim(match) : null }
    }),
  })
  console.log(`${target.keyword}: ${answer.totalResults} results, ${results.length} read, ${results.length - unique.length} duplicates, ${(gdelt?.stories ?? []).filter((st) => results.some((a) => a.url === st.url || (norm(a.title) === norm(st.title) && norm(st.title).length > 20))).length}/${gdeltUrls.size} of GDELT's stories matched, ${[...concepts.values()].filter((c) => c.type === "person").length} people, ${events.size} stories, ${ahead.size} dates ahead`)
}

const usage = await (await fetch(`https://eventregistry.org/api/v1/usage?apiKey=${KEY}`)).json()
writeFileSync(OUT, JSON.stringify({ readAt: new Date().toISOString().slice(0, 16).replace("T", " "), gdeltDay: "2026-09-15", tokensUsed: TARGETS.length, usage, examples }))
console.log(`wrote ${(JSON.stringify(examples).length / 1024).toFixed(0)}KB; tokens`, usage)
