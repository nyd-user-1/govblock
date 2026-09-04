"use client"

import * as React from "react"
import { useMyForks, type Fork } from "@/lib/policy/forks"

import { committeeOf, monthName, monthOf, type Node, type Target, voteKind } from "@/lib/create/path"
import { partyName, type Filters } from "@/lib/filters"
import { portraitFor } from "@/lib/imagery"
import { billFilters, billInScope, committeeInScope, memberInScope, type Scope } from "@/lib/policy/scope"
import { resolve as resolveSnapshot } from "@/lib/policy/snapshot"
import type { BillRow, Committee, MemberRow } from "@/lib/policy/types"
import { policyUrl, usePolicy } from "@/lib/policy/use-policy"

// One loader for every folder in the legislature. The rail's tree and the
// stage's table read the same rows through the same hook, so the two can
// never disagree about what is in a folder — GitHub's tree and its folder
// table are one listing, and so are ours.
//
// The customizer prunes: chamber, party, status and topic narrow every folder
// here. Chamber and party are never folders themselves (Brendan, 2026-09-03:
// "they feel like filters"); a committee's chamber is its type and a member's
// party is a column.
//
// Folders load when opened. Bills page in fifty at a time; everything else in
// a session is a few hundred rows and arrives whole.

export type Avatar =
  | { kind: "seal"; state: string; chamber?: string | null }
  | { kind: "portrait"; name: string; photoUrl: string | null; state: string; chamber: string; party: string; serving: boolean }
  | { kind: "folder" }

export type RollCallRow = { roll_call_id: number; date: string; chamber: string; description: string; yea: number; nay: number; total: number; bill_id: number; bill_number: string; title: string }
export type SessionRow = { session_id: number; bills: number; title?: string }
export type RosterRow = MemberRow & { votes: number; last_vote: string | null }

export type Row = {
  /** Stable, for tree state: `committees/Labor/bills`, `votes/2026-05/floor`, `bills/2157698`. */
  key: string
  name: string
  kind: "folder" | "file"
  /** What clicking writes into the URL. */
  go: Target
  description?: string | null
  date?: string | null
  count?: number | null
  avatar: Avatar
  record?:
    | { kind: "bill"; bill: BillRow }
    | { kind: "member"; member: MemberRow | RosterRow }
    | { kind: "committee"; committee: Committee }
    | { kind: "session"; session: SessionRow; current: boolean }
    | { kind: "rollcall"; rollcall: RollCallRow }
    | { kind: "fork"; fork: Fork }
}

export type Folder = {
  rows: Row[]
  total: number | null
  loading: boolean
  done: boolean
  more: () => void
}

const PAGE = 50
const REFRESH_MS = 60_000
const NONE: Row[] = []
const noop = () => {}

type BillsAnswer = { rows: BillRow[]; total: number }

// ── Bills: paged, refreshed at the head ─────────────────────────────────────

