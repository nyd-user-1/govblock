// Seed news_stories from the news APIs, one jurisdiction at a time.
//
//   node scripts/news/seed.mjs                       every jurisdiction, every provider with a key
//   node scripts/news/seed.mjs --states NY,US        two desks
//   node scripts/news/seed.mjs --providers gnews     one provider
//   node scripts/news/seed.mjs --days 5              back to five days ago (the default)
//   node scripts/news/seed.mjs --dry                 fetch and count, write nothing
//
// Every provider is on its free plan (Brendan, 2026-09-09), so one pass over
// the 52 is about half a day's quota on each: GNews and NewsAPI allow 100
// requests a day, NewsData 200 credits, TheNewsAPI 100 requests of three
// articles, NewsAPI.ai 2,000 tokens a month. Webz is wired and skipped while
// its token is refused. Stories are keyed by URL; a second provider that has
// the same story only adds what the first lacked — a longer body, an image.
//
// Reads the keys and POLICY_CLUSTER_ARN / POLICY_SECRET_ARN / POLICY_DATABASE /
// AWS_REGION from apps/web/.env.local, the same variables the app uses.
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const require = createRequire(import.meta.url)
const { RDSDataClient, BatchExecuteStatementCommand, ExecuteStatementCommand } = require("@aws-sdk/client-rds-data")

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const env = Object.fromEntries(
  readFileSync(join(ROOT, "apps/web/.env.local"), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]),
)
const key = (name) => (env[name] || "").trim()

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const DRY = args.includes("--dry")
const DAYS = Math.max(1, Number(flag("days")) || 5)
const SINCE = new Date(Date.now() - DAYS * 864e5)
const sinceDate = SINCE.toISOString().slice(0, 10)

// The 52 with a record: Congress, the fifty states and the District.
const STATE_NAMES = {
  US: "Congress", AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
}

/**
 * What to ask each provider about a jurisdiction. The name is the anchor —
 * a story has to say it in its title or description to be kept, which is
 * what keeps a "New York" query from returning every post that mentions the
 * city in passing — and the topics say which stories about the place are
 * ours: the legislature, its members, the governor, a bill.
 */
// A story is kept when its headline or summary names the place AND says
// something governmental: a college-football story that mentions Texas is
// not Texas news (2026-09-09, after the first pass let a few through).
const TOPIC = /\b(legislat\w*|lawmakers?|legislators?|governor|senat\w*|assembly\w*|statehouse|capitol|bills?|budget|veto\w*|session|house|representatives?|delegates?|attorney general|secretary of state|redistricting|laws?|congress\w*|ordinance|referendum|ballot|election|primary|caucus|appropriat\w*)\b/i

function termsFor(code) {
  if (code === "US") return { name: "Congress", exa: "U.S. Congress news: Senate and House votes, bills, hearings and lawmakers", must: /\b(congress|senate|house of representatives|senator|representative|lawmakers)\b/i, topics: ["bill", "vote", "lawmakers", "legislation", "hearing"] }
  // The District has a Council and a mayor, not a legislature and a governor,
  // and the press writes "D.C."; Exa returned nothing under the formal name.
  if (code === "DC") return { name: "Washington, D.C.", exa: "Washington, D.C. Council, mayor, District budget and legislation news", must: /\b(D\.?C\.?|District of Columbia|the District)\b/, topics: ["council", "mayor", "bill", "budget", "councilmember"] }
  const name = STATE_NAMES[code]
  const anchor = code === "WA" ? "Washington state" : name
  return { name: anchor, exa: `${name} state legislature, lawmakers, governor, state budget and legislation news`, must: new RegExp(`\\b${name.replace(/ /g, "\\s+")}\\b`, "i"), topics: ["legislature", "lawmakers", "governor", "state senate", "state house", "assembly", "bill"] }
}

// NewsData caps a query at 100 characters and NewsAPI.ai counts fifteen
// words across all keywords, so each takes the first few topics only.
const q = (t, sep, take = t.topics.length) => `"${t.name}" ${sep} (${t.topics.slice(0, take).map((x) => (x.includes(" ") ? `"${x}"` : x)).join(sep === "AND" ? " OR " : " | ")})`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const stripMarkers = (text) =>
  (text || "")
    .replace(/\s*\[\+\d+ chars\]\s*$/, "")
    .replace(/\s*\.\.\.\s*\[\d+ chars\]\s*$/, "")
    .trim() || null

const host = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

