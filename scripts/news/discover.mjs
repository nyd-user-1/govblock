// Find the feed behind an outlet.
//
//   node scripts/news/discover.mjs --hosts wbur.org,kcur.org    probe named hosts
//   node scripts/news/discover.mjs --states MA,MO               mine the desk's own stories for outlets
//   node scripts/news/discover.mjs --thin 3                     every desk under three live feeds
//   node scripts/news/discover.mjs --states MA --append         write what answers into the list, inactive
//
// Two ways to a feed. The named way: a host is handed over and its homepage
// is read for <link rel="alternate">, falling back to the paths publishers
// actually use. The mined way: the stories already in news_stories say which
// outlets cover a desk — the ones Exa returned for that state and no other
// are its local press — and each of those hosts is then probed the same way.
//
// Nothing here decides the list. Candidates arrive `active: false`; the list
// is Brendan's to promote.
import { readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { get, parseFeed, stripTags } from "./feeds.mjs"

const require = createRequire(import.meta.url)
const { RDSDataClient, ExecuteStatementCommand } = require("@aws-sdk/client-rds-data")

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const LIST = join(ROOT, "apps/web/lib/data/news-feeds.json")
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
const APPEND = args.includes("--append")
const HOSTS = flag("hosts")?.split(",").map((x) => x.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
const STATES = flag("states")?.split(",").map((x) => x.trim().toUpperCase())
const THIN = flag("thin") ? Number(flag("thin")) : args.includes("--thin") ? 3 : null
const PER_STATE = Math.max(1, Number(flag("per-state")) || 8)

// Wire services, aggregators and press-release mills: real hosts that carry
// somebody else's reporting, so a feed of theirs is not a desk's local press.
const AGGREGATORS =
  /^(www\.)?(yahoo|msn|news\.google|biztoc|einpresswire|infonews\.ca|pubt\.io|hoodline|slashdot|freerepublic|newsbreak|smartnews|flipboard|apnews|reuters|bloomberg|cbsnews|nbcnews|abcnews\.go|foxnews|cnn|usatoday|washingtontimes|nypost|thecooldown|zerohedge|dailymail|substack|medium|wikipedia|reddit|facebook|twitter|x|youtube|linkedin|patch|prnewswire|globenewswire|businesswire|accesswire|streetinsider|marketscreener|investing|benzinga|simplywall|finance\.yahoo)\./i

// The paths publishers actually use when the page does not advertise one.
const GUESSES = ["/feed/", "/feed", "/index.rss", "/rss", "/rss.xml", "/index.xml", "/atom.xml", "/feeds/all.rss.xml", "/?feed=rss2", "/news/feed/", "/politics/feed/", "/feeds/rss", "/rss/index.xml", "/arc/outboundfeeds/rss/", "/feed/homepage"]

// An href in HTML is written with entities — &amp; in a query string is one
// ampersand, not five characters — and a feed address that keeps them 404s.
const entities = (text) =>
  (text || "")
    .replace(/&amp;/gi, "&")
    .replace(/&#38;/g, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")

const abs = (href, base) => {
  try {
    return new URL(href, base).toString()
  } catch {
    return null
  }
}

/** The feed a page advertises, in the order the page lists them. */
async function advertised(origin) {
  try {
    const r = await get(origin, { headers: { accept: "text/html" }, ms: 12000 })
    if (!r.ok) return { ok: false, title: null, links: [], sections: [] }
    const html = (await r.text()).slice(0, 400000)
    const links = [...html.matchAll(/<link\b[^>]*>/gi)]
      .map((m) => m[0])
      .filter((t) => /rel\s*=\s*["']?alternate/i.test(t) && /(rss|atom)\+xml/i.test(t))
      .map((t) => abs(entities(/href\s*=\s*["']([^"']+)["']/i.exec(t)?.[1] ?? ""), origin))
      .filter(Boolean)
    const title = stripTags(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "") || null
    // The NPR member stations run a platform whose homepage feed is empty and
    // whose real feeds hang off each section: /politics.rss, /government.rss,
    // whatever that station calls its statehouse desk. So the nav is read for
    // section paths that sound governmental, and each is tried as a feed.
    const sections = [...new Set([...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) => abs(m[1], origin)).filter(Boolean))]
      .filter((href) => {
        try {
          const u = new URL(href)
          return u.host === new URL(origin).host && /^\/[a-z0-9][a-z0-9-]{2,60}\/?$/i.test(u.pathname) && /politic|government|legislat|statehouse|capitol|state|\bnews\b/i.test(u.pathname) && !/podcast/i.test(u.pathname)
        } catch {
          return false
        }
      })
      .map((href) => new URL(href).pathname.replace(/\/$/, ""))
      .slice(0, 8)
    return { ok: true, title, links: [...new Set(links)], sections }
  } catch {
    return { ok: false, title: null, links: [], sections: [] }
  }
}

/** Does this address answer with a feed that has recent items? */
async function validate(url) {
  try {
    const r = await get(url, { headers: { accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" }, ms: 8000 })
    if (!r.ok) return null
    const xml = (await r.text()).slice(0, 4_000_000)
    if (!/<(rss|feed|rdf:RDF)\b/i.test(xml)) return null
    const items = parseFeed(xml, url)
    if (items.length < 3) return null
    const newest = items.map((i) => i.published_at).filter(Boolean).sort().at(-1) ?? null
    // A feed nobody has fed in three months is an archive, not a desk.
    if (newest && Date.parse(newest) < Date.now() - 90 * 864e5) return null
    const name = stripTags(/<channel[^>]*>[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/i.exec(xml)?.[1] ?? /<title[^>]*>([\s\S]*?)<\/title>/i.exec(xml)?.[1] ?? "") || null
    return { url, items: items.length, newest, name: name?.slice(0, 120) ?? null, full: items.filter((i) => (i.content?.length ?? 0) > 600).length }
  } catch {
    return null
  }
}

// A channel title is written for a feed reader's sidebar: "The Seattle Times
// The Seattle Times", "KOLN | Nebraska Local News, Weather, Sports". The list
// wants the outlet, so the tail after a separator goes, and a title that says
// itself twice says it once.
function outletName(title, host) {
  let name = (title || host)
    .split(/\s+[|·–—]\s+/)[0]
    .replace(/\s*[-–—:|]\s*RSS\s*(Results|Feed)?\s*$/i, "")
    .replace(/\s*[-–—:|]\s*(Feed|News|Homepage|Home)\s*$/i, "")
    .trim()
  const half = Math.floor(name.length / 2)
  if (name.length > 8 && name.slice(0, half).trim() === name.slice(half).trim()) name = name.slice(0, half).trim()
  name = name.replace(/,$/, "").slice(0, 60)
  // A channel that titles itself "News", or with the day's headline, names
  // nothing; the host at least says who it is.
  if (!name || /^(news|home|homepage|latest|local news|top stories)$/i.test(name) || /:\s/.test(name)) return host
  return name
}

async function probe(host) {
  const bare = host.replace(/^www\./, "")
  // Plenty of publishers serve only the www name — the apex refuses the
  // connection outright — so both are tried and the one that answers is the
  // origin the guesses are built on.
  let origin = `https://${bare}`
  let page = await advertised(origin)
  if (!page.ok) {
    const wide = await advertised(`https://www.${bare}`)
    if (wide.ok) {
      origin = `https://www.${bare}`
      page = wide
    }
  }
  const { title, links, sections } = page
  const tried = new Set()
  const found = []
  const fromSections = sections.flatMap((path) => [`${origin}${path}.rss`, `${origin}${path}/feed/`])
  // A host that answers nothing must not cost minutes: every address is tried
  // briefly, a dozen of them at most, and the host is dropped after a minute
  // however many are left.
  const started = Date.now()
  for (const candidate of [...links, ...GUESSES.map((p) => origin + p), ...fromSections]) {
    if (!candidate || tried.has(candidate)) continue
    if (tried.size >= 14 || Date.now() - started > 60000) break
    tried.add(candidate)
    // A comments feed is not a newsroom.
    if (/\/comments\/feed|comment-feed|\/author\/|\/tag\/|podcast/i.test(candidate)) continue
    // /feed and /feed/ are the same feed; so are the apex and the www name.
    const same = (u) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
    if (found.some((f) => same(f.url) === same(candidate))) continue
    const ok = await validate(candidate)
    if (ok) {
      found.push({ ...ok, name: outletName(ok.name || title, host) })
      if (found.length >= 2) break
    }
  }
  return { host, found }
}

// ── the outlets a desk already has ───────────────────────────────────────

const client = new RDSDataClient({ region: env.AWS_REGION || "us-east-1" })
async function exec(sql) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await client.send(new ExecuteStatementCommand({ resourceArn: env.POLICY_CLUSTER_ARN, secretArn: env.POLICY_SECRET_ARN, database: env.POLICY_DATABASE || "policy", sql, continueAfterTimeout: true }))
    } catch (e) {
      if (/resuming|DatabaseResuming|Throttl/i.test(String(e?.message ?? e)) && attempt < 20) {
        await new Promise((r) => setTimeout(r, 3000))
        continue
      }
      throw e
    }
  }
}

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

/** The hosts Exa returned for this desk and no other, commonest first. */
async function outletsFor(states) {
  const list = states.map((x) => `'${x}'`).join(",")
  const { records } = await exec(`select state, url from news_stories where state in (${list})`)
  const { records: everywhere } = await exec(`select url, state from news_stories`)
  const statesByHost = new Map()
  for (const [u, st] of everywhere.map((r) => [r[0].stringValue, r[1].stringValue])) {
    const h = hostOf(u)
    if (!h) continue
    if (!statesByHost.has(h)) statesByHost.set(h, new Set())
    statesByHost.get(h).add(st)
  }
  const out = new Map()
  for (const [st, u] of records.map((r) => [r[0].stringValue, r[1].stringValue])) {
    const h = hostOf(u)
    if (!h || AGGREGATORS.test(h)) continue
    // An outlet that turns up for a dozen desks is national coverage; one
    // that turns up for this desk alone is the local press.
    if ((statesByHost.get(h)?.size ?? 0) > 2) continue
    const key = `${st}\t${h}`
    out.set(key, (out.get(key) ?? 0) + 1)
  }
  const byState = {}
  for (const [key, n] of out) {
    const [st, h] = key.split("\t")
    ;(byState[st] ??= []).push({ host: h, n })
  }
  for (const st of Object.keys(byState)) byState[st] = byState[st].sort((a, b) => b.n - a.n).slice(0, PER_STATE)
  return byState
}

// ── the run ──────────────────────────────────────────────────────────────

const list = JSON.parse(readFileSync(LIST, "utf8"))
const known = new Set(list.map((f) => f.url))
const knownHosts = new Set(list.map((f) => hostOf(f.url)))

let plan = {}
if (HOSTS) plan = { [flag("states")?.toUpperCase() ?? "??"]: HOSTS.map((host) => ({ host, n: 0 })) }
else {
  let states = STATES
  if (THIN) {
    const live = {}
    for (const f of list) if (f.active !== false) live[f.state] = (live[f.state] ?? 0) + 1
    states = [...new Set(list.map((f) => f.state))].filter((st) => (live[st] ?? 0) < THIN)
    console.log(`${states.length} desks under ${THIN} feeds: ${states.join(" ")}\n`)
  }
  if (!states?.length) {
    console.log("give --hosts, --states or --thin")
    process.exit(0)
  }
  plan = await outletsFor(states)
}

const additions = []
for (const [state, outlets] of Object.entries(plan)) {
  for (const { host, n } of outlets) {
    // A host named on the command line is probed even when the list already
    // carries an address for it — that is how a dead address gets replaced.
    if (!HOSTS && knownHosts.has(host)) continue
    const { found } = await probe(host)
    if (!found.length) {
      console.log(`${state}\t—\t${host}${n ? `  (${n} stories)` : ""}`)
      continue
    }
    for (const f of found) {
      if (known.has(f.url)) continue
      console.log(`${state}\tok\t${String(f.items).padStart(3)} items\t${f.full} full\t${(f.newest ?? "—").slice(0, 10)}\t${f.name}\t${f.url}`)
      additions.push({ state, name: f.name, url: f.url, kind: "local", active: false })
    }
  }
}

console.log(`\n${additions.length} candidates`)
if (APPEND && additions.length) {
  writeFileSync(LIST, JSON.stringify([...list, ...additions].sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name)), null, 2) + "\n")
  console.log(`appended to ${LIST.replace(ROOT + "/", "")}, all inactive — set "active": true on the keepers`)
}
