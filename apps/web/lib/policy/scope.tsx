"use client"

import * as React from "react"

import { FILTER_KEYS, readFilters, type Filters } from "@/lib/filters"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { useUrlParams } from "@/lib/policy/url-state"
import { usePolicy } from "@/lib/policy/use-policy"

// The scope a block reads, as one object: the jurisdiction (state + session,
// from the hook that already resolves them) and every filter the /create rail
// wrote into the URL. Before 2026-09-03 a block read `useJurisdiction()` and
// nothing else, so the customizer could change the state under it but not
// narrow it to a chamber, a party or a committee. Now the rail writes the
// filter keys into the URL — the same keys every legislative surface speaks —
// and a block that wants to follow reads them here.
//
// Three keys are the rail's own and not `lib/filters`': `cycle` (an FEC
// election cycle, for the finance block), `department` (who issues a form:
// the legislature, the executive, the FEC, or an agency code from the forms
// table) and `forms` (what the forms list admits: forms alone, every document,
// or the fillable ones), and `kind` (which card the stage shows: bills,
// members or committees — the stage's own switch came off on 2026-09-03 and
// the choice moved into the rail, where it rides the URL and the preset).

export const SCOPE_EXTRA_KEYS = ["cycle", "department", "forms", "kind"] as const
export type ScopeExtraKey = (typeof SCOPE_EXTRA_KEYS)[number]
export type ScopeFilters = Filters & Partial<Record<ScopeExtraKey, string>>

export const SCOPE_KEYS = [...FILTER_KEYS, ...SCOPE_EXTRA_KEYS] as const
export type ScopeKey = (typeof SCOPE_KEYS)[number]

export type Scope = {
  state: string
  session: number | null
  resolved: boolean
  /** Every non-empty filter in the URL, `state` and `session` included. */
  filters: ScopeFilters
}

export function useScope(): Scope {
  const { state, session, resolved } = useJurisdiction()
  const params = useUrlParams(SCOPE_KEYS)
  const filters = React.useMemo<ScopeFilters>(() => {
    const read = readFilters(params) as ScopeFilters
    for (const key of SCOPE_EXTRA_KEYS) if (params[key]) read[key] = params[key]
    read.state = state
    if (session) read.session = String(session)
    else delete read.session
    return read
  }, [params, state, session])
  return React.useMemo(() => ({ state, session, resolved, filters }), [state, session, resolved, filters])
}

type SessionRow = { session_id: number; bills: number; title: string }

/**
 * What the session in scope is called — "119th Congress", "2025-2026 Regular
 * Session" shortened to "2025-2026" — read from LegiScan's own titles, with the
 * bare number standing in until they arrive. Brendan, 2026-09-03: the drill
 * header said "Congress · 2025"; it should say "119th Congress".
 */
export function useSessionTitle(state: string, session: number | null) {
  const { data } = usePolicy<SessionRow[]>(session && state !== "US" ? "sessions" : null, { state }, { titles: 1 })
  if (state === "US") return session ? congressName(session) : ""
  const row = data?.find((r) => Number(r.session_id) === session)
  const title = row?.title?.replace(/\s*(Regular|General)\s+Session$/i, "").replace(/\s*Session$/i, "").trim()
  return title || (session ? String(session) : "")
}

/**
 * The Congress a session year belongs to, by name: 2025 is the 119th. LegiScan
 * titles Congress's sessions "2025-2026 Regular Session", which is not what
 * anyone calls it. The first Congress sat in 1789 and each sits for two years.
 */
export function congressName(year: number) {
  const n = Math.floor((year - 1789) / 2) + 1
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th"
  return `${n}${suffix} Congress`
}

/** The filters a bills read takes: the rail's, less the bill itself and the rail's own three keys. */
export function billFilters(f: ScopeFilters): Filters {
  const out: Filters = {}
  for (const key of FILTER_KEYS) if (key !== "bill" && f[key]) out[key] = f[key]
  return out
}

// The narrowing a block applies to rows it already holds. Each predicate
// answers "does this row survive the rail?" for the keys the row can carry;
// a key the row has no column for is not a reason to drop it.

export function billInScope(row: { body?: string | null; committee?: string | null; status_desc?: string | null; sponsor_party?: string | null; sponsor_id?: number | null }, f: ScopeFilters) {
  if (f.chamber && (row.body ?? "") !== f.chamber) return false
  if (f.committee && (row.committee ?? "") !== f.committee) return false
  if (f.status && (row.status_desc ?? "") !== f.status) return false
  if (f.party && row.sponsor_party !== undefined && (row.sponsor_party || "I") !== f.party) return false
  if (f.member && row.sponsor_id !== undefined && String(row.sponsor_id ?? "") !== f.member) return false
  return true
}

export function memberInScope(row: { people_id: number; chamber?: string | null; party?: string | null }, f: ScopeFilters) {
  if (f.chamber && (row.chamber ?? "") !== f.chamber) return false
  if (f.party && (row.party || "I") !== f.party) return false
  if (f.member && String(row.people_id) !== f.member) return false
  return true
}

export function committeeInScope(row: { committee_name: string; chamber?: string | null }, f: ScopeFilters) {
  if (f.chamber && (row.chamber ?? "") !== f.chamber) return false
  if (f.committee && row.committee_name !== f.committee) return false
  return true
}
