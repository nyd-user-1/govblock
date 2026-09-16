// One day of legislative news, out of GDELT's own files.
//
//   node scripts/gdelt/daily.mjs 2026-09-15 [--every 4]
//
// GDELT publishes a knowledge graph, an event table and a mentions table every
// fifteen minutes, and a quotation file every minute. This reads a day of them,
// keeps what concerns legislation, and writes one small file per day:
// apps/web/lib/data/gdelt-days/YYYY-MM-DD.json. The raw files are never kept —
// a day of them is about 430 MB and what survives the filter is under a
// megabyte.
//
// --every n reads one slice in every n (default 4, so one an hour). The whole
// day is --every 1, which is four times the download and the same shape of
// answer; the page says which was used.

import { execFileSync } from "node:child_process"
import { gunzipSync } from "node:zlib"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const DAY = process.argv[2] ?? new Date(Date.now() - 864e5).toISOString().slice(0, 10)
const EVERY = Number(process.argv[process.argv.indexOf("--every") + 1]) || 4
const OUT = new URL("../../apps/web/lib/data/gdelt-days.json", import.meta.url)
const FEEDS = JSON.parse(readFileSync(new URL("../../apps/web/lib/data/news-feeds.json", import.meta.url), "utf8"))
const DIR = join(tmpdir(), "gdelt-day")
mkdirSync(DIR, { recursive: true })

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
const bytes = { gkg: 0, events: 0, mentions: 0, quotes: 0 }

function grab(url, feed) {
  const file = join(DIR, url.split("/").pop())
  if (!existsSync(file)) {
    try {
      execFileSync("curl", ["-sfL", "--max-time", "300", "-A", UA, "-o", file, url])
    } catch {
      return null
    }
  }
  const size = existsSync(file) ? readFileSync(file).length : 0
  if (size < 100) return null
  bytes[feed] += size
  return file
}

const unzip = (file) => execFileSync("unzip", ["-p", file], { maxBuffer: 512 * 1024 * 1024, encoding: "utf8" })
const ungzip = (file) => gunzipSync(readFileSync(file)).toString("utf8")

/** The day's 15-minute stamps, one in every `EVERY`. */
const stamps = () => {
  const out = []
  for (let minute = 0; minute < 24 * 60; minute += 15 * EVERY) {
    const at = new Date(Date.parse(`${DAY}T00:00:00Z`) + minute * 60_000)
    out.push(at.toISOString().replace(/[-:T]/g, "").slice(0, 14))
  }
  return out
}

/* ------------------------------------------------------------- the states */

// Which state an outlet belongs to, from the feeds GovBlock already follows.
const OUTLET_STATE = new Map(FEEDS.map((f) => [new URL(f.url).host.replace(/^www\./, ""), f.state]))
const OUTLET_NAME = new Map(FEEDS.map((f) => [new URL(f.url).host.replace(/^www\./, ""), f.name.replace(/ — .*$/, "")]))

// Which jurisdiction a bill link belongs to, and what the bill is called.
const BILL_LINK =
  /(congress\.gov\/bill|congress\.gov\/amendment|govinfo\.gov\/app\/details\/BILLS|legiscan\.com\/[A-Z]{2}\/bill|nysenate\.gov\/legislation\/bills|nyassembly\.gov\/leg|legislature\.[a-z.]+\/(bill|legislation)|leginfo\.legislature\.ca\.gov\/faces\/billTextClient|capitol\.texas\.gov\/BillLookup|malegislature\.gov\/Bills|ilga\.gov\/legislation|flsenate\.gov\/Session\/Bill|legis\.[a-z.]+\/(bill|legislation)|\.gov\/bills?\/)/i

const HOST_STATE = [
  [/congress\.gov|govinfo\.gov|house\.gov|senate\.gov/i, "US"],
  [/nysenate\.gov|nyassembly\.gov/i, "NY"],
  [/leginfo\.legislature\.ca\.gov|assembly\.ca\.gov|senate\.ca\.gov/i, "CA"],
  [/capitol\.texas\.gov|legis\.texas\.gov/i, "TX"],
  [/malegislature\.gov/i, "MA"],
  [/ilga\.gov/i, "IL"],
  [/flsenate\.gov|myfloridahouse\.gov/i, "FL"],
  [/legislature\.mi\.gov/i, "MI"],
  [/legis\.wisconsin\.gov/i, "WI"],
  [/legislature\.ohio\.gov|ohiohouse\.gov|ohiosenate\.gov/i, "OH"],
  [/leg\.state\.nv\.us/i, "NV"],
  [/legislature\.idaho\.gov/i, "ID"],
  [/le\.utah\.gov/i, "UT"],
  [/legis\.la\.gov/i, "LA"],
  [/ncleg\.gov/i, "NC"],
  [/scstatehouse\.gov/i, "SC"],
  [/mgaleg\.maryland\.gov/i, "MD"],
  [/legis\.iowa\.gov/i, "IA"],
  [/kslegislature\.gov/i, "KS"],
  [/leg\.colorado\.gov/i, "CO"],
]

