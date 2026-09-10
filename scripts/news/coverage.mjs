// The coverage of a phrase over years: how much, when, by whom, and what was said.
//
//   node scripts/news/coverage.mjs "open primaries"                    the curve, 2017 to now
//   node scripts/news/coverage.mjs "open primaries" --from 2024 --to 2024   one window
//   node scripts/news/coverage.mjs "open primaries" --state MO         scoped to one desk
//   node scripts/news/coverage.mjs "open primaries" --results 100      deeper per window
//   node scripts/news/coverage.mjs "open primaries" --write            keep what it gathers
//
// Two sources, because neither alone answers the question.
//
// GDELT is free and has read the world's news every fifteen minutes since
// 2015. It gives volume over time — the share of all monitored coverage that
// mentioned the phrase, day by day — and headlines with their outlets, but no
// article text. It is the curve.
//
// Exa is paid and indexes back years. A search per window with a published
// date floor and ceiling returns the pieces themselves, text and all, which
// is what the Reporter needs to say what the coverage was about. It is the
// substance. At neural search it bills a tenth of a cent a result: $0.022 for
// 25, $0.097 for 100, text included (measured 2026-09-09).
//
// Nothing is written without --write.
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

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const has = (name) => args.includes(`--${name}`)
const PHRASE = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1]?.startsWith("--") !== true)
if (!PHRASE) {
  console.log('give a phrase: node scripts/news/coverage.mjs "open primaries"')
  process.exit(0)
}
const THIS_YEAR = new Date().getFullYear()
const FROM = Math.max(2015, Number(flag("from")) || 2017)
const TO = Math.min(THIS_YEAR, Number(flag("to")) || THIS_YEAR)
const RESULTS = Math.min(100, Math.max(10, Number(flag("results")) || 25))
const STATE = flag("state")?.toUpperCase() ?? null
const WRITE = has("write")
const NO_EXA = has("no-exa")

const STATE_NAMES = {
  US: "the United States", AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "Washington, D.C.",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
}
const where = STATE ? STATE_NAMES[STATE] ?? STATE : null

const slug = PHRASE.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── GDELT ────────────────────────────────────────────────────────────────
//
// One request every five seconds is the published limit and it is enforced:
// a burst earns a 429 whose body is plain text, not JSON, and a cooldown of a
// minute or more. So every call goes through one queue with a six-second gap.
// Plain http, because Node's fetch times out on GDELT's IPv6 address over TLS
// where curl falls back (2026-09-09).

let lastCall = 0
async function gdelt(params) {
  const wait = 6000 - (Date.now() - lastCall)
  if (wait > 0) await sleep(wait)
  const url = `http://api.gdeltproject.org/api/v2/doc/doc?${new URLSearchParams(params)}`
  for (let attempt = 0; ; attempt++) {
    lastCall = Date.now()
    const r = await fetch(url, { headers: { "user-agent": "GovBlockBot/1.0 (+https://govblock.app)" }, signal: AbortSignal.timeout(60000) })
    const text = await r.text()
    if (r.status === 429 || /rate limit|too many/i.test(text.slice(0, 200))) {
      // The cooldown after a burst is a minute or more, and it is shared by
      // everything on this address, so the wait grows with each refusal.
      if (attempt >= 5) throw new Error("gdelt: rate limited — wait a few minutes")
      await sleep(60000 * (attempt + 1))
      continue
    }
    if (!r.ok) throw new Error(`gdelt ${r.status}: ${text.slice(0, 120)}`)
    try {
      return JSON.parse(text)
    } catch {
      // An empty result set comes back as an HTML notice, not as JSON.
      if (/no matching|not found/i.test(text)) return {}
      throw new Error(`gdelt: not JSON — ${text.slice(0, 120)}`)
    }
  }
}

const stamp = (d) => d.replace(/-/g, "") + "000000"

/** The phrase as GDELT reads it, narrowed to the US press. */
const gdeltQuery = () => `"${PHRASE}"${where && STATE !== "US" ? ` "${where}"` : ""} sourcecountry:US`

/** Daily volume across the span, summed by year. */
async function curve() {
  const data = await gdelt({
    query: gdeltQuery(),
    mode: "timelinevol",
    startdatetime: stamp(`${FROM}-01-01`),
    enddatetime: stamp(`${TO}-12-31`),
    format: "json",
  })
  const points = data.timeline?.[0]?.data ?? []
  const byYear = {}
  for (const p of points) {
    const year = String(p.date).slice(0, 4)
    byYear[year] = (byYear[year] ?? 0) + Number(p.value ?? 0)
  }
  return { points: points.length, byYear }
}

