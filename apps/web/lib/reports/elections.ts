import "server-only"

import { n, q } from "@/lib/policy/db"

import type { ChartSpec } from "./chart-spec"

// Fifty years of House elections (2026-09-17): election returns alone — MIT
// Election Lab's House results, every general election since 1976; Carl
// Klarner's state legislative returns, 2008 to 2022; and FairVote's
// ranked-choice ballots. A race is close when the winner's lead over the
// runner-up is under ten points, uncontested when no one ran against the
// winner.

const SLUG = "house-elections"
const SOURCE = "MIT Election Data and Science Lab, U.S. House 1976–2024."

export type Cycle = { year: number; races: number; uncontested: number; close: number; veryClose: number; landslide: number }
export type Legislature = { year: number; seats: number; uncontested: number; close: number; open: number }

export async function electionsStudy() {
  const [house, states, rcv, worst] = await Promise.all([
    q<Cycle>(`
      select year, count(*)::int as races, count(*) filter (where not contested)::int as uncontested,
             count(*) filter (where contested and margin < 10)::int as close, count(*) filter (where contested and margin < 5)::int as "veryClose",
             count(*) filter (where not contested or margin >= 40)::int as landslide
        from election_races where office = 'US HOUSE' and stage = 'GEN' and not special group by 1 order by 1`),
    q<Legislature>(`
      select year, sum(seats_up)::int as seats, sum(uncontested)::int as uncontested, sum(close)::int as close, sum(open_seats)::int as open
        from chamber_results where source = 'klarner' and office in ('STATE HOUSE','STATE SENATE') group by 1 order by 1`),
    q<{ contests: number; comebacks: number; condorcet_miss: number; first: string; last: string }>(`
      select count(*)::int as contests, count(*) filter (where comeback)::int as comebacks,
             count(*) filter (where condorcet_winner is not null and condorcet_winner <> winner)::int as condorcet_miss,
             min(election_date)::text as first, max(election_date)::text as last from rcv_contests`),
    q<{ state: string; office: string; seats: number; uncontested: number }>(`
      select state, office, seats_up as seats, uncontested from chamber_results where source = 'klarner' and year = 2022 and office in ('STATE HOUSE','STATE SENATE') and seats_up >= 20
       order by uncontested::float / seats_up desc limit 6`),
  ])

  const cycles = house.map((c) => ({ year: n(c.year), races: n(c.races), uncontested: n(c.uncontested), close: n(c.close), veryClose: n(c.veryClose), landslide: n(c.landslide) }))
  const legislatures = states.map((s) => ({ year: n(s.year), seats: n(s.seats), uncontested: n(s.uncontested), close: n(s.close), open: n(s.open) }))
  const pick = (by: (c: Cycle) => number, dir: 1 | -1) => cycles.reduce((best, c) => (dir * by(c) > dir * by(best) ? c : best), cycles[0])
  const moments = {
    first: cycles[0],
    last: cycles[cycles.length - 1],
    mostUncontested: pick((c) => c.uncontested, 1),
    fewestClose: pick((c) => c.close, -1),
    mostClose: pick((c) => c.close, 1),
  }
  const decade = (from: number, to: number) => {
    const span = cycles.filter((c) => c.year >= from && c.year <= to)
    return { close: span.reduce((a, c) => a + c.close, 0) / (span.length || 1), uncontested: span.reduce((a, c) => a + c.uncontested, 0) / (span.length || 1) }
  }

  const charts: ChartSpec[] = [
    {
      id: "elections-house-close",
      report: SLUG,
      kind: "line",
      title: "House general elections: close races and uncontested seats",
      source: `${SOURCE} Close: won by under 10 points. Uncontested: no opponent on the ballot.`,
      format: "int",
      x: cycles.map((c) => String(c.year)),
      series: [
        { name: "Close races", tone: "one", values: cycles.map((c) => c.close) },
        { name: "Uncontested seats", tone: "two", values: cycles.map((c) => c.uncontested) },
      ],
    },
    {
      id: "elections-legislatures-uncontested",
      report: SLUG,
      kind: "columns",
      title: "State legislative seats with no opponent in November",
      source: "Klarner state legislative election returns, 2008–2022; lower and upper chambers.",
      format: "pct",
      columns: legislatures.map((s) => ({ label: String(s.year), value: s.seats ? s.uncontested / s.seats : 0, note: `${s.uncontested.toLocaleString("en-US")} of ${s.seats.toLocaleString("en-US")} seats` })),
    },
  ]

  const r = rcv[0]
  return {
    cycles,
    legislatures,
    moments,
    early: decade(1976, 1990),
    recent: decade(2012, 2024),
    rcv: { contests: n(r?.contests), comebacks: n(r?.comebacks), condorcetMiss: n(r?.condorcet_miss), first: r?.first ?? null, last: r?.last ?? null },
    worst: worst.map((w) => ({ state: w.state, office: w.office === "STATE HOUSE" ? "House" : "Senate", seats: n(w.seats), uncontested: n(w.uncontested) })),
    charts,
  }
}