function usePagedBills(resource: string, filters: Filters | null, extra: Record<string, string | number | undefined>, resolved: boolean) {
  const key = resolved && filters ? policyUrl(resource, filters, { ...extra, limit: PAGE }) : null
  const [state, setState] = React.useState<{ key: string | null; rows: BillRow[]; total: number; loading: boolean; done: boolean }>({ key: null, rows: [], total: 0, loading: false, done: false })
  const inflight = React.useRef<string | null>(null)

  const fetchPage = React.useCallback(async (base: string, offset: number): Promise<BillsAnswer | null> => {
    const url = `${base}&offset=${offset}`
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`${response.status}`)
      return (await response.json()) as BillsAnswer
    } catch {
      const scopeState = new URL(url, "http://snapshot").searchParams.get("state") || "US"
      if (scopeState !== "US") return null
      return (resolveSnapshot(url) as BillsAnswer | undefined) ?? null
    }
  }, [])

  React.useEffect(() => {
    if (!key) return
    let cancelled = false
    inflight.current = `${key}:0`
    void fetchPage(key, 0).then((answer) => {
      if (cancelled) return
      inflight.current = null
      const rows = answer?.rows ?? []
      setState({ key, rows, total: answer?.total ?? rows.length, loading: false, done: rows.length < PAGE })
    })
    return () => {
      cancelled = true
    }
  }, [key, fetchPage])

  const more = React.useCallback(() => {
    if (!key || state.key !== key || state.loading || state.done) return
    const tag = `${key}:${state.rows.length}`
    if (inflight.current === tag) return
    inflight.current = tag
    setState((s) => ({ ...s, loading: true }))
    void fetchPage(key, state.rows.length).then((answer) => {
      if (inflight.current !== tag) return
      inflight.current = null
      setState((s) => {
        if (s.key !== key) return s
        const seen = new Set(s.rows.map((r) => r.bill_id))
        const fresh = (answer?.rows ?? []).filter((r) => !seen.has(r.bill_id))
        return { ...s, rows: [...s.rows, ...fresh], total: answer?.total ?? s.total, loading: false, done: (answer?.rows.length ?? 0) < PAGE }
      })
    })
  }, [key, state.key, state.loading, state.done, state.rows.length, fetchPage])

  React.useEffect(() => {
    if (!key) return
    const tick = () => {
      if (document.visibilityState !== "visible") return
      void fetchPage(key, 0).then((answer) => {
        if (!answer) return
        setState((s) => {
          if (s.key !== key) return s
          const seen = new Set(answer.rows.map((r) => r.bill_id))
          return { ...s, rows: [...answer.rows, ...s.rows.filter((r) => !seen.has(r.bill_id))], total: answer.total }
        })
      })
    }
    const timer = window.setInterval(tick, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [key, fetchPage])

  const stale = !!key && state.key !== key
  return { rows: stale ? [] : state.rows, total: stale ? null : state.total, loading: stale || state.loading, done: !stale && state.done, more }
}

// ── Rows ───────────────────────────────────────────────────────────────────

const billRow = (b: BillRow, state: string): Row => ({
  key: `bills/${b.bill_id}`,
  name: b.bill_number,
  kind: "file",
  go: { bill: String(b.bill_id), rollcall: null },
  description: b.title,
  date: b.last_action_date,
  avatar: { kind: "seal", state, chamber: b.body },
  record: { kind: "bill", bill: b },
})

const memberRow = (m: MemberRow | RosterRow, state: string): Row => ({
  key: `members/${m.people_id}`,
  name: m.name,
  kind: "file",
  go: { member: String(m.people_id), bill: null, rollcall: null },
  description: [m.chamber, m.district ? m.district.replace(/^[A-Z]+-0*/, "District ") : null, partyName(m.party), m.leadership_title].filter(Boolean).join(" · "),
  date: "last_vote" in m ? m.last_vote : null,
  count: "votes" in m ? m.votes : null,
  avatar: { kind: "portrait", name: m.name, photoUrl: portraitFor(m), state, chamber: m.chamber, party: m.party, serving: m.active ?? true },
  record: { kind: "member", member: m },
})

// Keyed by chamber and name: New York seats a Health committee in each house,
// and choosing one sets the chamber too, which is what tells them apart.
const committeeRow = (c: Committee, state: string): Row => ({
  key: `committees/${c.chamber ?? ""}/${c.committee_name}`,
  name: c.committee_name,
  kind: "folder",
  go: { committee: c.committee_name, chamber: c.chamber ?? null, at: null, member: null, bill: null, rollcall: null } as Target,
  description: c.chamber ? `${c.chamber} committee` : null,
  count: c.bills ?? 0,
  avatar: { kind: "seal", state, chamber: c.chamber },
  record: { kind: "committee", committee: c },
})

const rollCallRow = (r: RollCallRow, state: string, month: string, vote: "floor" | "committee"): Row => ({
  key: `rollcalls/${r.roll_call_id}`,
  name: r.description,
  kind: "file",
  go: { rollcall: String(r.roll_call_id), at: `votes/${month}/${vote}`, bill: null },
  description: r.bill_number,
  date: r.date,
  avatar: { kind: "seal", state, chamber: r.chamber },
  record: { kind: "rollcall", rollcall: r },
})

const latest = (dates: (string | null | undefined)[]) => dates.filter(Boolean).sort().reverse()[0] ?? null

// ── The hook ───────────────────────────────────────────────────────────────

export function useFolder(node: Node, scope: Scope): Folder {
  // The reader's forks, across jurisdictions: only fetched for that folder.
  const { forks, loading: forksLoading } = useMyForks(node.kind === "forks" ? undefined : -1)
  const { state, filters, resolved } = scope
  const session = filters.session
  const k = node.kind

  const wantsMembers = k === "root" || k === "members"
  const wantsCommittees = k === "root" || k === "committees"
  const wantsVotes = k === "root" || k === "votes" || k === "votes-month" || k === "votes-kind"
  const wantsSessions = k === "root" || k === "sessions"
  const wantsRoster = k === "committee" && node.sub === "members"

  const { data: members, isLoading: membersLoading } = usePolicy<MemberRow[]>(resolved && wantsMembers ? "members" : null, { state, session, chamber: filters.chamber, party: filters.party })
  const { data: committees, isLoading: committeesLoading } = usePolicy<Committee[]>(resolved && wantsCommittees ? "committees" : null, { state, session })
  const { data: rollcalls, isLoading: votesLoading } = usePolicy<RollCallRow[]>(resolved && wantsVotes ? "rollcalls" : null, { state, session })
  const { data: sessions } = usePolicy<SessionRow[]>(resolved && wantsSessions ? "sessions" : null, { state }, { titles: 1 })
  const { data: roster, isLoading: rosterLoading } = usePolicy<RosterRow[]>(resolved && wantsRoster ? "roster" : null, { state, session }, { name: k === "committee" ? node.name : undefined })

  // The bills a node lists: the session's, or a committee's (its referrals).
  const billResource = k === "committee" && node.sub === "bills" ? "committee-bills" : "bills"
  const billScope = React.useMemo<Filters | null>(() => {
    const base = billFilters(filters)
    delete base.committee
    delete base.member
    if (k === "bills" || k === "root") return base
    if (k === "committee" && node.sub === "bills") return base
    return null
  }, [k, filters, node])
  const bills = usePagedBills(billResource, billScope, k === "committee" ? { name: node.name } : {}, resolved)

  const sitting = React.useMemo(() => (members ?? []).filter((m) => m.active && memberInScope(m, filters)), [members, filters])
  const inCommittees = React.useMemo(() => (committees ?? []).filter((c) => committeeInScope(c, { ...filters, committee: undefined })), [committees, filters])
  const inVotes = React.useMemo(() => (rollcalls ?? []).filter((r) => !filters.chamber || r.chamber === filters.chamber || r.chamber === "J"), [rollcalls, filters.chamber])
  const inRoster = React.useMemo(() => (roster ?? []).filter((m) => memberInScope(m, { ...filters, member: undefined })), [roster, filters])

  return React.useMemo<Folder>(() => {
    switch (k) {
      case "sessions":
        return {
          rows: (sessions ?? []).map((row) => ({
            key: `sessions/${row.session_id}`,
            name: (row.title ?? String(row.session_id)).replace(/\s*(Regular|General)\s+Session$/i, "").replace(/\s*Session$/i, "").trim() || String(row.session_id),
            kind: "folder",
            go: { session: String(row.session_id), at: null, committee: null, member: null, bill: null, rollcall: null },
            description: Number(row.session_id) === Number(session) ? "In scope" : null,
            count: row.bills,
            avatar: { kind: "folder" },
            record: { kind: "session", session: row, current: Number(row.session_id) === Number(session) },
          })),
          total: sessions?.length ?? null,
          loading: !sessions,
          done: true,
          more: noop,
        }
      case "root": {
        const sessionBills = sessions?.find((s) => Number(s.session_id) === Number(session))?.bills ?? sessions?.[0]?.bills ?? null
        const billDate = latest(bills.rows.map((b) => b.last_action_date))
        const rows: Row[] = [
          { key: "bills", name: "Bills", kind: "folder", go: { at: "bills" }, description: "Every bill of the session, newest action first", count: bills.total ?? sessionBills, date: billDate, avatar: { kind: "folder" } },
          { key: "committees", name: "Committees", kind: "folder", go: { at: "committees" }, description: "Each with the bills referred to it and the members who vote in it", count: committees ? inCommittees.length : null, date: billDate, avatar: { kind: "folder" } },
          { key: "members", name: "Members", kind: "folder", go: { at: "members" }, description: "Who sits this session", count: members ? sitting.length : null, date: null, avatar: { kind: "folder" } },
          { key: "votes", name: "Votes", kind: "folder", go: { at: "votes" }, description: "Roll calls, by month, on the floor and in committee", count: rollcalls ? inVotes.length : null, date: latest(inVotes.map((r) => r.date)), avatar: { kind: "folder" } },
        ]
        return { rows, total: rows.length, loading: false, done: true, more: noop }
      }
      case "forks":
        return {
          rows: forks.map((f) => ({
            key: `forks/${f.id}`,
            name: f.bill_number ?? `Bill ${f.bill_id}`,
            kind: "file" as const,
            go: { bill: String(f.bill_id), fork: String(f.id), state: f.state, session: f.session_id ? String(f.session_id) : null, at: null, committee: null, member: null, rollcall: null },
            description: `${f.title ?? ""}`,
            date: f.created_at,
            count: f.commits,
            avatar: { kind: "seal" as const, state: f.state, chamber: null },
            record: { kind: "fork" as const, fork: f },
          })),
          total: forks.length,
          loading: forksLoading,
          done: true,
          more: () => {},
        }
      case "bills":
        return { rows: bills.rows.filter((b) => billInScope(b, { ...filters, committee: undefined, member: undefined })).map((b) => billRow(b, state)), total: bills.total, loading: bills.loading, done: bills.done, more: bills.more }
      case "committee":
        if (node.sub === "members") return { rows: inRoster.map((m) => memberRow(m, state)), total: roster ? inRoster.length : null, loading: rosterLoading && !roster, done: true, more: noop }
        return { rows: bills.rows.map((b) => billRow(b, state)), total: bills.total, loading: bills.loading, done: bills.done, more: bills.more }
      case "committees":
        return { rows: inCommittees.map((c) => committeeRow(c, state)), total: committees ? inCommittees.length : null, loading: committeesLoading && !committees, done: true, more: noop }
      case "members":
        return { rows: sitting.map((m) => memberRow(m, state)), total: members ? sitting.length : null, loading: membersLoading && !members, done: true, more: noop }
      case "votes": {
        const months = [...new Set(inVotes.map((r) => monthOf(r.date)))].filter(Boolean).sort().reverse()
        return {
          rows: months.map((m) => ({ key: `votes/${m}`, name: monthName(m), kind: "folder", go: { at: `votes/${m}`, rollcall: null }, count: inVotes.filter((r) => monthOf(r.date) === m).length, date: latest(inVotes.filter((r) => monthOf(r.date) === m).map((r) => r.date)), avatar: { kind: "folder" } })),
          total: months.length,
          loading: votesLoading && !rollcalls,
          done: true,
          more: noop,
        }
      }
      case "votes-month": {
        const inMonth = inVotes.filter((r) => monthOf(r.date) === node.month)
        const rows: Row[] = (["floor", "committee"] as const).map((vote) => {
          const these = inMonth.filter((r) => voteKind(r) === vote)
          return { key: `votes/${node.month}/${vote}`, name: vote === "floor" ? "Floor" : "Committee", kind: "folder", go: { at: `votes/${node.month}/${vote}`, rollcall: null }, description: vote === "floor" ? "Votes of the whole chamber" : [...new Set(these.map((r) => committeeOf(r.description)).filter(Boolean))].slice(0, 4).join(", ") || "Votes taken in committee", count: these.length, date: latest(these.map((r) => r.date)), avatar: { kind: "folder" } }
        })
        return { rows, total: 2, loading: votesLoading && !rollcalls, done: true, more: noop }
      }
      case "votes-kind": {
        const these = inVotes.filter((r) => monthOf(r.date) === node.month && voteKind(r) === node.vote).sort((a, b) => b.date.localeCompare(a.date) || b.roll_call_id - a.roll_call_id)
        return { rows: these.map((r) => rollCallRow(r, state, node.month, node.vote)), total: these.length, loading: votesLoading && !rollcalls, done: true, more: noop }
      }
      default:
        return { rows: NONE, total: null, loading: false, done: true, more: noop }
    }
  }, [k, node, state, session, filters, sessions, members, sitting, membersLoading, committees, inCommittees, committeesLoading, rollcalls, inVotes, votesLoading, bills, roster, inRoster, rosterLoading, forks, forksLoading])
}