/** The headlines of one year, with their outlets. */
async function headlines(year) {
  const data = await gdelt({
    query: gdeltQuery(),
    mode: "artlist",
    startdatetime: stamp(`${year}-01-01`),
    enddatetime: stamp(`${year}-12-31`),
    maxrecords: "250",
    sort: "datedesc",
    format: "json",
  })
  return (data.articles ?? []).map((a) => ({
    url: a.url,
    title: a.title,
    source_name: a.domain,
    published_at: a.seendate ? `${a.seendate.slice(0, 4)}-${a.seendate.slice(4, 6)}-${a.seendate.slice(6, 8)}T${a.seendate.slice(9, 11)}:${a.seendate.slice(11, 13)}:00Z` : null,
  }))
}

// ── Exa ──────────────────────────────────────────────────────────────────

async function exaYear(year) {
  const key = (env.EXA_API_KEY || "").trim()
  if (!key) return { stories: [], usd: 0 }
  const query = where
    ? `"${PHRASE}" in ${where}: the legislature, lawmakers, the governor, bills and ballot measures`
    : `"${PHRASE}" in American state legislatures and statehouses: bills, ballot measures and party rules`
  const r = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    signal: AbortSignal.timeout(60000),
    body: JSON.stringify({
      query,
      type: "auto",
      category: "news",
      numResults: RESULTS,
      startPublishedDate: `${year}-01-01T00:00:00.000Z`,
      endPublishedDate: `${year}-12-31T23:59:59.000Z`,
      userLocation: "US",
      contents: { text: { maxCharacters: 6000 } },
    }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`exa ${r.status}: ${JSON.stringify(j).slice(0, 140)}`)
  const host = (u) => {
    try {
      return new URL(u).hostname.replace(/^www\./, "")
    } catch {
      return null
    }
  }
  return {
    usd: j.costDollars?.total ?? 0,
    stories: (j.results ?? [])
      .filter((a) => a.url && a.title)
      .map((a) => ({
        url: a.url,
        title: a.title,
        description: (a.text || "").replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/)[0]?.slice(0, 300) || null,
        content: a.text ?? null,
        image_url: a.image ?? null,
        author: a.author?.trim() || null,
        source_name: host(a.url),
        source_url: a.url ? new URL(a.url).origin : null,
        published_at: a.publishedDate ?? null,
      })),
  }
}

// ── the store ────────────────────────────────────────────────────────────
//
// The gathered pieces are stories like any other, so they go in news_stories
// keyed by URL; what makes them a set is the topic beside them. A join table
// rather than a column, because one story can be about two phrases and a
// phrase gathered twice should not duplicate a row.

const client = WRITE ? new RDSDataClient({ region: env.AWS_REGION || "us-east-1" }) : null
const s = (v) => (v === null || v === undefined || v === "" ? { isNull: true } : { stringValue: String(v) })
async function withResume(fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (e) {
      if (/resuming|DatabaseResuming|Throttl|timed? ?out/i.test(String(e?.message ?? e)) && attempt < 20) {
        await sleep(3000)
        continue
      }
      throw e
    }
  }
}
const exec = (sql, parameters) =>
  withResume(() => client.send(new ExecuteStatementCommand({ resourceArn: env.POLICY_CLUSTER_ARN, secretArn: env.POLICY_SECRET_ARN, database: env.POLICY_DATABASE || "policy", sql, parameters, continueAfterTimeout: true })))
async function batch(sql, rows, size = 25) {
  for (let i = 0; i < rows.length; i += size)
    await withResume(() => client.send(new BatchExecuteStatementCommand({ resourceArn: env.POLICY_CLUSTER_ARN, secretArn: env.POLICY_SECRET_ARN, database: env.POLICY_DATABASE || "policy", sql, parameterSets: rows.slice(i, i + size) })))
}

const DDL = [
  `create table if not exists news_topics (
     id bigserial primary key,
     slug text not null unique,
     phrase text not null,
     state text,
     gathered_from integer,
     gathered_to integer,
     created_at timestamptz not null default now())`,
  `create table if not exists news_story_topics (
     topic_id bigint not null references news_topics(id) on delete cascade,
     story_id bigint not null references news_stories(id) on delete cascade,
     primary key (topic_id, story_id))`,
]

