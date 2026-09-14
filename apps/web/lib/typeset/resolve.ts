import "server-only"

import { q } from "@/lib/policy/db"

// Cited Works against the corpus (window 6, 2026-09-14): for each Work a
// citation names, the Expression in force on the citing document's date, the
// latest one, and what a reader should know about the difference. Read from
// the `expressions` index only (sql/005), never from S3, and kept per citing
// Expression, so a document's citations are resolved once, not per keystroke.

export type Advisory = { kind: "not-in-corpus" | "changed-since" | "later-than-citation"; text: string }

export type Resolution = {
  work: string
  found: boolean
  /** The Expression in force on the citing date, or the earliest when every Expression is later. */
  expression: string | null
  date: string | null
  latest: string | null
  label: string | null
  advisories: Advisory[]
}

const TTL_MS = 60 * 60 * 1000
const KEPT = 200
const kept = new Map<string, { at: number; value: Resolution }>()

const WORK = /^\/us(?:-[a-z]{2})?\/[a-z]+\/[A-Za-z0-9./-]+$/

export async function resolveWorks(works: string[], at: string | null, citing?: string | null): Promise<Record<string, Resolution>> {
  const date = at && /^\d{4}-\d{2}-\d{2}$/.test(at) ? at : null
  const key = (w: string) => `${citing ?? ""}|${date ?? ""}|${w}`
  const out: Record<string, Resolution> = {}
  const wanted: string[] = []
  for (const w of new Set(works)) {
    if (!WORK.test(w)) continue
    const hit = kept.get(key(w))
    if (hit && Date.now() - hit.at < TTL_MS) out[w] = hit.value
    else wanted.push(w)
  }
  if (!wanted.length) return out
  const list = wanted.slice(0, 1000)

  type Row = { work: string; expression: string; date: string; label: string | null }
  const [inForce, spans] = await Promise.all([
    q<Row>(
      `select distinct on (work) work, expression, expression_date::text as date, label
         from expressions where work = any($1::text[]) and ($2::date is null or expression_date <= $2::date)
        order by work, expression_date desc, unit desc`,
      [list, date]
    ),
    q<{ work: string; first: string; latest: string; first_expression: string; label: string | null }>(
      `select work, min(expression_date)::text as first, max(expression_date)::text as latest,
              (array_agg(expression order by expression_date, unit))[1] as first_expression, max(label) as label
         from expressions where work = any($1::text[]) group by work`,
      [list]
    ),
  ])
  const force = new Map(inForce.map((r) => [r.work, r]))
  const span = new Map(spans.map((r) => [r.work, r]))

  for (const work of list) {
    const s = span.get(work)
    const f = force.get(work)
    const advisories: Advisory[] = []
    let value: Resolution
    if (!s) {
      advisories.push({ kind: "not-in-corpus", text: "Not in the corpus yet." })
      value = { work, found: false, expression: null, date: null, latest: null, label: null, advisories }
    } else if (!f) {
      advisories.push({ kind: "later-than-citation", text: `Nothing stored from before ${date}; the earliest text is dated ${s.first}.` })
      value = { work, found: true, expression: s.first_expression, date: s.first, latest: s.latest, label: s.label, advisories }
    } else {
      if (s.latest > f.date) advisories.push({ kind: "changed-since", text: `Changed since: the text in force on ${date} is dated ${f.date}; the latest is dated ${s.latest}.` })
      value = { work, found: true, expression: f.expression, date: f.date, latest: s.latest, label: f.label ?? s.label, advisories }
    }
    out[work] = value
    kept.delete(key(work))
    kept.set(key(work), { at: Date.now(), value })
  }
  while (kept.size > KEPT * 50) kept.delete(kept.keys().next().value!)
  return out
}
