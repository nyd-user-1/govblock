// What GDELT's file feeds hold for legislation, measured rather than assumed.
//
//   node scripts/gdelt/files.mjs [slices]
//
// The APIs are rate-limited and two of them are dead; the files are neither.
// This reads a few of the 15-minute files — the Global Knowledge Graph, the
// Event table, the Mentions table — and the per-minute Quotation Graph, keeps
// what concerns legislation, and writes a compact snapshot for /gdelt.
// Nothing here runs at request time.
//
// Checked 2026-09-15, before writing this: the Global Entity Graph stops on
// 2026-06-18, the Television Ngrams stop on 2024-10-10 (the same day the TV
// API's archive ends), the Global Frontpage Graph publishes empty files, and
// the v1 Full Text Search API answers every query with no results. The three
// feeds below are the live ones.

import { execFileSync } from "node:child_process"
import { gunzipSync } from "node:zlib"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const SLICES = Number(process.argv[2] ?? 8)
const OUT = new URL("../../apps/web/lib/data/gdelt-files.json", import.meta.url)
const DIR = join(tmpdir(), "gdelt-files")
mkdirSync(DIR, { recursive: true })

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
const bytes = { gkg: 0, events: 0, mentions: 0, quotes: 0 }

/** A file, fetched to disk, with its size counted against its feed. */
function grab(url, feed) {
  const file = join(DIR, url.split("/").pop())
  if (existsSync(file)) {
    const size = readFileSync(file).length
    if (size > 100) {
      bytes[feed] += size
      return file
    }
    return null
  }
  try {
    execFileSync("curl", ["-sfL", "--max-time", "300", "-A", UA, "-o", file, url])
  } catch {
    return null
  }
  const size = readFileSync(file).length
  if (size < 100) return null
  bytes[feed] += size
  return file
}

const unzip = (file) => execFileSync("unzip", ["-p", file], { maxBuffer: 512 * 1024 * 1024, encoding: "utf8" })
const ungzip = (file) => gunzipSync(readFileSync(file)).toString("utf8")

/** The 15-minute stamps to read, newest first, from GDELT's own last-update file. */
function stamps() {
  const last = execFileSync("curl", ["-sL", "--max-time", "60", "-A", UA, "https://data.gdeltproject.org/gdeltv2/lastupdate.txt"], { encoding: "utf8" })
  const newest = last.match(/(\d{14})\.export/)?.[1]
  if (!newest) throw new Error("no last update")
  const at = Date.UTC(+newest.slice(0, 4), +newest.slice(4, 6) - 1, +newest.slice(6, 8), +newest.slice(8, 10), +newest.slice(10, 12))
  return Array.from({ length: SLICES }, (_, i) => new Date(at - i * 15 * 60_000).toISOString().replace(/[-:T]/g, "").slice(0, 14))
}

/* ------------------------------------------------------------------ the law */

// A bill's own page, on whichever site publishes it: the link that ties a
// story to a bill with no guessing at its name.
const BILL_LINK =
  /(congress\.gov\/bill|congress\.gov\/amendment|govinfo\.gov\/app\/details\/BILLS|legiscan\.com\/[A-Z]{2}\/bill|nysenate\.gov\/legislation\/bills|nyassembly\.gov\/leg|legislature\.[a-z.]+\/(bill|legislation)|leginfo\.legislature\.ca\.gov\/faces\/billTextClient|capitol\.texas\.gov\/BillLookup|malegislature\.gov\/Bills|ilga\.gov\/legislation|flsenate\.gov\/Session\/Bill|legis\.[a-z.]+\/(bill|legislation)|\.gov\/bills?\/)/i
const LEGISLATIVE = /LEGISLATION|GENERAL_GOVERNMENT|DEMOCRACY|ELECTION/

const GKG_COLS = { source: 3, url: 4, themes: 7, persons: 12, orgs: 14, tone: 15, quotations: 22, names: 23, amounts: 24, extras: 26 }
const tag = (extras, name) => extras.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1] ?? ""

const articles = []
const themeCounts = new Map()
const authorCounts = new Map()
const nameCounts = new Map()
const orgCounts = new Map()
const hourCounts = new Array(24).fill(0)
const billLinks = []
const amounts = []
const toneBins = new Map()