const PROVIDERS = {
  gnews: {
    key: "GNEWS_API_KEY",
    async fetch(t) {
      const r = await fetch(`https://gnews.io/api/v4/search?q=${encodeURIComponent(q(t, "AND"))}&lang=en&country=us&max=10&sortby=publishedAt&apikey=${key("GNEWS_API_KEY")}`)
      const j = await r.json()
      if (!r.ok) throw new Error(`gnews ${r.status}: ${JSON.stringify(j.errors ?? j)}`)
      return (j.articles ?? []).map((a) => ({ url: a.url, title: a.title, description: a.description, content: stripMarkers(a.content), image_url: a.image, author: null, source_name: a.source?.name, source_url: a.source?.url, published_at: a.publishedAt }))
    },
  },
  newsapi: {
    key: "NEWSAPI_API_KEY",
    async fetch(t) {
      const r = await fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(q(t, "AND"))}&searchIn=title,description&language=en&sortBy=publishedAt&pageSize=100&from=${sinceDate}`, { headers: { "X-Api-Key": key("NEWSAPI_API_KEY") } })
      const j = await r.json()
      if (j.status !== "ok") throw new Error(`newsapi ${r.status}: ${j.message}`)
      return (j.articles ?? []).filter((a) => a.title && a.title !== "[Removed]").map((a) => ({ url: a.url, title: a.title, description: a.description, content: stripMarkers(a.content), image_url: a.urlToImage, author: a.author, source_name: a.source?.name, source_url: null, published_at: a.publishedAt }))
    },
  },
  newsdata: {
    key: "NEWSDATA_API_KEY",
    async fetch(t) {
      const r = await fetch(`https://newsdata.io/api/1/latest?apikey=${key("NEWSDATA_API_KEY")}&q=${encodeURIComponent(q(t, "AND", 3))}&language=en&country=us&size=10`)
      const j = await r.json()
      if (j.status !== "success") throw new Error(`newsdata ${r.status}: ${JSON.stringify(j.results ?? j)}`)
      return (j.results ?? []).map((a) => ({ url: a.link, title: a.title, description: a.description, content: /ONLY AVAILABLE/i.test(a.content || "") ? null : a.content, image_url: a.image_url && !/no-img/.test(a.image_url) ? a.image_url : null, author: Array.isArray(a.creator) ? a.creator.join(", ") : null, source_name: a.source_name, source_url: a.source_url, published_at: a.pubDate ? `${a.pubDate.replace(" ", "T")}Z` : null }))
    },
  },
  thenewsapi: {
    key: "THENEWSAPI_API_KEY",
    async fetch(t) {
      // Sorted by date its operators go unread; by relevance it reaches back
      // years. The window under relevance is the honest middle.
      const r = await fetch(`https://api.thenewsapi.com/v1/news/all?api_token=${key("THENEWSAPI_API_KEY")}&search=${encodeURIComponent(q(t, "+"))}&language=en&locale=us&limit=3&published_after=${sinceDate}`)
      const j = await r.json()
      if (j.error) throw new Error(`thenewsapi ${r.status}: ${JSON.stringify(j.error)}`)
      return (j.data ?? []).map((a) => ({ url: a.url, title: a.title, description: a.description, content: a.snippet, image_url: a.image_url, author: null, source_name: a.source, source_url: a.source ? `https://${a.source}` : null, published_at: a.published_at }))
    },
  },
  newsapiai: {
    key: "NEWSAPIAI_API_KEY",
    async fetch(t) {
      const keyword = t.topics.slice(0, 3).map((x) => `${t.name} ${x}`)
      const r = await fetch("https://eventregistry.org/api/v1/article/getArticles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: key("NEWSAPIAI_API_KEY"), keyword, keywordOper: "or", lang: "eng", sourceLocationUri: "http://en.wikipedia.org/wiki/United_States", dateStart: sinceDate, articlesCount: 50, articlesSortBy: "date", resultType: "articles", dataType: ["news"] }),
      })
      const j = await r.json()
      if (j.error) throw new Error(`newsapiai ${r.status}: ${j.error}`)
      return (j.articles?.results ?? []).map((a) => ({ url: a.url, title: a.title, description: null, content: a.body, image_url: a.image, author: (a.authors ?? []).map((x) => x.name).filter(Boolean).join(", ") || null, source_name: a.source?.title, source_url: a.source?.uri ? `https://${a.source.uri}` : null, published_at: a.dateTimePub ?? a.dateTime }))
    },
  },
  // Exa's news search is its /search endpoint with category "news" and a
  // published-date floor — the playground's "Result category" filter, not a
  // product of its own (Brendan asked, 2026-09-09). Semantic, so the query is
  // a sentence; the whole piece comes back as text. A tenth of a cent per
  // result, so 25 results is about two cents (measured 2026-09-09).
  exa: {
    key: "EXA_API_KEY",
    async fetch(t) {
      const r = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: { authorization: `Bearer ${key("EXA_API_KEY")}`, "content-type": "application/json" },
        body: JSON.stringify({ query: t.exa, type: "auto", category: "news", numResults: 25, startPublishedDate: SINCE.toISOString(), userLocation: "US", contents: { text: { maxCharacters: 8000 } } }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(`exa ${r.status}: ${JSON.stringify(j).slice(0, 120)}`)
      const lead = (text) => {
        const first = (text || "").replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/)[0] || ""
        return first.length > 20 && first.length <= 300 ? first : null
      }
      return (j.results ?? []).map((a) => ({ url: a.url, title: a.title, description: lead(a.text), content: a.text, image_url: a.image ?? null, author: a.author?.trim() || null, source_name: host(a.url), source_url: a.url ? new URL(a.url).origin : null, published_at: a.publishedDate, scoped: (a.text || "").slice(0, 1500) }))
    },
  },
  // GDELT, the Global Database of Events, Language and Tone: free, no key,
  // the world's news every fifteen minutes since 2015. Headline, outlet, date
  // and URL only — a discovery source that hands URLs on, not a body. One
  // request every five seconds, enforced with a 429 whose body is text.
  // Plain http on purpose: Node's fetch times out on the host's IPv6 address
  // over TLS (curl falls back to IPv4; undici does not), and GDELT serves
  // the same answer on port 80.
  gdelt: {
    key: null,
    async fetch(t) {
      const q = `"${t.name}" (${t.topics.slice(0, 3).map((x) => (x.includes(" ") ? `"${x}"` : x)).join(" OR ")}) sourcecountry:US`
      const r = await fetch(`http://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&timespan=${DAYS}d&maxrecords=100&sort=datedesc&format=json`, { headers: { "user-agent": "govblock/1.0" } })
      const text = await r.text()
      await sleep(6000)
      if (!r.ok || !text.startsWith("{")) throw new Error(`gdelt ${r.status}: ${text.slice(0, 80)}`)
      const j = JSON.parse(text)
      const iso = (d) => (d && /^\d{8}T\d{6}Z$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${d.slice(9, 11)}:${d.slice(11, 13)}:${d.slice(13, 15)}Z` : null)
      return (j.articles ?? []).filter((a) => a.language === "English").map((a) => ({ url: a.url, title: a.title, description: null, content: null, image_url: a.socialimage || null, author: null, source_name: a.domain, source_url: a.domain ? `https://${a.domain}` : null, published_at: iso(a.seendate) }))
    },
  },
  webz: {
    key: "WEBZNEWS_API_KEY",
    async fetch(t) {
      const r = await fetch(`https://api.webz.io/newsApiLite?token=${key("WEBZNEWS_API_KEY")}&q=${encodeURIComponent(`${q(t, "AND")} language:english site_type:news`)}`)
      const text = await r.text()
      if (!r.ok) throw new Error(`webz ${r.status}: ${text.slice(0, 80)}`)
      const j = JSON.parse(text)
      return (j.posts ?? []).map((p) => ({ url: p.url, title: p.title, description: null, content: p.text, image_url: p.thread?.main_image, author: p.author, source_name: p.thread?.site_full, source_url: p.thread?.site_full ? `https://${p.thread.site_full}` : null, published_at: p.published }))
    },
  },
}