function stateOfLink(link) {
  const legiscan = link.match(/legiscan\.com\/([A-Z]{2})\//i)
  if (legiscan) return legiscan[1].toUpperCase()
  for (const [rule, state] of HOST_STATE) if (rule.test(link)) return state
  return null
}

function billOfLink(link) {
  const congress = link.match(/congress\.gov\/bill\/(\d+)[a-z]{2}-congress\/([a-z-]+)\/(\d+)/i)
  if (congress) {
    const kind = { "house-bill": "H.R.", "senate-bill": "S.", "house-resolution": "H.Res.", "senate-resolution": "S.Res.", "house-joint-resolution": "H.J.Res.", "senate-joint-resolution": "S.J.Res.", "house-concurrent-resolution": "H.Con.Res.", "senate-concurrent-resolution": "S.Con.Res." }
    return `${kind[congress[2].toLowerCase()] ?? congress[2]} ${congress[3]}`
  }
  const legiscan = link.match(/legiscan\.com\/[A-Z]{2}\/bill\/([A-Z]*\d+)/i)
  if (legiscan) return legiscan[1].toUpperCase()
  const ny = link.match(/nysenate\.gov\/legislation\/bills\/\d{4}\/(\w+)/i)
  if (ny) return ny[1].toUpperCase()
  const number = link.match(/(?:bill|billnumber|measure)[=/]([A-Z]{1,3}[-\s]?\d{1,5})/i)
  return number ? number[1].toUpperCase().replace(/[-\s]/, " ") : null
}

/* ------------------------------------------------------------ bill names */

// A story names a bill even when it does not link to it: GDELT's extracted
// names carry "Clarity Act", "One Big Beautiful Bill Act". Each 119th Congress
// title is registered whole and by every shorter tail that ends in "Act" and
// belongs to that bill alone — "digital asset market clarity act", "market
// clarity act", "clarity act" — so the press's short name finds the bill, and a
// tail shared by many bills ("protection act") finds nothing.
const TITLES = JSON.parse(readFileSync(new URL("./bill-titles-119.json", import.meta.url), "utf8"))
const BY_NAME = new Map()
const tails = new Map()
for (const [title, labels] of Object.entries(TITLES)) {
  if (labels.length === 1) BY_NAME.set(title, labels[0])
  const words = title.split(" ")
  for (let i = 1; i < words.length - 1; i++) {
    const tail = words.slice(i).join(" ")
    if (!tail.endsWith(" act") || tail.split(" ").length < 2) continue
    tails.set(tail, [...new Set([...(tails.get(tail) ?? []), ...labels])])
  }
}
for (const [tail, labels] of tails) if (labels.length === 1 && !BY_NAME.has(tail) && !TITLES[tail]) BY_NAME.set(tail, labels[0])

/* ---------------------------------------------------------------- the press */

// Every sitting legislator's press (Brendan, 2026-09-16): a story counts for a
// person when GDELT's extracted people name them and the story is about their
// state — or about the United States, for a member of Congress. A name several
// people share in the same place is left alone rather than guessed, except in
// Congress, where the current member list breaks the tie.
const LEGISLATORS = JSON.parse(readFileSync(new URL("./legislators.json", import.meta.url), "utf8"))
const SITTING = new Set(JSON.parse(readFileSync(new URL("../../apps/web/lib/data/members-us.json", import.meta.url), "utf8")).filter((m) => m.active).map((m) => String(m.people_id)))
const PRESS_OUT = new URL("../../apps/web/lib/data/gdelt-press.json", import.meta.url)
const press = new Map()

function pressFor(personNames, statesInStory, american, story) {
  for (const raw of personNames) {
    const ids = LEGISLATORS.names[raw.toLowerCase()]
    if (!ids) continue
    let fits = [...new Set(ids.map(String))].filter((id) => {
      const where = LEGISLATORS.people[id]?.state
      return where === "US" ? american : statesInStory.has(where)
    })
    if (fits.length > 1) fits = fits.filter((id) => SITTING.has(id))
    if (fits.length !== 1) continue
    const list = press.get(fits[0]) ?? []
    if (list.length < 12 && !list.some((x) => x.url === story.url)) list.push(story)
    press.set(fits[0], list)
  }
}

/* -------------------------------------------------------------- the reading */

const LEGISLATIVE = /LEGISLATION|GENERAL_GOVERNMENT|DEMOCRACY|ELECTION/
const GKG = { source: 3, url: 4, themes: 7, locations: 9, persons: 12, orgs: 14, tone: 15, image: 18, names: 23, extras: 26 }
const tag = (extras, name) => extras.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1] ?? ""

