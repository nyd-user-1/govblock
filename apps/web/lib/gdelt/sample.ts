import NEWS_FEEDS from "@/lib/data/news-feeds.json"
import SAMPLE from "@/lib/data/gdelt-sample.json"
import { FRAMES, frames, membersInCaption, membersNamed, sentiment, status, type Mood } from "@/lib/gdelt/derive"

// The /gdelt demo (Brendan, 2026-09-15: "a /gdelt page that shows each item
// as it might look"): GDELT's answers for one bill, snapshotted by
// scripts/gdelt/sample.mjs, shaped here for the page. Nothing calls GDELT at
// request time. An answer the snapshot does not hold yet comes back null.

type Point = { date: string; value: number; norm?: number }
type Series = { series: string; data: Point[] }
type Article = { url: string; title: string; seendate: string; socialimage?: string; domain: string; language?: string; sourcecountry?: string }
type ContextArticle = Article & { sentence: string; context?: string; isquote?: number }
type ToneBin = { bin: number; count: number; toparts?: { url: string; title: string }[] }
type Clip = { preview_url?: string; ia_show_id: string; date: string; station: string; show: string; preview_thumb?: string; snippet: string }

const answers = (SAMPLE as { answers?: Record<string, unknown> }).answers ?? {}
const answer = <T>(key: string) => (answers[key] as T | undefined) ?? null

export const phrase = (SAMPLE as { phrase?: string }).phrase ?? "SAVE Act"
export const span = (SAMPLE as { span?: { start: string; end: string } }).span ?? { start: "", end: "" }
export const tvSpan = (SAMPLE as { tvSpan?: { start: string; end: string } }).tvSpan ?? { start: "", end: "" }

/** "20260915T201654Z" → "2026-09-15". */
const day = (stamp: string) => `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`

const timeline = (key: string) => answer<{ timeline?: Series[] }>(key)?.timeline ?? null

/** A timelinevolraw answer as the share of all monitored US coverage, per day. */
function share(key: string) {
  const series = timeline(key)?.[0]
  if (!series) return null
  return series.data.map((p) => ({ date: day(p.date), articles: p.value, share: p.norm ? (p.value / p.norm) * 100 : 0 }))
}

// The bill's own actions in the span, from congress_bill_actions (read
// 2026-09-15): the SAVE America Act's two introductions are the only ones.
const ACTIONS = [{ date: "2026-01-29", label: "S. 3752 and H.R. 7296 introduced" }]

/** 1 · The attention curve, its three highest days at least two weeks apart, its trend, and the bill's actions. */
export function attention() {
  const rows = share("volume")
  if (!rows) return null
  const peaks: typeof rows = []
  for (const row of [...rows].sort((a, b) => b.share - a.share)) {
    if (peaks.length === 3) break
    if (row.share > 0 && peaks.every((p) => Math.abs(Date.parse(p.date) - Date.parse(row.date)) > 14 * 864e5)) peaks.push(row)
  }
  const sum = (list: typeof rows) => list.reduce((n, r) => n + r.articles, 0)
  const last30 = sum(rows.slice(-30))
  const prior30 = sum(rows.slice(-60, -30))
  const counts = rows.map((r) => r.articles).sort((a, b) => a - b)
  const median = counts[Math.floor(counts.length / 2)] ?? 0
  return {
    rows,
    peaks: peaks.sort((a, b) => a.date.localeCompare(b.date)),
    total: sum(rows),
    last30,
    change: prior30 ? Math.round(((last30 - prior30) / prior30) * 100) : null,
    median,
    surges: rows.filter((r) => median > 0 && r.articles >= median * 3).length,
    actions: ACTIONS.filter((a) => rows.some((r) => r.date === a.date)),
  }
}

/** The articles the Context API returned with their sentences. */
const contextArticles = () => answer<{ articles?: (Article & { sentence: string; isquote?: number })[] }>("context")?.articles ?? null

