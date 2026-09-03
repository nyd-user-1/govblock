"use client"

import * as React from "react"

import { billFilters, billInScope, committeeInScope, memberInScope, type Scope } from "@/lib/policy/scope"
import { resolve as resolveSnapshot } from "@/lib/policy/snapshot"
import { policyUrl, usePolicy } from "@/lib/policy/use-policy"
import { BillCard, CommitteeCard, MemberCard, type Bill, type Committee, type Drill, type Member } from "@/components/create/entity-card"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"

export type Entity = "bill" | "member" | "committee"

// Slot 01: the cards. One component — the card — in whichever version is
// chosen, in a grid that scrolls. The bills page in from the database as the
// reader nears the bottom, and the top of the list is asked again every minute
// so a bill that moved lands at the head without a reload. Members and
// committees arrive whole (a chamber is a few hundred people) and are revealed
// a screen at a time, which keeps the first paint light.
//
// The grid stops where the record stops. Brendan asked for "never reaching the
// end"; the honest version is that the next page is always requested before
// the reader gets there, and when the jurisdiction has no more bills under
// these filters the list says so rather than repeating itself.

const PAGE = 24
const REFRESH_MS = 60_000

type BillsAnswer = { rows: Bill[]; total: number }

function useBillFeed(scope: Scope) {
  const { filters, resolved } = scope
  const key = resolved ? policyUrl("bills", billFilters(filters), { limit: PAGE }) : null
  const [state, setState] = React.useState<{ key: string | null; rows: Bill[]; total: number; loading: boolean; done: boolean }>({ key: null, rows: [], total: 0, loading: false, done: false })
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

  // A new key starts over: the first page, and nothing from the old scope.
  // Until it lands the held rows are stale (`state.key !== key`) and the grid
  // shows its skeleton rather than the old scope's bills.
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

  // The head of the list, again, every minute the tab is visible.
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
  return { rows: stale ? [] : state.rows, total: state.total, loading: state.loading || stale, done: state.done, more }
}

// A screen more each time the sentinel comes into view. The count belongs to
// the list it was counted against: a new list starts at one screen again.
function useReveal<T>(items: T[], step = PAGE) {
  const [reveal, setReveal] = React.useState<{ of: T[]; count: number }>({ of: items, count: step })
  const count = reveal.of === items ? reveal.count : step
  return { shown: items.slice(0, count), done: count >= items.length, more: () => setReveal({ of: items, count: Math.min(items.length, count + step) }) }
}

function Sentinel({ onVisible, active }: { onVisible: () => void; active: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const node = ref.current
    if (!node || !active) return
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && onVisible(), { rootMargin: "600px 0px" })
    observer.observe(node)
    return () => observer.disconnect()
  }, [onVisible, active])
  return <div ref={ref} aria-hidden className="h-px w-full" />
}

export function CardsStage({ scope, entity, onOpen }: { scope: Scope; entity: Entity; onOpen: (drill: Drill) => void }) {
  const { state, filters, resolved } = scope
  const bills = useBillFeed(scope)
  const { data: memberRows, isLoading: membersLoading } = usePolicy<Member[]>(resolved && entity === "member" ? "members" : null, { state, session: filters.session, chamber: filters.chamber, party: filters.party })
  const { data: committeeRows, isLoading: committeesLoading } = usePolicy<Committee[]>(resolved && entity === "committee" ? "committees" : null, { state, session: filters.session })
  const members = React.useMemo(() => (memberRows ?? []).filter((m) => (m.active ?? true) && memberInScope(m, filters)), [memberRows, filters])
  const committees = React.useMemo(() => (committeeRows ?? []).filter((c) => committeeInScope(c, filters)), [committeeRows, filters])
  const shownBills = React.useMemo(() => bills.rows.filter((b) => billInScope(b, filters)), [bills.rows, filters])
  const memberReveal = useReveal(members)
  const committeeReveal = useReveal(committees)

  // A beat of skeleton when the kind changes, so the change reads as a load.
  // The stage no longer carries a kind switch of its own (Brendan, 2026-09-03:
  // "remove that"); the kind arrives as a prop.
  const [seen, setSeen] = React.useState(entity)
  const [switching, setSwitching] = React.useState(false)
  if (seen !== entity) {
    setSeen(entity)
    setSwitching(true)
  }
  React.useEffect(() => {
    if (!switching) return
    const timer = window.setTimeout(() => setSwitching(false), 350)
    return () => window.clearTimeout(timer)
  }, [switching])

  const loading = switching || !resolved || (entity === "bill" ? bills.loading && !bills.rows.length : entity === "member" ? membersLoading && !memberRows : committeesLoading && !committeeRows)
  const count = entity === "bill" ? shownBills.length : entity === "member" ? memberReveal.shown.length : committeeReveal.shown.length
  const grid = "grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="no-scrollbar relative z-10 flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className={grid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[26rem] rounded-2xl bg-card/80" />
            ))}
          </div>
        ) : count ? (
          <>
            <div className={grid}>
              {entity === "bill" && shownBills.map((b) => <BillCard key={b.bill_id} bill={b} state={state} onOpen={onOpen} />)}
              {entity === "member" && memberReveal.shown.map((m) => <MemberCard key={m.people_id} member={m} state={state} onOpen={onOpen} />)}
              {entity === "committee" && committeeReveal.shown.map((c) => <CommitteeCard key={`${c.chamber}/${c.committee_name}`} committee={c} state={state} onOpen={onOpen} />)}
            </div>
            {entity === "bill" && <Sentinel active={!bills.done && !bills.loading} onVisible={bills.more} />}
            {entity === "member" && <Sentinel active={!memberReveal.done} onVisible={memberReveal.more} />}
            {entity === "committee" && <Sentinel active={!committeeReveal.done} onVisible={committeeReveal.more} />}
            {entity === "bill" && bills.loading && (
              <div className={`${grid} mt-6`}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-[26rem] rounded-2xl bg-card/80" />
                ))}
              </div>
            )}
            {entity === "bill" && bills.done && shownBills.length > PAGE && <p className="py-10 text-center text-xs text-muted-foreground">That is every bill on file under these filters.</p>}
          </>
        ) : (
          <p className="py-20 text-center text-sm text-muted-foreground">Nothing matches these filters.</p>
        )}
      </div>

    </div>
  )
}