const bills = new Map()
const themeCounts = new Map()
const authorCounts = new Map()
const nameCounts = new Map()
const orgCounts = new Map()
const hourCounts = new Array(24).fill(0)
const toneBins = new Map()
const states = new Map()
let articles = 0
let toneTotal = 0

const stateRow = (code) => {
  if (!states.has(code)) states.set(code, { code, articles: 0, outlets: new Map(), bills: new Map(), names: new Map(), stories: [] })
  return states.get(code)
}

for (const stamp of stamps()) {
  const file = grab(`https://data.gdeltproject.org/gdeltv2/${stamp}.gkg.csv.zip`, "gkg")
  if (!file) continue
  for (const line of unzip(file).split("\n")) {
    const c = line.split("\t")
    if (c.length < 27) continue
    // Press about a legislator is press whatever it is about, so every article is read for people first.
    {
      const extras = c[GKG.extras] ?? ""
      const locations = (c[GKG.locations] ?? "").split(";")
      const american = locations.some((loc) => loc.split("#")[2] === "US")
      if (american) {
        const statesInStory = new Set(locations.map((loc) => loc.split("#")[3]).filter((adm1) => adm1 && /^US[A-Z]{2}$/.test(adm1)).map((adm1) => adm1.slice(2)))
        const outlet = OUTLET_STATE.get((c[GKG.source] ?? "").replace(/^www\./, ""))
        if (outlet) statesInStory.add(outlet)
        const personNames = [...new Set((c[GKG.persons] ?? "").split(";").map((n) => n.split(",")[0].trim()).filter((n) => n.includes(" ")))]
        if (personNames.length) {
          pressFor(personNames, statesInStory, american, {
            day: DAY,
            title: tag(extras, "PAGE_TITLE").replace(/\s+/g, " ").trim().slice(0, 160),
            url: c[GKG.url],
            source: (c[GKG.source] ?? "").replace(/^www\./, ""),
            image: c[GKG.image] || null,
            tone: Math.round((Number((c[GKG.tone] ?? "").split(",")[0]) || 0) * 10) / 10,
          })
        }
      }
    }
    if (!LEGISLATIVE.test(c[GKG.themes] ?? "")) continue
    articles++
    const extras = c[GKG.extras] ?? ""
    const tone = Number((c[GKG.tone] ?? "").split(",")[0]) || 0
    const source = c[GKG.source]
    const url = c[GKG.url]
    const title = tag(extras, "PAGE_TITLE").replace(/\s+/g, " ").trim()
    const pub = tag(extras, "PAGE_PRECISEPUBTIMESTAMP")
    toneTotal += tone
    toneBins.set(Math.max(-10, Math.min(10, Math.round(tone))), (toneBins.get(Math.max(-10, Math.min(10, Math.round(tone)))) ?? 0) + 1)
    if (pub.length >= 10) hourCounts[Number(pub.slice(8, 10))]++
    for (const theme of new Set((c[GKG.themes] ?? "").split(";").filter(Boolean))) themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1)
    for (const author of tag(extras, "PAGE_AUTHORS").split(/[;,]/).map((a) => a.trim()).filter((a) => a && a.length < 40 && /^[A-Za-z][A-Za-z.'\- ]+$/.test(a) && a.includes(" "))) {
      authorCounts.set(`${author}|${source}`, (authorCounts.get(`${author}|${source}`) ?? 0) + 1)
    }
    const people = [...new Set((c[GKG.names] ?? "").split(";").map((n) => n.split(",")[0]).filter(Boolean))]
    for (const name of people) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1)
    for (const org of new Set((c[GKG.orgs] ?? "").split(";").map((n) => n.split(",")[0]).filter(Boolean))) orgCounts.set(org, (orgCounts.get(org) ?? 0) + 1)

    // Which state the story belongs to: the states GDELT found named in it
    // (its location field carries ADM1 codes like USNY), and the outlet's own
    // state where GovBlock follows it. A story about Albany in a Texas paper
    // is New York's news; a Texas paper's own copy is Texas's.
    const host = source.replace(/^www\./, "")
    const outletState = OUTLET_STATE.get(host)
    const named = new Set(
      (c[GKG.locations] ?? "")
        .split(";")
        .map((loc) => loc.split("#")[3])
        .filter((adm1) => adm1 && /^US[A-Z]{2}$/.test(adm1))
        .map((adm1) => adm1.slice(2))
        .slice(0, 3)
    )
    if (outletState) named.add(outletState)
    for (const code of named) {
      const row = stateRow(code)
      row.articles++
      if (outletState === code) row.outlets.set(host, (row.outlets.get(host) ?? 0) + 1)
      for (const name of people.slice(0, 6)) row.names.set(name, (row.names.get(name) ?? 0) + 1)
      if (row.stories.length < 12 && title) row.stories.push({ title: title.slice(0, 140), url, source: host, tone })
    }

    // The bill a story links to: the one certain tie between coverage and legislation.
    const tie = (label, where, link, match) => {
      const key = `${where}:${label}`
      if (!bills.has(key)) bills.set(key, { label, state: where, link, stories: [], byLink: 0, byName: 0 })
      const bill = bills.get(key)
      if (bill.stories.some((x) => x.url === url)) return
      bill.stories.push({ title: title.slice(0, 140), url, source: host, tone, match })
      if (match === "link") bill.byLink++
      else bill.byName++
      const row = stateRow(where)
      row.bills.set(key, (row.bills.get(key) ?? 0) + 1)
    }
    for (const link of tag(extras, "PAGE_LINKS").split(";")) {
      if (!BILL_LINK.test(link)) continue
      const label = billOfLink(link)
      if (label) tie(label, stateOfLink(link) ?? "US", link.slice(0, 220), "link")
    }
    // And the bill a story names, where the story is about the United States.
    const american = (c[GKG.locations] ?? "").split(";").some((loc) => loc.split("#")[2] === "US")
    if (american) {
      for (const name of people) {
        if (!/\bAct$/.test(name)) continue
        const label = BY_NAME.get(name.toLowerCase())
        if (label) tie(label, "US", `https://www.congress.gov/search?q=${encodeURIComponent(JSON.stringify({ congress: "119", search: name }))}`, "name")
      }
    }
  }
  process.stdout.write(`${stamp} `)
}
console.log()