/** 2 · Headlines, newest first: the article list, or the Context API's articles while it is missing. */
export function headlines() {
  const list = answer<{ articles?: Article[] }>("articles")?.articles ?? contextArticles()
  if (!list) return null
  const seen = new Set<string>()
  return list
    .filter((a) => !seen.has(a.url) && seen.add(a.url))
    .sort((a, b) => b.seendate.localeCompare(a.seendate))
    .map((a) => ({ url: a.url, title: a.title, date: day(a.seendate), domain: a.domain, image: a.socialimage || null }))
}

/** 3 · Sentiment of the sentences that name the bill and of the TV captions, by word list. */
export function moods() {
  const said = sentences() ?? []
  const clips = television()?.clips ?? []
  const tally = (items: { mood: Mood }[]) => ({
    negative: items.filter((i) => i.mood === "negative").length,
    neutral: items.filter((i) => i.mood === "neutral").length,
    positive: items.filter((i) => i.mood === "positive").length,
  })
  const press = said.map((s) => ({ ...s, ...sentiment(s.sentence) }))
  const tv = clips.map((c) => ({ ...c, ...sentiment(c.snippet) }))
  if (!press.length && !tv.length) return null
  const byScore = [...press].sort((a, b) => a.score - b.score)
  return {
    press: tally(press),
    tv: tally(tv),
    negative: byScore.slice(0, 3),
    positive: byScore.slice(-3).reverse().filter((s) => s.score > 0),
  }
}

/** The scores themselves, counted: how far from neutral the coverage runs. */
export function scoreSpread() {
  const said = sentences()
  if (!said?.length) return null
  const counts = new Map<number, number>()
  for (const s of said) {
    const score = Math.max(-8, Math.min(8, sentiment(s.sentence).score))
    counts.set(score, (counts.get(score) ?? 0) + 1)
  }
  return [...counts].sort((a, b) => a[0] - b[0]).map(([score, sentences]) => ({ score, sentences }))
}

/** Which outlets are hardest on it: the average score of each outlet's sentences. */
export function moodByOutlet() {
  const said = sentences()
  if (!said?.length) return null
  const byOutlet = new Map<string, { total: number; n: number }>()
  for (const s of said) {
    const at = byOutlet.get(s.domain) ?? { total: 0, n: 0 }
    byOutlet.set(s.domain, { total: at.total + sentiment(s.sentence).score, n: at.n + 1 })
  }
  return [...byOutlet]
    .map(([domain, { total, n }]) => ({ domain, sentences: n, average: Math.round((total / n) * 10) / 10 }))
    .sort((a, b) => a.average - b.average)
    .slice(0, 10)
}

/** Sentiment against framing: does the integrity frame read differently from the access frame? */
export function moodByFrame() {
  const said = sentences()
  if (!said?.length) return null
  return FRAMES.map((f) => {
    const matched = said.filter((s) => frames(s.sentence).some((x) => x.key === f.key))
    const scores = matched.map((s) => sentiment(s.sentence).score)
    return {
      key: f.key,
      label: f.label,
      sentences: matched.length,
      average: scores.length ? Math.round((scores.reduce((n, v) => n + v, 0) / scores.length) * 10) / 10 : 0,
      negative: scores.filter((v) => v <= -1).length,
      positive: scores.filter((v) => v >= 1).length,
    }
  })
}

/** How the sentences frame the bill. */
export function framing() {
  const said = sentences()
  if (!said) return null
  return FRAMES.map((f) => {
    const matched = said.map((s) => ({ ...s, frame: frames(s.sentence).find((x) => x.key === f.key) })).filter((s) => s.frame)
    const terms = new Map<string, number>()
    for (const s of matched) for (const t of s.frame!.terms) terms.set(t.toLowerCase(), (terms.get(t.toLowerCase()) ?? 0) + 1)
    return { key: f.key, label: f.label, count: matched.length, terms: [...terms].sort((a, b) => b[1] - a[1]), example: matched[0]?.sentence ?? null }
  })
}

