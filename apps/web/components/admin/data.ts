"use client"

import * as React from "react"

import { fmtNumber } from "@/lib/format"
import { useScope } from "@/lib/policy/scope"
import { usePolicy } from "@/lib/policy/use-policy"

// What the Admin pages read from the record, under the rail's scope. Each
// hook is one resource; a page calls the ones its shape needs, so opening
// Sales never pays for Database's ledgers.

export type Activity = {
  monthly: { ym: string; bills: number; senate: number; assembly: number }[]
  daily: { date: string; bills: number }[]
  rollCalls: { ym: string; roll_calls: number; yea: number; nay: number }[]
  statuses: { status: string; bills: number }[]
  committees: { committee: string; bills: number }[]
  total: number
}
export type AdoptedRow = { session_id: number; adopted: number; bills: number }
export type Sponsor = { people_id: number; name: string; party: string; role: string; chamber: string; district: string; photo_url: string | null; prime: number }
export type Committee = { committee_name: string; chamber: string; bills: number }
export type RollCall = { roll_call_id: number; date: string; chamber: string; description: string; yea: number; nay: number; total: number; bill_id: number; bill_number: string; title: string }
export type Member = { people_id: number; name: string; first_name: string; last_name: string; party: string; role: string; chamber: string; district: string; photo_url: string | null; leadership_title: string | null; active: boolean }
export type Seat = { chamber: string; party: string; seats: number }
export type StreamGroup = { state: string; session: number; bills: BillRow[] }
export type BillRow = { bill_id: number; bill_number: string; title: string; description: string; status_desc: string; last_action: string; last_action_date: string; committee: string | null; body: string; url: string; state_link: string; text_chars: number | null; sponsor: string | null; sponsor_party: string | null; sponsor_id: number | null }
export type Hearing = { date: string; time: string; type: string; description: string; location: string; bill_id: number; bill_number: string; title: string; committee: string | null; body: string | null; status_desc: string | null }
export type StateRow = { state: string; bills: number; latest_year: number; sessions: number }
export type Provenance = {
  totals: { bills: number; sessions: number; states: number; rollcalls: number; people: number; committees: number; texts: number }
  daily: { day: string; texts: number; datasets: number; bills: number }[]
  feeds: { legiscan_at: string | null; legiscan_delta_at: string | null; texts_at: string | null; texts_week: number; congress_at: string | null; congress_note: string | null; lobbying_at: string | null; fec_at: string | null; house_at: string | null; senate_at: string | null; laws_at: string | null; model_at: string | null }
  fresh: { state: string; last_action: string; bills: number; recent: number }[]
  coverage: { with_text: number; of: number }
}

function useRecord<T>(resource: string | null, extra: Record<string, string | number | undefined> = {}) {
  const scope = useScope()
  const filters = React.useMemo(() => ({ state: scope.state, session: scope.session ? String(scope.session) : undefined }), [scope.state, scope.session])
  const { data, isLoading } = usePolicy<T>(scope.resolved ? resource : null, filters, extra)
  return { data, pending: !scope.resolved || isLoading, scope }
}

export const useActivity = () => useRecord<Activity>("activity")
export const useAdopted = () => useRecord<AdoptedRow[]>("adopted")
export const useSponsors = (limit = 8) => useRecord<Sponsor[]>("sponsors", { limit })
export const useCommittees = () => useRecord<Committee[]>("committees")
export const useRollCalls = (limit = 120) => useRecord<RollCall[]>("rollcalls", { limit })
export const useMembers = () => useRecord<Member[]>("members")
export const useSeats = () => useRecord<Seat[]>("seats")
export const useBills = (limit = 20) => useRecord<{ rows: BillRow[]; total: number }>("bills", { limit })
// The hearings route is a Congress dataset and answers no other state; ask
// only where there is an answer, so the page does not sit through the
// retries a failed read earns.
export function useHearings(from: string, to: string) {
  const scope = useScope()
  return useRecord<Hearing[]>(scope.state === "US" ? "hearings" : null, { from, to })
}
export const useStates = () => useRecord<StateRow[]>("states")
export const useProvenance = () => useRecord<Provenance>("provenance")
export function useStream(limit = 12) {
  const scope = useScope()
  const { data, isLoading } = usePolicy<StreamGroup[]>(scope.resolved ? "stream" : null, { state: scope.state }, { states: scope.state, limit })
  return { data, pending: !scope.resolved || isLoading, scope }
}

/** The session before this one in the adopted series, for a "vs last session" trend. */
export function priorSession(rows: AdoptedRow[] | undefined, session: number | null) {
  if (!rows || !session) return null
  const sorted = [...rows].filter((r) => r.bills > 0).sort((a, b) => a.session_id - b.session_id)
  const i = sorted.findIndex((r) => r.session_id === session)
  return i > 0 ? sorted[i - 1] : null
}

/** A percentage change, one decimal, or 0 where there is nothing to compare. */
export function pct(now: number, before: number | null | undefined) {
  if (!before) return 0
  return Math.round(((now - before) / before) * 1000) / 10
}

export const num = (v: number | null | undefined) => fmtNumber(v ?? 0)

/** "2026-09-03 12:50:21.9+00" → "Sep 3, 12:50" or "—". */
export function fmtStamp(value: string | null | undefined) {
  if (!value) return "—"
  const d = new Date(value.replace(" ", "T"))
  if (!Number.isFinite(d.getTime())) return value
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

/** How long ago, in words. */
export function ago(value: string | null | undefined) {
  if (!value) return "never"
  const d = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}${/[+Z]/.test(value) ? "" : "Z"}`)
  const ms = Date.now() - d.getTime()
  if (!Number.isFinite(ms)) return value
  const h = Math.floor(ms / 36e5)
  if (h < 1) return "just now"
  if (h < 48) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
