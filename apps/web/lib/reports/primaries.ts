import "server-only"

import { n, q } from "@/lib/policy/db"

import type { ChartSpec } from "./chart-spec"

// The primary is the election (2026-09-18), research recipe report #5.
//
// 1. Question: how many House seats are decided before November, how few
//    voters decide them, and what would a top-two primary change?
// 2. Coverage: MIT Election Lab House general elections, 1976–2024; the FEC's
//    candidate-by-candidate primary and general votes, House and Senate,
//    2008–2022, and state legislative primaries 2014–2018, in the races where
//    every candidate's votes are on file (top_two_races, complete).
// 3–4. Classify: a seat is *settled before November* when it was
//    uncontested or won by 20 points or more (the simulator's rule). A race
//    *changes under top-two* when the two candidates with the most primary
//    votes, all parties pooled, are not the two who met in November.
// 5. Verify: incumbent primary defeats are not counted from this data, whose
//    incumbent flags are unreliable before 2012; they are cited from
//    Ballotpedia.
// 6. Outside: Ballotpedia's counts of incumbents defeated in primaries.

const SLUG = "primary-is-the-election"

export async function primariesStudy() {
  const [settled, rows, topTwo] = await Promise.all([
    q<{ year: number; races: number; settled: number; uncontested: number }>(`
      select year, count(*)::int as races, count(*) filter (where not contested or margin >= 20)::int as settled, count(*) filter (where not contested)::int as uncontested
        from election_races where office = 'US HOUSE' and stage = 'GEN' and not special group by 1 order by 1`),
    // A year at a time: the candidate lists together pass the Data API's one-megabyte answer.
    Promise.all([2008, 2010, 2012, 2014, 2016, 2018, 2020, 2022].map((y) => q<{ year: number; c: string }>(`select year, candidates::text as c from top_two_races where office = 'US HOUSE' and complete and system = 'party primaries' and year = $1`, [y]))).then((parts) => parts.flat()),
    q<{ year: number; office: string; races: number; differs: number; same: number }>(`
      select year, office, count(*)::int as races, count(*) filter (where differs)::int as differs, count(*) filter (where same_party)::int as same
        from top_two_races where complete and system = 'party primaries' group by 1,2 order by 2,1`),
  ])

  // The primary that decided a settled seat: the winner's party's primary
  // votes against every vote cast for the seat in November.
  const decided = new Map<number, { settled: number; primary: number; general: number }>()
  for (const r of rows) {
    const cs = JSON.parse(r.c) as { party: string; general?: number | null; primary?: number | string | null }[]
    const gen = cs.filter((c) => (c.general ?? 0) > 0).sort((a, b) => (b.general ?? 0) - (a.general ?? 0))
    const total = gen.reduce((a, c) => a + (c.general ?? 0), 0)
    const [w, ru] = gen
    if (!w || !total) continue
    const margin = ((w.general! - (ru?.general ?? 0)) / total) * 100
    if (ru && margin < 20) continue
    const y = n(r.year)
    const e = decided.get(y) ?? { settled: 0, primary: 0, general: 0 }
    e.settled++
    e.primary += cs.filter((c) => c.party === w.party && typeof c.primary === "number").reduce((a, c) => a + (c.primary as number), 0)
    e.general += total
    decided.set(y, e)
  }
  const deciders = [...decided].sort((a, b) => a[0] - b[0]).map(([year, e]) => ({ year, settled: e.settled, primary: e.primary, general: e.general, share: e.general ? e.primary / e.general : 0 }))

  const cycles = settled.map((s) => ({ year: n(s.year), races: n(s.races), settled: n(s.settled), uncontested: n(s.uncontested), share: n(s.races) ? n(s.settled) / n(s.races) : 0 }))
  const house = topTwo.filter((t) => t.office === "US HOUSE").map((t) => ({ year: n(t.year), races: n(t.races), differs: n(t.differs), same: n(t.same) }))
  const legislatures = topTwo.filter((t) => t.office.startsWith("STATE")).reduce((a, t) => ({ races: a.races + n(t.races), differs: a.differs + n(t.differs), same: a.same + n(t.same) }), { races: 0, differs: 0, same: 0 })

  const charts: ChartSpec[] = [
    {
      id: "primaries-settled",
      report: SLUG,
      kind: "columns",
      title: "House seats settled before November, 1976–2024",
      source: "MIT Election Data and Science Lab; settled means uncontested or won by 20 points or more.",
      format: "pct",
      columns: cycles.map((c) => ({ label: String(c.year), value: c.share, note: `${c.settled} of ${c.races} seats` })),
    },
    {
      id: "primaries-top-two",
      report: SLUG,
      kind: "bar",
      title: "House races a top-two primary would have sent to November with two candidates of one party",
      source: "FEC primary and general votes by candidate, in races with every candidate's votes on file.",
      format: "pct",
      bars: house.map((h) => ({ label: String(h.year), value: h.races ? h.same / h.races : 0, note: `${h.same} of ${h.races} races · ${h.differs} with a different pair` })),
    },
  ]

  return { cycles, deciders, house, legislatures, charts }
}