/** What the sentences say has happened to it. */
export function standing() {
  const said = sentences()
  if (!said) return null
  const groups = { stalled: [] as typeof said, moving: [] as typeof said, state: [] as typeof said }
  for (const s of said) {
    const found = status(s.sentence)
    if (found) groups[found].push(s)
  }
  return { total: said.length, groups }
}

/** The sitting members of Congress the sentences and captions name, most often first. */
export function members() {
  const said = sentences() ?? []
  const clips = television()?.clips ?? []
  if (!said.length && !clips.length) return null
  const counts = new Map<number, { member: ReturnType<typeof membersNamed>[number]; press: number; tv: number }>()
  for (const s of said) for (const m of membersNamed(s.sentence)) counts.set(m.id, { member: m, press: (counts.get(m.id)?.press ?? 0) + 1, tv: counts.get(m.id)?.tv ?? 0 })
  for (const c of clips) for (const m of membersInCaption(c.snippet)) counts.set(m.id, { member: m, press: counts.get(m.id)?.press ?? 0, tv: (counts.get(m.id)?.tv ?? 0) + 1 })
  return [...counts.values()].sort((a, b) => b.press + b.tv - (a.press + a.tv))
}

/** The same sentence at more than one outlet: wire copy and syndication. */
export function syndicated() {
  const list = contextArticles()
  if (!list) return null
  const bySentence = new Map<string, Set<string>>()
  for (const a of list) {
    if (!a.sentence) continue
    bySentence.set(a.sentence, (bySentence.get(a.sentence) ?? new Set()).add(a.domain))
  }
  return [...bySentence]
    .filter(([, domains]) => domains.size > 1)
    .map(([sentence, domains]) => ({ sentence, domains: [...domains] }))
    .sort((a, b) => b.domains.length - a.domains.length)
}

/** The TV programs that carried the clips, most clips first. */
export function programs() {
  const clips = television()?.clips
  if (!clips?.length) return null
  const counts = new Map<string, { show: string; station: string; clips: number }>()
  for (const c of clips) counts.set(`${c.station}:${c.show}`, { show: c.show, station: c.station, clips: (counts.get(`${c.station}:${c.show}`)?.clips ?? 0) + 1 })
  return [...counts.values()].sort((a, b) => b.clips - a.clips)
}

/** 3 · Average tone per day, and how the articles fall across tone. */
export function tone() {
  const series = timeline("tone")?.[0]
  const bins = answer<{ tonechart?: ToneBin[] }>("toneChart")?.tonechart
  if (!series && !bins) return null
  const sorted = [...(bins ?? [])].sort((a, b) => a.bin - b.bin)
  const firstWith = (list: ToneBin[]) => list.find((b) => b.toparts?.length)
  return {
    rows: series?.data.map((p) => ({ date: day(p.date), tone: Math.round(p.value * 100) / 100 })) ?? null,
    bins: sorted.map((b) => ({ bin: b.bin, count: b.count })),
    negative: firstWith(sorted)?.toparts?.slice(0, 3) ?? [],
    positive: firstWith([...sorted].reverse())?.toparts?.slice(0, 3) ?? [],
  }
}

const FEED_STATE = new Map(
  (NEWS_FEEDS as { state: string; url: string; name: string }[]).map((f) => [new URL(f.url).host.replace(/^www\./, ""), { state: f.state, name: f.name.replace(/ — .*$/, "") }]),
)

/** 4 · The outlets that ran it, most articles first; the ones GovBlock already follows carry their state. */
export function outlets() {
  const list = headlines()
  if (!list) return null
  const counts = new Map<string, number>()
  for (const a of list) counts.set(a.domain, (counts.get(a.domain) ?? 0) + 1)
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 24)
    .map(([domain, articles]) => ({ domain, articles, feed: FEED_STATE.get(domain.replace(/^www\./, "")) ?? null }))
}