const resourceArn = env.POLICY_CLUSTER_ARN
const secretArn = env.POLICY_SECRET_ARN
const database = env.POLICY_DATABASE || "policy"
if (!DRY && (!resourceArn || !secretArn)) throw new Error("POLICY_CLUSTER_ARN and POLICY_SECRET_ARN must be set in apps/web/.env.local")
const client = DRY ? null : new RDSDataClient({ region: env.AWS_REGION || "us-east-1" })

const s = (v) => (v === null || v === undefined || v === "" ? { isNull: true } : { stringValue: String(v) })

async function withResume(fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (e) {
      const msg = String(e?.message ?? e)
      if (/resuming|DatabaseResuming|Throttl|timed? ?out|ECONNRESET|socket hang up/i.test(msg) && attempt < 20) {
        await new Promise((r) => setTimeout(r, 3000))
        continue
      }
      throw e
    }
  }
}
const exec = (sql, parameters) => withResume(() => client.send(new ExecuteStatementCommand({ resourceArn, secretArn, database, sql, parameters, continueAfterTimeout: true })))
async function batch(sql, rows, size = 50) {
  for (let i = 0; i < rows.length; i += size) {
    const parameterSets = rows.slice(i, i + size)
    await withResume(() => client.send(new BatchExecuteStatementCommand({ resourceArn, secretArn, database, sql, parameterSets })))
  }
}

