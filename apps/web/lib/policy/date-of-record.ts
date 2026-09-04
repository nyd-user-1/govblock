// The date of record for a version of a bill's text (Brendan, 2026-09-03:
// no more "fetched 5 days ago" — "the date of record specific to that
// file"). LegiScan dates only some documents (21,289 of 3.3 million texts in
// production), so when the document has no date of its own, the version's
// name is matched to the bill's own record — the action that produced it —
// and, failing that, the bill's status date.

export type Dated = { version: string | null; date?: string | null; fetched_at?: string | null; commit?: { author: string } | null }
export type Recorded = { history?: { date: string; action: string; sequence: number | string }[]; status_date?: string | null; last_action_date?: string | null }

const CUES: [RegExp, RegExp][] = [
  [/introduc|prefile|as filed|original|draft/i, /introduc|prefile|read (the )?first|filed/i],
  [/enroll/i, /enroll/i],
  [/engross/i, /engross/i],
  [/chapter|act no|signed|approved/i, /chapter|signed|approved|became law/i],
  [/comm(ittee)? sub|substitute/i, /substitute|reported|committee report|comm sub/i],
  [/amend/i, /amend/i],
  [/pass/i, /passed|third reading/i],
  [/reprint|print/i, /reprint|print/i],
]

export function dateOfRecord(version: Dated, bill: Recorded): string | null {
  if (version.commit) return version.date ?? version.fetched_at ?? null
  if (version.date) return version.date
  const history = [...(bill.history ?? [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : Number(a.sequence) - Number(b.sequence)))
  const name = version.version ?? ""
  for (const [cue, action] of CUES) {
    if (!cue.test(name)) continue
    if (cue.source.startsWith("introduc")) return history[0]?.date ?? bill.status_date ?? bill.last_action_date ?? null
    const hit = history.find((h) => action.test(h.action))
    if (hit) return hit.date
  }
  return bill.status_date ?? bill.last_action_date ?? history[0]?.date ?? null
}
