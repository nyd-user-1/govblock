import DAYS from "@/lib/data/gdelt-days.json"
import { membersNamed } from "@/lib/gdelt/derive"
import { speakerOf } from "@/lib/gdelt/files"

// A day of legislative news, and a state's share of it, out of the day files
// scripts/gdelt/daily.mjs writes. Nothing here calls GDELT or the database;
// the pages read this file and nothing else.

export type DayStory = { title: string; url: string; source: string; tone: number }
export type DayBill = { label: string; state: string; link: string; stories: DayStory[] }
export type DayState = {
  code: string
  articles: number
  outlets: { host: string; name: string; articles: number }[]
  bills: { label: string; stories: number }[]
  names: [string, number][]
  stories: DayStory[]
}
export type Day = {
  day: string
  every: number
  slices: number
  readAt: string
  articles: number
  tone: number
  toneBins: [number, number][]
  hours: number[]
  bills: DayBill[]
  billCount: number
  quotes: { quote: string; pre: string; url: string; title: string; host: string }[]
  quoteCount: number
  themes: [string, number][]
  authors: { author: string; source: string; articles: number }[]
  names: [string, number][]
  orgs: [string, number][]
  events: { kept: number; types: [string, number][]; rows: { id: string; from: string; to: string; label: string; tone: number; mentions: number; sources: number; url: string }[] }
  mentions: number
  spread: { event: { from: string; to: string; label: string; url: string }; mentions: { at: string; source: string; sentence: number; tone: number }[] } | null
  bytes: Record<string, number>
  states: DayState[]
}

const days = DAYS as unknown as Record<string, Day>

/** Every day on file, newest first. */
export const dayList = () => Object.keys(days).sort((a, b) => b.localeCompare(a))

export const getDay = (date: string): Day | null => days[date] ?? null

export const latestDay = () => dayList()[0] ?? null

const titleCase = (text: string) =>
  text
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length > 2 ? w[0]?.toUpperCase() + w.slice(1) : w))
    .join(" ")

/** The day's quotes, with the speaker read out of the words before each one. */
export const dayQuotes = (day: Day) =>
  day.quotes
    .map((q) => ({ ...q, speaker: speakerOf(q.pre) }))
    .filter((q): q is typeof q & { speaker: string } => Boolean(q.speaker))

/** The people the day's coverage named, sitting members marked. */
export function dayNames(day: Day) {
  const NOT_A_PERSON = /^(United States|United Kingdom|White House|New York|New Jersey|New Mexico|North|South|West|East|Washington|Supreme Court|Congress|Senate|House|Capitol Hill|European Union|Middle East|Puerto Rico|Los Angeles|Associated Press|Social Security|Wall Street)/i
  const merged = new Map<string, number>()
  for (const [raw, n] of day.names) {
    const name = raw.replace(/^(President|Vice President|Sen\.|Senator|Rep\.|Representative|Speaker|Gov\.|Governor|Secretary|Judge|Justice|Mr\.|Ms\.)\s+/i, "").trim()
    if (NOT_A_PERSON.test(name) || !name.includes(" ")) continue
    merged.set(name, (merged.get(name) ?? 0) + n)
  }
  return [...merged]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([name, articles]) => ({ name, articles, member: membersNamed(name)[0] ?? null }))
}

/** The day's subject codes, in words. */
export const dayThemes = (day: Day) =>
  day.themes
    .filter(([theme]) => !/^TAX_FNCACT$|^CRISISLEX|^USPEC|GENERAL1$|POLICY1$|^EPU_POLICY$|^WB_\d+$/.test(theme))
    .slice(0, 16)
    .map(([theme, articles]) => ({ code: theme, theme: titleCase(theme.replace(/^(TAX_FNCACT_|WB_\d+_|EPU_|SOC_|ECON_|UNGP_)/, "").replace(/_/g, " ")), articles }))

/** How one event spread, by the minute. */
export function daySpread(day: Day) {
  const s = day.spread
  if (!s?.mentions.length) return null
  const byMinute = new Map<string, number>()
  for (const m of s.mentions) byMinute.set(`${m.at.slice(8, 10)}:${m.at.slice(10, 12)}`, (byMinute.get(`${m.at.slice(8, 10)}:${m.at.slice(10, 12)}`) ?? 0) + 1)
  let running = 0
  return {
    event: s.event,
    curve: [...byMinute].sort((a, b) => a[0].localeCompare(b[0])).map(([at, n]) => ({ at, mentions: n, running: (running += n) })),
    total: s.mentions.length,
    outlets: new Set(s.mentions.map((m) => m.source)).size,
    lede: s.mentions.filter((m) => m.sentence <= 2).length,
  }
}

/** The day's filing hours, on Eastern time and a twelve-hour clock. */
export function dayHours(day: Day) {
  const eastern = new Array(24).fill(0)
  day.hours.forEach((articles, hour) => {
    eastern[(hour + 20) % 24] += articles
  })
  return eastern.map((articles, hour) => ({ hour: `${((hour + 11) % 12) + 1} ${hour < 12 ? "am" : "pm"}`, articles }))
}

/* ------------------------------------------------------------- the states */

/** Every state with coverage on file, across every day, busiest first. */
export function stateTotals() {
  const totals = new Map<string, { code: string; articles: number; days: number; bills: number; outlets: number }>()
  for (const date of dayList()) {
    for (const row of getDay(date)?.states ?? []) {
      const at = totals.get(row.code) ?? { code: row.code, articles: 0, days: 0, bills: 0, outlets: 0 }
      at.articles += row.articles
      at.days += 1
      at.bills += row.bills.length
      at.outlets = Math.max(at.outlets, row.outlets.length)
      totals.set(row.code, at)
    }
  }
  return [...totals.values()].sort((a, b) => b.articles - a.articles)
}

/** One state, across every day on file. */
export function stateRollup(code: string) {
  const outlets = new Map<string, { host: string; name: string; articles: number }>()
  const bills = new Map<string, number>()
  const names = new Map<string, number>()
  const stories: (DayStory & { day: string })[] = []
  const byDay: { day: string; articles: number }[] = []
  for (const date of dayList()) {
    const row = getDay(date)?.states.find((s) => s.code === code)
    if (!row) continue
    byDay.push({ day: date, articles: row.articles })
    for (const o of row.outlets) outlets.set(o.host, { ...o, articles: (outlets.get(o.host)?.articles ?? 0) + o.articles })
    for (const b of row.bills) bills.set(b.label, (bills.get(b.label) ?? 0) + b.stories)
    for (const [name, n] of row.names) names.set(name, (names.get(name) ?? 0) + n)
    for (const story of row.stories) stories.push({ ...story, day: date })
  }
  if (!byDay.length) return null
  return {
    code,
    days: byDay.sort((a, b) => b.day.localeCompare(a.day)),
    articles: byDay.reduce((n, d) => n + d.articles, 0),
    outlets: [...outlets.values()].sort((a, b) => b.articles - a.articles),
    bills: [...bills].sort((a, b) => b[1] - a[1]),
    names: [...names].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, articles]) => ({ name, articles, member: membersNamed(name)[0] ?? null })),
    stories: stories.slice(0, 16),
  }
}