for (const stamp of stamps()) {
  const file = grab(`https://data.gdeltproject.org/gdeltv2/${stamp}.gkg.csv.zip`, "gkg")
  if (!file) {
    console.log(`${stamp} gkg: not published`)
    continue
  }
  let rows = 0
  let kept = 0
  for (const line of unzip(file).split("\n")) {
    const c = line.split("\t")
    if (c.length < 27) continue
    rows++
    const themes = c[GKG_COLS.themes] ?? ""
    if (!LEGISLATIVE.test(themes)) continue
    kept++
    const extras = c[GKG_COLS.extras] ?? ""
    const tone = Number((c[GKG_COLS.tone] ?? "").split(",")[0]) || 0
    const authors = tag(extras, "PAGE_AUTHORS")
      .split(/[;,]/)
      .map((a) => a.trim())
      .filter((a) => a && a.length < 40 && /^[A-Za-z][A-Za-z.'\- ]+$/.test(a))
    const links = tag(extras, "PAGE_LINKS").split(";")
    const pub = tag(extras, "PAGE_PRECISEPUBTIMESTAMP")
    const article = {
      source: c[GKG_COLS.source],
      url: c[GKG_COLS.url],
      title: tag(extras, "PAGE_TITLE").replace(/\s+/g, " ").trim(),
      tone,
      authors,
      pub,
      seen: stamp,
    }
    articles.push(article)
    if (pub.length >= 10) hourCounts[Number(pub.slice(8, 10))] = (hourCounts[Number(pub.slice(8, 10))] ?? 0) + 1
    const bin = Math.max(-10, Math.min(10, Math.round(tone)))
    toneBins.set(bin, (toneBins.get(bin) ?? 0) + 1)
    for (const theme of new Set(themes.split(";").filter(Boolean))) themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1)
    for (const author of authors) authorCounts.set(`${author}|${article.source}`, (authorCounts.get(`${author}|${article.source}`) ?? 0) + 1)
    for (const name of new Set((c[GKG_COLS.names] ?? "").split(";").map((n) => n.split(",")[0]).filter(Boolean))) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1)
    for (const org of new Set((c[GKG_COLS.orgs] ?? "").split(";").map((n) => n.split(",")[0]).filter(Boolean))) orgCounts.set(org, (orgCounts.get(org) ?? 0) + 1)
    for (const amount of (c[GKG_COLS.amounts] ?? "").split(";").filter(Boolean).slice(0, 4)) {
      const [value, what] = amount.split(",")
      if (Number(value) >= 1000 && what) amounts.push({ value: Number(value), what: what.trim().slice(0, 60), source: article.source, url: article.url })
    }
    for (const link of links) {
      if (!BILL_LINK.test(link)) continue
      billLinks.push({ link: link.slice(0, 220), title: article.title.slice(0, 140), source: article.source, url: article.url, tone })
    }
  }
  console.log(`${stamp} gkg: ${rows} articles, ${kept} on legislation, ${billLinks.length} bill links so far`)
}

/* --------------------------------------------------------------- the quotes */

// The Quotation Graph, a minute at a time: every quoted sentence, with the
// hundred characters each side. The words before a quote are usually who said
// it, which is how a quote gets a speaker without a model.
const quotes = []
const SAYS = /\b(Sen\.|Senator|Rep\.|Representative|Speaker|Gov\.|Governor|President|Secretary|Chairman|Chairwoman|Leader|Democrat|Republican)\b/
const ABOUT = /\b(bill|legislation|act\b|congress|senate|house|lawmakers?|statute|amendment|veto|filibuster)\b/i

for (const stamp of stamps().slice(0, 4)) {
  // The Quotation Graph publishes the minute after each 15-minute heartbeat:
  // 00:01, 00:16, 00:31, 00:46 (probed 2026-09-15; the mark itself is a 404).
  const at = Date.UTC(+stamp.slice(0, 4), +stamp.slice(4, 6) - 1, +stamp.slice(6, 8), +stamp.slice(8, 10), +stamp.slice(10, 12)) + 60_000
  const minute = new Date(at).toISOString().replace(/[-:T]/g, "").slice(0, 12) + "00"
  const file = grab(`https://data.gdeltproject.org/gdeltv3/gqg/${minute}.gqg.json.gz`, "quotes")
  if (!file) {
    console.log(`${minute} gqg: not published`)
    continue
  }
  let seen = 0
  for (const line of ungzip(file).split("\n")) {
    if (!line.trim()) continue
    let row
    try {
      row = JSON.parse(line)
    } catch {
      continue
    }
    seen += row.quotes?.length ?? 0
    for (const q of row.quotes ?? []) {
      const quote = String(q.quote ?? "").trim()
      const pre = String(q.pre ?? "").trim()
      if (quote.length < 60 || quote.length > 400) continue
      if (!ABOUT.test(quote) && !ABOUT.test(pre)) continue
      quotes.push({
        quote,
        pre: pre.slice(-100),
        post: String(q.post ?? "").trim().slice(0, 100),
        url: row.url,
        title: String(row.title ?? "").slice(0, 140),
        date: row.date ?? minute,
        named: SAYS.test(pre),
      })
    }
  }
  console.log(`${minute} gqg: ${seen} quotes, ${quotes.length} about legislation so far`)
}

/* --------------------------------------------------------- events, mentions */

const codes = new Map(
  execFileSync("curl", ["-sL", "--max-time", "60", "-A", UA, "https://gdeltproject.org/data/lookups/CAMEO.eventcodes.txt"], { encoding: "utf8" })
    .split("\n")
    .slice(1)
    .map((l) => l.split("\t"))
    .filter((p) => p.length === 2)
    .map(([code, label]) => [code.trim(), label.trim()])
)