/** 5 · National TV: mentions per week by network, each network's share, and the clips. */
export function television() {
  const series = timeline("tvVolume")
  const stations = answer<{ stationchart?: { station: string; count: number }[] }>("tvStations")?.stationchart
  const clips = answer<{ clips?: Clip[] }>("tvClips")?.clips
  if (!series && !stations && !clips) return null
  const networks = (series ?? []).filter((s) => s.data.some((p) => p.value > 0)).map((s) => s.series)
  const weeks = new Map<string, Record<string, number | string>>()
  for (const s of series ?? []) {
    if (!networks.includes(s.series)) continue
    for (const p of s.data) {
      const d = new Date(Date.parse(day(p.date)))
      d.setUTCDate(d.getUTCDate() - d.getUTCDay())
      const week = d.toISOString().slice(0, 10)
      const row = weeks.get(week) ?? { week }
      const key = `n${networks.indexOf(s.series)}`
      row[key] = Math.round(((Number(row[key]) || 0) + p.value) * 1000) / 1000
      weeks.set(week, row)
    }
  }
  return {
    networks,
    weeks: [...weeks.values()].sort((a, b) => String(a.week).localeCompare(String(b.week))),
    stations: (stations ?? []).filter((s) => s.count > 0).sort((a, b) => b.count - a.count).map((s) => ({ station: s.station, share: Math.round(s.count * 10000) / 100 })),
    // One clip per station, show and caption: the gallery repeats a clip when
    // the phrase is said more than once in a show.
    clips: dedupe(clips ?? []).map((c) => ({
      station: c.station,
      show: c.show,
      date: c.date.slice(0, 10),
      snippet: c.snippet,
      thumb: c.preview_thumb ?? null,
      url: `https://archive.org/details/${c.ia_show_id}`,
    })),
  }
}

const dedupe = (clips: Clip[]) => {
  const seen = new Set<string>()
  return clips.filter((c) => {
    const key = `${c.station}|${c.show}|${c.snippet.trim().toLowerCase()}`
    return !seen.has(key) && seen.add(key)
  })
}

/** The sentences that name it, from GDELT's Context API. */
export function sentences() {
  const list = answer<{ articles?: ContextArticle[] }>("context")?.articles
  if (!list) return null
  const seen = new Set<string>()
  return list
    .filter((a) => a.sentence && !seen.has(a.sentence) && seen.add(a.sentence))
    .map((a) => ({ sentence: a.sentence, url: a.url, title: a.title, domain: a.domain, date: day(a.seendate), quote: a.isquote === 1 }))
}

/** Its attention beside two other election bills'. */
export function comparison() {
  const keys = Object.keys(answers).filter((k) => k.startsWith("compare:"))
  const own = share("volume")
  if (!own || !keys.length) return null
  const names = [phrase, ...keys.map((k) => k.slice("compare:".length))]
  const lists = [own, ...keys.map((k) => share(k) ?? [])]
  const weeks = new Map<string, Record<string, number | string>>()
  lists.forEach((rows, i) => {
    for (const r of rows) {
      const d = new Date(Date.parse(r.date))
      d.setUTCDate(d.getUTCDate() - d.getUTCDay())
      const week = d.toISOString().slice(0, 10)
      const row = weeks.get(week) ?? { week }
      row[`s${i}`] = Math.round(((Number(row[`s${i}`]) || 0) + r.articles) * 100) / 100
      weeks.set(week, row)
    }
  })
  return { names, weeks: [...weeks.values()].sort((a, b) => String(a.week).localeCompare(String(b.week))) }
}

/** Which countries' press covered it, by total volume across the year. */
export function world() {
  const series = timeline("world")
  if (!series) return null
  return series
    .map((s) => ({ country: s.series.replace(/ Volume Intensity$/, ""), volume: Math.round(s.data.reduce((n, p) => n + p.value, 0) * 100) / 100 }))
    .filter((c) => c.volume > 0)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 15)
}