async function store(stories) {
  for (const sql of DDL) await exec(sql)
  const { records } = await exec(
    `insert into news_topics (slug, phrase, state, gathered_from, gathered_to) values (:slug, :phrase, :state, :from, :to)
     on conflict (slug) do update set gathered_from = least(news_topics.gathered_from, excluded.gathered_from), gathered_to = greatest(news_topics.gathered_to, excluded.gathered_to)
     returning id`,
    [
      { name: "slug", value: s(STATE ? `${STATE.toLowerCase()}-${slug}` : slug) },
      { name: "phrase", value: s(PHRASE) },
      { name: "state", value: s(STATE) },
      { name: "from", value: { longValue: FROM } },
      { name: "to", value: { longValue: TO } },
    ],
  )
  const topicId = records[0][0].longValue
  await batch(
    `insert into news_stories (state, url, title, description, content, image_url, author, source_api, source_name, source_url, published_at, fetched_at)
     values (:state, :url, :title, :description, :content, :image_url, :author, :source_api, :source_name, :source_url, cast(:published_at as timestamptz), now())
     on conflict (url) do update set
       description = coalesce(news_stories.description, excluded.description),
       content = case when length(coalesce(excluded.content, '')) > length(coalesce(news_stories.content, '')) then excluded.content else news_stories.content end,
       published_at = coalesce(news_stories.published_at, excluded.published_at)`,
    stories.map((row) => [
      { name: "state", value: s(STATE ?? "US") },
      { name: "url", value: s(row.url) },
      { name: "title", value: s(row.title.slice(0, 500)) },
      { name: "description", value: s(row.description ?? null) },
      { name: "content", value: s(row.content ?? null) },
      { name: "image_url", value: s(row.image_url ?? null) },
      { name: "author", value: s(row.author ?? null) },
      { name: "source_api", value: s(row.source_api ?? "exa") },
      { name: "source_name", value: s(row.source_name ?? null) },
      { name: "source_url", value: s(row.source_url ?? null) },
      { name: "published_at", value: s(row.published_at ?? null) },
    ]),
  )
  await batch(
    `insert into news_story_topics (topic_id, story_id)
     select :topic, id from news_stories where url = :url
     on conflict do nothing`,
    stories.map((row) => [
      { name: "topic", value: { longValue: topicId } },
      { name: "url", value: s(row.url) },
    ]),
  )
  return topicId
}

// ── the run ──────────────────────────────────────────────────────────────

console.log(`"${PHRASE}"${where ? ` in ${where}` : ""}, ${FROM}–${TO}${WRITE ? "" : " (nothing written)"}\n`)

const { points, byYear } = await curve()
console.log(`GDELT: ${points} daily points\n`)
const years = []
for (let y = FROM; y <= TO; y++) years.push(y)
const width = 40
const peak = Math.max(...years.map((y) => byYear[String(y)] ?? 0), 0.0001)
for (const y of years) {
  const v = byYear[String(y)] ?? 0
  console.log(`${y}  ${"█".repeat(Math.round((v / peak) * width)).padEnd(width)} ${v.toFixed(2)}`)
}

let usd = 0
const gathered = []
for (const y of years) {
  const heads = await headlines(y)
  const outlets = {}
  for (const h of heads) outlets[h.source_name] = (outlets[h.source_name] ?? 0) + 1
  const top = Object.entries(outlets).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([d, n]) => `${d} ${n}`)
  let exa = { stories: [], usd: 0 }
  if (!NO_EXA) {
    try {
      exa = await exaYear(y)
      usd += exa.usd
    } catch (e) {
      console.log(`  ${y} exa: ${String(e.message ?? e).slice(0, 120)}`)
    }
  }
  const withText = exa.stories.filter((x) => (x.content?.length ?? 0) > 800).length
  console.log(`\n${y}: ${heads.length} headlines from GDELT (${top.join(", ") || "—"}), ${exa.stories.length} pieces from Exa, ${withText} with text`)
  for (const x of exa.stories.slice(0, 3)) console.log(`   ${x.published_at?.slice(0, 10) ?? "—"}  ${x.source_name}  ${x.title.slice(0, 90)}`)
  gathered.push(
    ...exa.stories.map((x) => ({ ...x, source_api: "exa" })),
    // GDELT hands over a headline and an address, no body. Kept as the record
    // of who covered it; the crawler's extractor can fill them in later.
    ...heads.filter((h) => h.url && h.title).map((h) => ({ ...h, source_api: "gdelt", description: null, content: null, image_url: null, author: null, source_url: null })),
  )
}

const unique = [...new Map(gathered.map((x) => [x.url, x])).values()]
console.log(`\n${unique.length} pieces across ${years.length} windows, ${unique.filter((x) => x.content).length} with text; Exa billed $${usd.toFixed(3)}`)

if (WRITE) {
  const id = await store(unique)
  console.log(`stored under topic ${id} (${STATE ? `${STATE.toLowerCase()}-` : ""}${slug})`)
} else {
  console.log(`--write to keep them`)
}
