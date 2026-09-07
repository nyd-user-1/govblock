import "server-only"

import { n, q } from "@/lib/policy/db"
import type { Resolved } from "@/lib/policy/db-queries"

// The home page's analytics tiles (Brendan, 2026-09-07: Cloudflare's account
// home, adapted): one number a tile, with the days before it as a line and
// the change against the window before. Every metric is a count of rows by
// day out of the record we already hold — actions, roll calls, the calendar
// — so a tile is honest about what the legislature did in the window.

export type MetricKey = "votes" | "introduced" | "engrossed" | "passed" | "vetoed" | "hearings-scheduled" | "hearings-held" | "actions" | "amendments"

export const METRICS: { key: MetricKey; label: string; description: string }[] = [
  { key: "votes", label: "Total Votes", description: "Roll calls taken" },
  { key: "introduced", label: "Bills Introduced", description: "Bills introduced or prefiled" },
  { key: "engrossed", label: "Bills Engrossed", description: "Bills passed by one chamber" },
  { key: "passed", label: "Bills Passed", description: "Bills enacted, signed or chaptered" },
  { key: "vetoed", label: "Bills Vetoed", description: "Vetoes recorded" },
  { key: "hearings-scheduled", label: "Hearings Scheduled", description: "Hearings on the calendar ahead" },
  { key: "hearings-held", label: "Hearings Held", description: "Hearings the calendar shows held" },
  { key: "actions", label: "Actions", description: "Every action on every bill" },
  { key: "amendments", label: "Amendments", description: "Amendments offered, Congress only" },
]

export type MetricSeries = {
  key: MetricKey
  label: string
  days: number
  from: string
  to: string
  total: number
  /** The same count for the window before this one, for the change. */
  previous: number
  series: { date: string; value: number }[]
}

const day = (d: Date) => d.toISOString().slice(0, 10)
const shift = (from: string, days: number) => {
  const d = new Date(`${from}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return day(d)
}

/** The per-day counts for a metric in [from, to], as SQL over the record. */
function sqlFor(key: MetricKey): { sql: string; params: (f: Resolved, from: string, to: string) => unknown[] } | null {
  const scope = `b.state = $1 and b.session_id = $2`
  const history = (test: string) => ({
    sql: `select h.date as date, count(*)::int as value from "History Table" h join "Bills" b using (bill_id)
           where ${scope} and h.date >= $3 and h.date <= $4 and (${test}) group by 1 order by 1`,
    params: (f: Resolved, from: string, to: string) => [f.state, f.session, from, to],
  })
  switch (key) {
    case "votes":
      return {
        sql: `select r.date as date, count(*)::int as value from "Roll Call" r join "Bills" b using (bill_id)
               where ${scope} and r.date >= $3 and r.date <= $4 group by 1 order by 1`,
        params: (f, from, to) => [f.state, f.session, from, to],
      }
    case "actions":
      return history(`true`)
    case "introduced":
      return history(`h.action ~* '^(introduced|prefiled|filed|read first time|first reading|submitted in)'`)
    case "engrossed":
      return history(`h.action ~* '(passed (the )?(house|senate|assembly)|engrossed|passed/adopted|third reading passed|passed on third reading|adopted by (house|senate|assembly))' and h.action !~* 'motion|failed|reconsider'`)
    case "passed":
      return history(`h.action ~* '(became public law|became law|signed by (the )?governor|chaptered|enacted|approved by governor|signed into law)'`)
    case "vetoed":
      return history(`h.action ~* 'veto' and h.action !~* 'override'`)
    case "hearings-scheduled":
    case "hearings-held":
      return {
        sql: `select c.date as date, count(*)::int as value from "Calendar" c join "Bills" b using (bill_id)
               where ${scope} and c.date >= $3 and c.date <= $4 group by 1 order by 1`,
        params: (f, from, to) => [f.state, f.session, from, to],
      }
    case "amendments":
      return {
        sql: `select left(a.update_date::text, 10) as date, count(*)::int as value from congress_amendments a
               where $1 = 'US' and $2 = $2 and left(a.update_date::text, 10) >= $3 and left(a.update_date::text, 10) <= $4 group by 1 order by 1`,
        params: (f, from, to) => [f.state, f.session, from, to],
      }
    default:
      return null
  }
}

/**
 * One metric over the last `days` (or, for what is scheduled, the next
 * `days`), by day, with the window before it for the change.
 */
export async function getMetric(f: Resolved, key: MetricKey, days = 30): Promise<MetricSeries | null> {
  const def = METRICS.find((m) => m.key === key)
  const spec = sqlFor(key)
  if (!def || !spec) return null
  const today = day(new Date())
  const ahead = key === "hearings-scheduled"
  const from = ahead ? shift(today, 1) : shift(today, -(days - 1))
  const to = ahead ? shift(today, days) : today
  const prevFrom = ahead ? shift(today, -(days - 1)) : shift(from, -days)
  const prevTo = ahead ? today : shift(from, -1)
  const [rows, previous] = await Promise.all([q<{ date: string; value: number }>(spec.sql, spec.params(f, from, to)), q<{ date: string; value: number }>(spec.sql, spec.params(f, prevFrom, prevTo))])
  const byDay = new Map(rows.map((r) => [String(r.date).slice(0, 10), n(r.value)]))
  const series: { date: string; value: number }[] = []
  for (let d = from; d <= to; d = shift(d, 1)) series.push({ date: d, value: byDay.get(d) ?? 0 })
  const total = series.reduce((sum, r) => sum + r.value, 0)
  return { key, label: def.label, days, from, to, total, previous: previous.reduce((sum, r) => sum + n(r.value), 0), series }
}

/**
 * Bills introduced by each party, by month, for the last `months` — the
 * home page's red-and-blue bars (Brendan, 2026-09-07: "a measure of
 * something real"). Introduction is a bill's first action; the party is its
 * prime sponsor's.
 */
export async function getBillsByParty(f: Resolved, months = 6) {
  // The window ends at the session's own last introduction, not today: a
  // past session has months of its own to show (Brendan, 2026-09-07).
  const chamber = f.chamber ? ` and b.body = $3` : ""
  const params: unknown[] = f.chamber ? [f.state, f.session, f.chamber] : [f.state, f.session]
  const rows = await q<{ month: string; party: string; n: number }>(
    `with first as (
       select b.bill_id, min(h.date) as introduced
         from "Bills" b join "History Table" h using (bill_id)
        where b.state = $1 and b.session_id = $2${chamber} group by b.bill_id),
     span as (select left((max(introduced)::date - interval '${months} months')::text, 7) || '-01' as since from first)
     select left(f.introduced, 7) as month, coalesce(p.party, '?') as party, count(*)::int as n
       from first f
       join "Sponsors" s on s.bill_id = f.bill_id and s.sponsor_type_id = 1 and s.position = 1
       join "People" p using (people_id)
      where f.introduced >= (select since from span)
      group by 1, 2 order by 1`,
    params
  )
  const byMonth = new Map<string, { month: string; republican: number; democrat: number; other: number }>()
  for (const r of rows) {
    const m = byMonth.get(r.month) ?? { month: r.month, republican: 0, democrat: 0, other: 0 }
    const party = String(r.party).toUpperCase().charAt(0)
    if (party === "R") m.republican += n(r.n)
    else if (party === "D") m.democrat += n(r.n)
    else m.other += n(r.n)
    byMonth.set(r.month, m)
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-months)
}