/* --------------------------------------------------------------- the quotes */

const ABOUT = /\b(congress|senate|house bill|senate bill|the house|lawmakers?|capitol hill|filibuster|state legislature|governor|h\.r\.|s\.\s?\d|[a-z]+ act\b|the bill|this bill|legislation)\b/i
const ELSEWHERE = /\b(parliament|lok sabha|rajya sabha|prime minister|westminster|holyrood|bundestag|knesset|duma|minister of|mps?\b|european union|brussels|ottawa|canberra)\b/i
const quotes = []
for (const stamp of stamps().filter((_, i) => i % 2 === 0)) {
  const minute = new Date(Date.parse(`${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(8, 10)}:${stamp.slice(10, 12)}:00Z`) + 60_000).toISOString().replace(/[-:T]/g, "").slice(0, 12) + "00"
  const file = grab(`https://data.gdeltproject.org/gdeltv3/gqg/${minute}.gqg.json.gz`, "quotes")
  if (!file) continue
  for (const line of ungzip(file).split("\n")) {
    if (!line.trim()) continue
    let row
    try {
      row = JSON.parse(line)
    } catch {
      continue
    }
    for (const q of row.quotes ?? []) {
      const quote = String(q.quote ?? "").trim()
      const pre = String(q.pre ?? "").trim()
      if (quote.length < 60 || quote.length > 400) continue
      if (!ABOUT.test(quote) && !ABOUT.test(pre)) continue
      if (ELSEWHERE.test(quote) || ELSEWHERE.test(pre)) continue
      quotes.push({ quote, pre: pre.slice(-100), url: row.url, title: String(row.title ?? "").slice(0, 140), host: (() => { try { return new URL(row.url).host.replace(/^www\./, "") } catch { return "" } })() })
    }
  }
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

const events = []
const eventTypes = new Map()
const mentionsBy = new Map()
let mentionRows = 0
for (const stamp of stamps()) {
  const evFile = grab(`https://data.gdeltproject.org/gdeltv2/${stamp}.export.CSV.zip`, "events")
  const mnFile = grab(`https://data.gdeltproject.org/gdeltv2/${stamp}.mentions.CSV.zip`, "mentions")
  if (evFile) {
    for (const line of unzip(evFile).split("\n")) {
      const c = line.split("\t")
      if (c.length < 61 || c[53] !== "US") continue
      if (![c[12], c[13], c[14], c[22], c[23], c[24]].includes("LEG")) continue
      const label = codes.get(c[26]) ?? codes.get(c[28]) ?? c[26]
      eventTypes.set(label, (eventTypes.get(label) ?? 0) + 1)
      events.push({ id: c[0], from: c[6] || c[5] || "—", to: c[16] || c[15] || "—", label, tone: Number(c[34]) || 0, mentions: Number(c[31]) || 0, sources: Number(c[32]) || 0, url: c[60] })
    }
  }
  if (mnFile) {
    for (const line of unzip(mnFile).split("\n")) {
      const c = line.split("\t")
      if (c.length < 16) continue
      mentionRows++
      mentionsBy.set(c[0], [...(mentionsBy.get(c[0]) ?? []), { at: c[2], source: c[4], sentence: Number(c[6]) || 0, tone: Number(c[13]) || 0 }])
    }
  }
}

const spreadId = events.map((e) => ({ id: e.id, n: (mentionsBy.get(e.id) ?? []).length })).sort((a, b) => b.n - a.n)[0]?.id
const spread = spreadId ? { event: events.find((e) => e.id === spreadId), mentions: (mentionsBy.get(spreadId) ?? []).sort((a, b) => a.at.localeCompare(b.at)) } : null

/* ----------------------------------------------------------------- the file */

const top = (map, n) => [...map].sort((a, b) => b[1] - a[1]).slice(0, n)
const byStories = [...bills.values()].sort((a, b) => b.stories.length - a.stories.length)

const day = {
  day: DAY,
  every: EVERY,
  slices: stamps().length,
  readAt: new Date().toISOString().slice(0, 16).replace("T", " "),
  articles,
  tone: articles ? Math.round((toneTotal / articles) * 100) / 100 : 0,
  toneBins: [...toneBins].sort((a, b) => a[0] - b[0]),
  hours: hourCounts,
  bills: byStories.slice(0, 100).map((b) => ({ ...b, stories: b.stories.slice(0, 6) })),
  billCount: bills.size,
  quotes: quotes.slice(0, 40),
  quoteCount: quotes.length,
  themes: top(themeCounts, 24),
  authors: top(authorCounts, 20).map(([key, n]) => ({ author: key.split("|")[0], source: key.split("|")[1], articles: n })),
  names: top(nameCounts, 30),
  orgs: top(orgCounts, 16),
  events: { kept: events.length, types: top(eventTypes, 12), rows: events.sort((a, b) => b.mentions - a.mentions).slice(0, 16) },
  mentions: mentionRows,
  spread,
  bytes,
  states: [...states.values()]
    .map((row) => ({
      code: row.code,
      articles: row.articles,
      outlets: top(row.outlets, 8).map(([host, n]) => ({ host, name: OUTLET_NAME.get(host) ?? host, articles: n })),
      bills: top(row.bills, 8).map(([key, n]) => ({ label: key.split(":")[1], stories: n })),
      names: top(row.names, 8),
      stories: row.stories.slice(0, 8),
    }))
    .sort((a, b) => b.articles - a.articles),
}

// Each legislator's press, newest day first, the last 24 stories kept.
const pressAll = existsSync(PRESS_OUT) ? JSON.parse(readFileSync(PRESS_OUT, "utf8")) : {}
for (const [id, stories] of press) {
  const kept = [...stories, ...(pressAll[id] ?? []).filter((old) => old.day !== DAY && !stories.some((x) => x.url === old.url))]
  pressAll[id] = kept.sort((a, b) => b.day.localeCompare(a.day)).slice(0, 24)
}
writeFileSync(PRESS_OUT, JSON.stringify(pressAll))
console.log(`press: ${press.size} legislators named, ${[...press.values()].reduce((n, l) => n + l.length, 0)} stories`)

// Every day in one file, keyed by date: the page imports it once and reads
// whichever day it needs.
const all = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {}
all[DAY] = day
writeFileSync(OUT, JSON.stringify(all))
console.log(
  `${DAY}: ${articles} legislative articles, ${bills.size} bills linked, ${quotes.length} quotes, ${events.length} events, ${mentionRows} mentions, ${day.states.length} states — ${(JSON.stringify(day).length / 1024).toFixed(0)}KB`
)
console.log("downloaded:", Object.entries(bytes).map(([k, v]) => `${k} ${(v / 1e6).toFixed(1)}MB`).join(", "))
