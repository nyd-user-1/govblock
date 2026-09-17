// A chamber's seats and the rules the simulator runs on them. One module for
// /simulator's chamber view and /simulator/map, so the two can never disagree.
//
// Every seat is placed by where it was decided: in the general election
// (a margin under 20 points), or before it — won by 20 points or more, or
// with no opponent at all — which is to say in the primary. The rules move
// that: pooling the party primaries into one open primary (top two or top
// four advancing) sends a settled seat back to November wherever two of the
// advancing candidates come from the party that holds it, so all voters
// choose between them; a uniform swing shifts every contested seat's
// two-party share and flips the ones that cross 50.

import { STATE_NAMES, lowerChamber } from "@/lib/filters"

import { person } from "./names"

/** One seat's race as published in a map results file (scripts/elections/map.mjs). */
export type Post = {
  post: string | null
  seats: number
  contested: boolean
  margin: number | null
  share: number | null
  open: boolean | null
  winners: { name: string; party: string }[]
  candidates: { name: string; party: string; votes: number }[]
}
export type Results = Record<string, Post[]>

/** One race's primaries as published in a top-two file (load.mjs top-two). */
export type PrimaryRace = {
  year: number
  state: string
  office: string
  district: string
  label: string
  system: string
  complete: boolean
  missing: string | null
  candidates: { name: string; party: string; primary: number | null; general: number | null; winner?: boolean; incumbent?: boolean }[]
  top_two: string[] | null
  general_two: string[]
  general_winner: string
  same_party: boolean | null
  differs: boolean | null
}

export type Party = "D" | "R" | "I" | "O"
export type Tier = "live" | "safe" | "nobody"
export type Decided = "november" | "primary" | "nobody"

export type Seat = {
  id: string
  key: string
  post: string | null
  party: Party
  /** Democratic share of the two-party vote, or null when one of the two did not run. */
  share: number | null
  contested: boolean
  margin: number | null
  tier: Tier
  winner: string
  candidates: Post["candidates"]
}

export type SimSeat = Seat & {
  now: Party
  shareNow: number | null
  decided: Decided
  race?: PrimaryRace
  moved: boolean
  matchup: string[] | null
}

export type Rule = { kind: "all" | "held" | "top2" | "top4" | "swing" | "matched"; swing: number }

export const PARTY_NAME: Record<Party, string> = { D: "Democrats", R: "Republicans", I: "Independents", O: "Others" }

export const norm = (p: string | null | undefined): Party =>
  p === "D" || p === "DFL" || p === "WFP" ? "D" : p === "R" || p === "CON" ? "R" : p === "I" || p === "IND" ? "I" : "O"

export const chamberName = (st: string, office: string) =>
  office === "US HOUSE" ? "U.S. House" : st === "NE" ? "Legislature" : office === "STATE SENATE" ? "Senate" : lowerChamber(st)
export const chamberLong = (st: string, office: string) => (st === "US" ? "House of Representatives" : `${STATE_NAMES[st] ?? st} ${chamberName(st, office)}`)
export const subjectName = (st: string, office: string, year: number) => `${st === "US" ? "" : `${STATE_NAMES[st] ?? st} `}${chamberName(st, office)}, ${year}`

export function seatsFrom(results: Results): Seat[] {
  const seats: Seat[] = []
  for (const key of Object.keys(results)) {
    for (const p of results[key]) {
      let D = 0
      let R = 0
      for (const c of p.candidates) {
        const q = norm(c.party)
        if (q === "D") D += c.votes
        else if (q === "R") R += c.votes
      }
      let party = norm(p.winners[0]?.party)
      // A winner whose party the loader lost (names with quotation marks) takes the party of the top vote.
      if (party === "O" && p.candidates.length) party = norm([...p.candidates].sort((a, b) => b.votes - a.votes)[0].party)
      const share = D && R ? (D / (D + R)) * 100 : null
      const tier: Tier = p.contested === false ? "nobody" : (p.margin ?? 0) >= 20 ? "safe" : "live"
      seats.push({ id: key + (p.post ? `·${p.post}` : ""), key, post: p.post, party, share, contested: p.contested, margin: p.margin, tier, winner: person(p.winners[0]?.name ?? ""), candidates: p.candidates })
    }
  }
  return seats
}

/** Primaries keyed like the seats: "TX-28" for the House, the district alone ("5", "belknap8") in a state chamber. */
export function primaryIndex(races: PrimaryRace[], st = "US"): Record<string, PrimaryRace> {
  const idx: Record<string, PrimaryRace> = {}
  for (const r of races) {
    const d = /^\d+$/.test(r.district) ? String(Number(r.district)) : r.district.toLowerCase().replace(/\s+/g, "")
    idx[st === "US" ? `${r.state}-${d}` : d] = r
  }
  return idx
}

const decidedOf = (s: Seat): Decided => (s.tier === "live" ? "november" : s.tier === "safe" ? "primary" : "nobody")
const dShare = (s: Seat) => s.share ?? (s.party === "D" ? 100 : s.party === "R" ? 0 : 50)