const DDL = [
  `create table if not exists news_stories (
     id bigserial primary key,
     state text not null,
     url text not null unique,
     title text not null,
     description text,
     content text,
     image_url text,
     author text,
     source_api text not null,
     source_name text,
     source_url text,
     published_at timestamptz,
     fetched_at timestamptz not null default now())`,
  `create index if not exists news_stories_state_published_idx on news_stories (state, published_at desc nulls last, id desc)`,
]

const UPSERT = `insert into news_stories (state, url, title, description, content, image_url, author, source_api, source_name, source_url, published_at, fetched_at)
  values (:state, :url, :title, :description, :content, :image_url, :author, :source_api, :source_name, :source_url, cast(:published_at as timestamptz), now())
  on conflict (url) do update set
    description = coalesce(news_stories.description, excluded.description),
    content = case when length(coalesce(excluded.content, '')) > length(coalesce(news_stories.content, '')) then excluded.content else news_stories.content end,
    image_url = coalesce(news_stories.image_url, excluded.image_url),
    author = coalesce(news_stories.author, excluded.author),
    published_at = coalesce(news_stories.published_at, excluded.published_at)`

async function main() {
  const states = (flag("states") ? flag("states").split(",").map((x) => x.trim().toUpperCase()) : Object.keys(STATE_NAMES)).filter((c) => STATE_NAMES[c])
  // GDELT is opt-in: it carries no body and costs six seconds a desk.
  const wanted = flag("providers") ? flag("providers").split(",").map((x) => x.trim()) : Object.keys(PROVIDERS).filter((p) => p !== "webz" && p !== "gdelt")
  const providers = wanted.filter((p) => PROVIDERS[p] && (PROVIDERS[p].key === null || key(PROVIDERS[p].key)))
  const skipped = wanted.filter((p) => !providers.includes(p))
  if (skipped.length) console.log(`no key, skipping: ${skipped.join(", ")}`)
  console.log(`${states.length} jurisdictions × ${providers.join(", ")}, since ${sinceDate}${DRY ? " (dry run)" : ""}`)

  if (!DRY) for (const sql of DDL) await exec(sql)

  const totals = Object.fromEntries(providers.map((p) => [p, { fetched: 0, kept: 0, failed: 0 }]))
  let written = 0
  for (const code of states) {
    const t = termsFor(code)
    const byUrl = new Map()
    for (const p of providers) {
      try {
        const rows = await PROVIDERS[p].fetch(t)
        totals[p].fetched += rows.length
        for (const r of rows) {
          if (!r.url || !r.title) continue
          // A keyword provider proves relevance in its headline or summary. Exa
          // answered a sentence about the government already, so it only has to
          // name the place somewhere in its opening.
          const head = `${r.title} ${r.description ?? ""}`
          if (r.scoped !== undefined ? !t.must.test(`${head} ${r.scoped}`) : !t.must.test(head) || !TOPIC.test(head)) continue
          delete r.scoped
          const row = { ...r, state: code, source_api: p, source_name: r.source_name || host(r.url) }
          const prior = byUrl.get(r.url)
          // The longest body wins; everything else fills a gap.
          byUrl.set(r.url, prior ? { ...prior, content: (row.content?.length ?? 0) > (prior.content?.length ?? 0) ? row.content : prior.content, description: prior.description ?? row.description, image_url: prior.image_url ?? row.image_url, author: prior.author ?? row.author } : row)
          totals[p].kept++
        }
      } catch (e) {
        totals[p].failed++
        console.log(`  ${code} ${p}: ${String(e.message ?? e).slice(0, 160)}`)
      }
      await sleep(300)
    }
    const rows = [...byUrl.values()]
    console.log(`${code} ${STATE_NAMES[code]}: ${rows.length} stories`)
    if (!DRY && rows.length) {
      await batch(
        UPSERT,
        rows.map((r) => [
          { name: "state", value: s(r.state) },
          { name: "url", value: s(r.url) },
          { name: "title", value: s(r.title.slice(0, 500)) },
          { name: "description", value: s(r.description) },
          { name: "content", value: s(r.content) },
          { name: "image_url", value: s(r.image_url) },
          { name: "author", value: s(r.author) },
          { name: "source_api", value: s(r.source_api) },
          { name: "source_name", value: s(r.source_name) },
          { name: "source_url", value: s(r.source_url) },
          { name: "published_at", value: s(r.published_at) },
        ]),
      )
      written += rows.length
    }
  }
  console.log("\nby provider:", totals)
  console.log(`${written} rows written`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
