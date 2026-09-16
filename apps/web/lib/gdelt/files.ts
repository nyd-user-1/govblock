import FILES from "@/lib/data/gdelt-files.json"
import { membersNamed } from "@/lib/gdelt/derive"

// GDELT's file feeds, as snapshotted by scripts/gdelt/files.mjs: the knowledge
// graph, the event and mention tables, and the quotation graph, filtered to
// legislation. Every use case that fell out of reading them, shaped for
// /gdelt. The page never calls GDELT.

type Files = {
  readAt: string
  slices: number
  minutes: number
  articles: { read: number; perDay: number }
  bytes: Record<string, number>
  perDayBytes: Record<string, number>
  themes: [string, number][]
  authors: { author: string; source: string; articles: number }[]
  names: [string, number][]
  orgs: [string, number][]
  hours: number[]
  tone: [number, number][]
  billLinks: { link: string; title: string; source: string; url: string; tone: number }[]
  billLinkCount: number
  amounts: { value: number; what: string; source: string; url: string }[]
  quotes: { quote: string; pre: string; post: string; url: string; title: string; date: string; named: boolean }[]
  quoteCount: number
  events: { kept: number; perDay: number; types: [string, number][]; rows: { id: string; from: string; to: string; label: string; tone: number; goldstein: number; mentions: number; sources: number; url: string }[] }
  mentions: { read: number; perDay: number }
  spread: { event: { id: string; from: string; to: string; label: string; url: string }; mentions: { at: string; source: string; url: string; sentence: number; tone: number }[] } | null
}

export const files = FILES as unknown as Files

/** "20260916011500" → "01:15". */
const clock = (stamp: string) => `${stamp.slice(8, 10)}:${stamp.slice(10, 12)}`

const titleCase = (text: string) =>
  text
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length > 2 ? w[0]?.toUpperCase() + w.slice(1) : w))
    .join(" ")

/** A bill's own page, read out of the link an article carried. */
export function billOfLink(link: string): { label: string; where: string } {
  const congress = link.match(/congress\.gov\/bill\/(\d+)[a-z]{2}-congress\/([a-z-]+)\/(\d+)/i)
  if (congress) {
    const kind: Record<string, string> = { "house-bill": "H.R.", "senate-bill": "S.", "house-resolution": "H.Res.", "senate-resolution": "S.Res.", "house-joint-resolution": "H.J.Res.", "senate-joint-resolution": "S.J.Res.", "house-concurrent-resolution": "H.Con.Res.", "senate-concurrent-resolution": "S.Con.Res." }
    return { label: `${kind[congress[2]!.toLowerCase()] ?? congress[2]} ${congress[3]}`, where: `${congress[1]}th Congress` }
  }
  const legiscan = link.match(/legiscan\.com\/([A-Z]{2})\/bill\/([A-Z]*\d+)/i)
  if (legiscan) return { label: legiscan[2]!.toUpperCase(), where: legiscan[1]!.toUpperCase() }
  const ny = link.match(/nysenate\.gov\/legislation\/bills\/(\d{4})\/(\w+)/i)
  if (ny) return { label: ny[2]!.toUpperCase(), where: `New York ${ny[1]}` }
  const host = (() => {
    try {
      return new URL(link).host.replace(/^www\./, "")
    } catch {
      return link.slice(0, 30)
    }
  })()
  return { label: host, where: "a legislature's own site" }
}

/** Stories that linked to a bill's page, so the story is tied to the bill with no name matching. */
export const linkedBills = () =>
  files.billLinks.map((row) => ({ ...row, bill: billOfLink(row.link), host: (() => { try { return new URL(row.url).host.replace(/^www\./, "") } catch { return row.source } })() }))

/** Who writes the legislative coverage. */
export const reporters = () => files.authors.filter((a) => a.author.includes(" ")).slice(0, 18)

/** What hour of the day legislative news is published, from the outlets' own timestamps. */
export const publishingHours = () => files.hours.map((articles, hour) => ({ hour: `${String(hour).padStart(2, "0")}:00`, articles }))

// Places and institutions GDELT extracts as names; the panel is about people.
const NOT_A_PERSON =
  /^(United States|United Kingdom|White House|New Mexico|New York|New Jersey|North|South|West|East|Washington|Supreme Court|Congress|Senate|House|Capitol Hill|European Union|Middle East|Puerto Rico|Los Angeles|Associated Press|Social Security|Wall Street)/i