/** Seats by party then closeness: the safest Democratic seat first, the safest Republican last, the seam in the middle. */
export function orderSeats<T extends Seat>(seats: T[]): T[] {
  return [...seats].sort((a, b) => dShare(b) - dShare(a) || a.id.localeCompare(b.id))
}

/** The names advancing from one pooled primary. */
export function advancing(race: PrimaryRace, pool: "two" | "four"): string[] {
  const cands = race.candidates.filter((c) => (c.primary ?? 0) > 0).sort((a, b) => (b.primary ?? 0) - (a.primary ?? 0))
  if (pool === "four") return cands.slice(0, 4).map((c) => c.name)
  return race.top_two ?? cands.slice(0, 2).map((c) => c.name)
}

const clean = (n: string) => n.replace(/\s*#\s*$/, "").trim()

export function simulate(seats: Seat[], rule: Rule, row: { dem_vote_share: number | null } | null, prim: Record<string, PrimaryRace> | null): SimSeat[] {
  const keyOf = (s: Seat) => (/^\d+$/.test(s.key) ? String(Number(s.key)) : s.key)
  const base: SimSeat[] = seats.map((s) => ({ ...s, now: s.party, shareNow: s.share, decided: decidedOf(s), race: prim?.[keyOf(s)], moved: false, matchup: null }))
  if (rule.kind === "all" || rule.kind === "held") return base
  if (rule.kind === "swing" && rule.swing) {
    return base.map((s) => {
      if (s.share == null || s.party === "I" || s.party === "O") return s
      const sh = s.share - rule.swing
      return { ...s, now: sh > 50 ? "D" : "R", shareNow: sh }
    })
  }
  if (rule.kind === "matched" && row?.dem_vote_share != null) {
    const n = seats.length
    const dSeats = Math.round((row.dem_vote_share / 100) * n)
    const set = new Set(orderSeats(seats).slice(0, dSeats).map((s) => s.id))
    return base.map((s) => ({ ...s, now: set.has(s.id) ? "D" : "R" }))
  }
  if ((rule.kind === "top2" || rule.kind === "top4") && prim) {
    const pool = rule.kind === "top4" ? "four" : "two"
    return base.map((s) => {
      const r = s.race
      if (!r || r.system !== "party primaries" || !r.complete) return s
      const adv = advancing(r, pool)
      const find = (n: string) => r.candidates.find((c) => c.name === n) ?? r.candidates.find((c) => clean(c.name) === clean(n))
      const parties = adv.map((n) => find(n)?.party ?? "?")
      const within = parties.filter((p) => norm(p) === s.party).length
      const matchup = adv.map((n, i) => `${person(n)} (${parties[i]})`)
      if (within >= 2 && s.decided !== "november") return { ...s, decided: "november", moved: true, matchup }
      return { ...s, matchup }
    })
  }
  return base
}

export type Tally = Record<Party, number>
export function tally(seats: SimSeat[]): Tally {
  const t: Tally = { D: 0, R: 0, I: 0, O: 0 }
  for (const s of seats) t[s.now]++
  return t
}
export const flipped = (seats: SimSeat[]) => seats.filter((s) => s.now !== s.party)
export const control = (t: Tally, n: number): Party | null => {
  const need = Math.floor(n / 2) + 1
  return t.D >= need ? "D" : t.R >= need ? "R" : null
}

/** Who decided the seats: the general vote where November decided, the winning party's primary vote where it did not. */
export function electorate(seats: SimSeat[]) {
  const gen = (s: SimSeat) => s.candidates.reduce((a, c) => a + c.votes, 0)
  const prim = (s: SimSeat) => (s.race ? s.race.candidates.filter((c) => norm(c.party) === s.party).reduce((a, c) => a + (c.primary ?? 0), 0) : 0)
  return {
    general: seats.reduce((a, s) => a + gen(s), 0),
    settledPrimary: seats.filter((s) => s.tier !== "live").reduce((a, s) => a + prim(s), 0),
    settledNow: seats.filter((s) => s.tier !== "live").reduce((a, s) => a + (s.moved ? gen(s) : prim(s)), 0),
  }
}

/** Everyone of voting age in the country the chamber sits in, for the share the settled seats' deciders make of it. */
export const VOTING_AGE: Record<string, { people: number; cvap: number; source: string }> = {
  US: { people: 333.3e6, cvap: 233.5e6, source: "Census Bureau, Current Population Survey, November 2022; Vintage 2022 population estimate" },
}

export const million = (v: number) => `${(v / 1e6).toFixed(1).replace(/\.0$/, "")} million`

export function seatName(st: string, seat: Seat) {
  if (st === "US") {
    const [s, n] = seat.key.split("-")
    return n === "0" ? `${STATE_NAMES[s] ?? s} at large` : `${STATE_NAMES[s] ?? s} District ${n}`
  }
  return `District ${seat.key.replace(/^([a-z]+)(\d*)$/, (_, a: string, b: string) => `${a[0].toUpperCase()}${a.slice(1)} ${b}`)}${seat.post ? `, seat ${seat.post}` : ""}`
}
export const seatShort = (st: string, seat: Seat) => (st === "US" ? (seat.key.endsWith("-0") ? `${seat.key.slice(0, 2)} at large` : seat.key) : seat.key + (seat.post ? `·${seat.post}` : ""))