const E = { id: 0, a1: 6, a1code: 5, a1type: 12, a2: 16, a2code: 15, a2type: 22, code: 26, root: 28, quad: 29, goldstein: 30, mentions: 31, sources: 32, articles: 33, tone: 34, geoCountry: 53, added: 59, url: 60 }
const legEvents = []
const eventTypes = new Map()
const mentions = []

for (const stamp of stamps()) {
  const evFile = grab(`https://data.gdeltproject.org/gdeltv2/${stamp}.export.CSV.zip`, "events")
  const mnFile = grab(`https://data.gdeltproject.org/gdeltv2/${stamp}.mentions.CSV.zip`, "mentions")
  if (evFile) {
    for (const line of unzip(evFile).split("\n")) {
      const c = line.split("\t")
      if (c.length < 61) continue
      if (c[E.geoCountry] !== "US") continue
      const types = [c[E.a1type], c[13], c[14], c[E.a2type], c[23], c[24]]
      if (!types.includes("LEG")) continue
      const label = codes.get(c[E.code]) ?? codes.get(c[E.root]) ?? c[E.code]
      eventTypes.set(label, (eventTypes.get(label) ?? 0) + 1)
      legEvents.push({
        id: c[E.id],
        from: c[E.a1] || c[E.a1code] || "—",
        to: c[E.a2] || c[E.a2code] || "—",
        label,
        tone: Number(c[E.tone]) || 0,
        goldstein: Number(c[E.goldstein]) || 0,
        mentions: Number(c[E.mentions]) || 0,
        sources: Number(c[E.sources]) || 0,
        url: c[E.url],
      })
    }
  }
  if (mnFile) {
    for (const line of unzip(mnFile).split("\n")) {
      const c = line.split("\t")
      if (c.length < 16) continue
      mentions.push({ id: c[0], eventAt: c[1], at: c[2], source: c[4], url: c[5], sentence: Number(c[6]) || 0, tone: Number(c[13]) || 0, confidence: Number(c[11]) || 0 })
    }
  }
  console.log(`${stamp} events: ${legEvents.length} with a legislature, mentions: ${mentions.length}`)
}

// The spread of one event: the legislative event with the most mentions in the
// slices read, every article that repeated it, in the order they did.
const byEvent = new Map()
for (const m of mentions) byEvent.set(m.id, [...(byEvent.get(m.id) ?? []), m])
const spreadId = legEvents
  .map((e) => ({ id: e.id, n: (byEvent.get(e.id) ?? []).length }))
  .sort((a, b) => b.n - a.n)[0]?.id
const spread = spreadId
  ? {
      event: legEvents.find((e) => e.id === spreadId),
      mentions: (byEvent.get(spreadId) ?? []).sort((a, b) => a.at.localeCompare(b.at)),
    }
  : null

/* ----------------------------------------------------------------- the file */

const top = (map, n) => [...map].sort((a, b) => b[1] - a[1]).slice(0, n)
const perDay = (n) => Math.round((n / SLICES) * 96)

const data = {
  readAt: new Date().toISOString().slice(0, 16).replace("T", " "),
  slices: SLICES,
  minutes: SLICES * 15,
  articles: { read: articles.length, perDay: perDay(articles.length) },
  bytes,
  perDayBytes: Object.fromEntries(Object.entries(bytes).map(([k, v]) => [k, Math.round((v / (k === "quotes" ? 4 : SLICES)) * 96)])),
  themes: top(themeCounts, 24),
  authors: top(authorCounts, 24).map(([key, n]) => ({ author: key.split("|")[0], source: key.split("|")[1], articles: n })),
  names: top(nameCounts, 30),
  orgs: top(orgCounts, 20),
  hours: hourCounts,
  tone: [...toneBins].sort((a, b) => a[0] - b[0]),
  billLinks: billLinks.slice(0, 40),
  billLinkCount: billLinks.length,
  amounts: amounts.sort((a, b) => b.value - a.value).slice(0, 12),
  quotes: quotes.slice(0, 40),
  quoteCount: quotes.length,
  events: { kept: legEvents.length, perDay: perDay(legEvents.length), types: top(eventTypes, 14), rows: legEvents.sort((a, b) => b.mentions - a.mentions).slice(0, 20) },
  mentions: { read: mentions.length, perDay: perDay(mentions.length) },
  spread,
}
writeFileSync(OUT, JSON.stringify(data))
console.log(
  `\nwrote ${(JSON.stringify(data).length / 1024).toFixed(0)}KB: ${articles.length} legislative articles, ${billLinks.length} bill links, ${quotes.length} quotes, ${legEvents.length} events, ${mentions.length} mentions`
)
console.log("downloaded:", Object.entries(bytes).map(([k, v]) => `${k} ${(v / 1e6).toFixed(1)}MB`).join(", "))