/** The people GDELT pulled out of legislative coverage, one entry each, with sitting members marked. */
export function namesInCoverage() {
  const merged = new Map<string, number>()
  for (const [raw, articles] of files.names) {
    // "President Donald Trump", "President Trump" and "Donald Trump" are one man.
    const name = raw.replace(/^(President|Vice President|Sen\.|Senator|Rep\.|Representative|Speaker|Gov\.|Governor|Secretary|Judge|Justice|Mr\.|Ms\.)\s+/i, "").trim()
    if (NOT_A_PERSON.test(name) || !name.includes(" ")) continue
    merged.set(name, (merged.get(name) ?? 0) + articles)
  }
  return [...merged]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, articles]) => ({ name, articles, member: membersNamed(name)[0] ?? null }))
}

export const organisations = () => files.orgs.slice(0, 14).map(([name, articles]) => ({ name: titleCase(name), articles }))

/** GDELT's own subject codes on the coverage, in words. */
export const themes = () =>
  files.themes
    // GDELT's own internal buckets ("USPEC_POLITICS_GENERAL1") say nothing a
    // reader can use; its subject themes do.
    .filter(([theme]) => !/^TAX_FNCACT$|^CRISISLEX|^USPEC|GENERAL1$|POLICY1$|^EPU_POLICY$|^WB_\d+$|^UNGP_FORESTS/.test(theme))
    .slice(0, 20)
    .map(([theme, articles]) => ({ theme: titleCase(theme.replace(/^(TAX_FNCACT_|WB_\d+_|EPU_|SOC_|ECON_|UNGP_)/, "").replace(/_/g, " ")), code: theme, articles }))

/** Quoted sentences about legislation, with the words that introduce them. */
export const quotes = () =>
  files.quotes
    .filter((q) => q.quote.length > 80)
    .sort((a, b) => Number(b.named) - Number(a.named))
    .slice(0, 18)
    .map((q) => ({ ...q, host: (() => { try { return new URL(q.url).host.replace(/^www\./, "") } catch { return "" } })() }))

/** The money the coverage names, once per figure: one wire story runs at dozens of sites. */
export function money() {
  const seen = new Set<string>()
  return files.amounts
    .filter((a) => {
      const key = `${a.value}|${a.what.toLowerCase()}`
      return !seen.has(key) && seen.add(key)
    })
    .slice(0, 10)
}

/** Who is publicly appealing to, praising or accusing a legislature. */
export const pressure = () => ({
  types: files.events.types.map(([label, n]) => ({ label, n })),
  rows: files.events.rows.filter((r) => r.from !== "—" || r.to !== "—").slice(0, 14),
  kept: files.events.kept,
  perDay: files.events.perDay,
})

/** How one story spread: every article that repeated the same event, in order. */
export function spread() {
  const s = files.spread
  if (!s?.mentions.length) return null
  const byMinute = new Map<string, number>()
  for (const m of s.mentions) {
    const key = clock(m.at)
    byMinute.set(key, (byMinute.get(key) ?? 0) + 1)
  }
  let running = 0
  const curve = [...byMinute].sort((a, b) => a[0].localeCompare(b[0])).map(([at, n]) => ({ at, mentions: n, running: (running += n) }))
  const lede = s.mentions.filter((m) => m.sentence <= 2).length
  return {
    event: s.event,
    curve,
    total: s.mentions.length,
    outlets: new Set(s.mentions.map((m) => m.source)).size,
    lede,
    buried: s.mentions.length - lede,
    tone: s.mentions.reduce((n, m) => n + m.tone, 0) / s.mentions.length,
    sources: [...new Set(s.mentions.map((m) => m.source))].slice(0, 24),
  }
}

/** The tone of every legislative article read, in bins. */
export const toneSpread = () => files.tone.map(([bin, articles]) => ({ bin, articles }))

/** What a day of these feeds costs to read and to keep. */
export function cost() {
  const day = files.perDayBytes
  const raw = Object.values(day).reduce((n, v) => n + v, 0)
  const keptPerDay = Math.round((JSON.stringify(files).length / files.minutes) * 1440)
  return {
    minutes: files.minutes,
    read: Object.entries(files.bytes).map(([feed, size]) => ({ feed, size, perDay: day[feed] ?? 0 })),
    rawPerDay: raw,
    rawPerYear: raw * 365,
    keptPerDay,
    keptPerYear: keptPerDay * 365,
  }
}
