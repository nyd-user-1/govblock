"use client"

import * as React from "react"

import { JURISDICTION_KEY } from "@/lib/policy/scope-key"

import { DEFAULT_STATE, isJurisdiction } from "@/lib/filters"
import { type SessionRow } from "@/lib/policy/types"
import { useUrlParams, writeUrlParams } from "@/lib/policy/url-state"
import { useLocal } from "@/lib/policy/use-local"
import { usePolicy } from "@/lib/policy/use-policy"

// The scope every legislative surface reads: which jurisdiction, and which
// session inside it. The URL is the source of truth (`?state=TX`,
// `?session=2025`); localStorage remembers the last choice for a visitor who
// arrives without one; New York is the last resort, so nobody who has never
// touched the switcher sees a change.
//
// The session is *not* a header control. It is computed per state — the
// latest session with bills — and only rides the URL once a widget (the home
// grid's Sessions card, the rail's session picker) sets it, so a link and a
// /create config stay stable while a default keeps following the data.

export { JURISDICTION_KEY } from "@/lib/policy/scope-key"

export type Jurisdiction = {
  /** The two-letter code in scope. Always a real jurisdiction. */
  state: string
  /** The session in scope: the URL's, or the computed default for the state. */
  session: number | null
  /** True while the session is the computed default (nothing in the URL). */
  isDefaultSession: boolean
  /**
   * False until the scope is actually known. The prerendered HTML is shared
   * by every visitor, so before hydration nothing may claim a jurisdiction:
   * `/?state=TX` and `/` are the same bytes. Controls render neutral and
   * data requests hold until this is true.
   */
  resolved: boolean
  /** Every session the state has, newest first. */
  sessions: SessionRow[]
  sessionsLoading: boolean
  /** Recently chosen jurisdictions, most recent first (this browser). */
  recent: string[]
  setState: (next: string) => void
  setSession: (next: string | number | null) => void
}

const JURISDICTION_PARAMS = ["state", "session"] as const

type Stored = { state: string; recent: string[] }

const EMPTY_SESSIONS: SessionRow[] = []

// The whole model, computed from the URL + this browser's memory. Callable
// without the provider (the /create preview iframe has no app layout), which
// is why the provider is an optimisation and not a requirement.
function useJurisdictionValue(active: boolean): Jurisdiction {
  const params = useUrlParams(JURISDICTION_PARAMS)
  const [stored, setStored] = useLocal<Stored>(JURISDICTION_KEY, {
    state: DEFAULT_STATE,
    recent: [],
  })

  // localStorage can only be read after mount, so a visitor with no `?state`
  // is genuinely unknown until then. A visitor who *does* carry `?state=TX`
  // is known on the first client render — only the shared static HTML is
  // neutral for them.
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const fromUrl = params.state?.toUpperCase()
  const urlState = isJurisdiction(fromUrl) ? fromUrl : ""
  const resolved = !!urlState || mounted

  // A scope that arrives by URL becomes this browser's memory too, so a
  // shared `?state=TX` link followed by a nav click (plain hrefs) stays in
  // Texas instead of dropping back to the default. Brendan, 2026-09-01.
  React.useEffect(() => {
    if (!urlState) return
    setStored((previous) =>
      previous.state === urlState
        ? previous
        : { state: urlState, recent: [urlState, ...(previous.recent ?? []).filter((c) => c !== urlState)].slice(0, 5) }
    )
  }, [urlState, setStored])

  const state = React.useMemo(() => {
    if (urlState) return urlState
    const remembered = stored.state?.toUpperCase()
    if (isJurisdiction(remembered)) return remembered
    return DEFAULT_STATE
  }, [urlState, stored.state])

  // One request per state, cached at the edge for half an hour and deduped
  // by SWR across every consumer on the page. Held until the scope is known,
  // so a Texas visitor never issues a New York request.
  const { data: sessions, isLoading } = usePolicy<SessionRow[]>(
    active && resolved ? "sessions" : null,
    { state }
  )

  // The default session is the newest one that actually has bills, so a state
  // between sessions shows its most recent one instead of an empty shell.
  const defaultSession = React.useMemo(() => {
    if (!sessions?.length) return null
    const withBills = sessions.filter((row) => Number(row.bills) > 0)
    const pick = withBills[0] ?? sessions[0]
    return pick ? Number(pick.session_id) : null
  }, [sessions])

  const urlSession = Number(params.session)
  const hasUrlSession = !!params.session && Number.isFinite(urlSession)
  const session = hasUrlSession ? urlSession : defaultSession

  const setState = React.useCallback(
    (next: string) => {
      const code = String(next ?? "").toUpperCase()
      if (!isJurisdiction(code)) return
      setStored((previous) => ({
        state: code,
        recent: [
          code,
          ...(previous.recent ?? []).filter((c) => c !== code),
        ].slice(0, 5),
      }))
      // A new jurisdiction has its own sessions; the old one's number would
      // mean a different legislature or nothing at all.
      writeUrlParams({ state: code, session: null })
    },
    [setStored]
  )

  const setSession = React.useCallback((next: string | number | null) => {
    writeUrlParams({
      session: next === null || next === "" ? null : String(next),
    })
  }, [])

  return React.useMemo(
    () => ({
      state,
      session,
      isDefaultSession: !hasUrlSession,
      resolved,
      sessions: sessions ?? EMPTY_SESSIONS,
      sessionsLoading: isLoading,
      recent: stored.recent ?? [],
      setState,
      setSession,
    }),
    [
      state,
      session,
      hasUrlSession,
      resolved,
      sessions,
      isLoading,
      stored.recent,
      setState,
      setSession,
    ]
  )
}

const JurisdictionContext = React.createContext<Jurisdiction | null>(null)

// Nothing below reads `useSearchParams()`, so the provider can wrap the app
// directly: no Suspense boundary, no prerender bail-out, and every page keeps
// its static HTML.
export function JurisdictionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const value = useJurisdictionValue(true)
  return (
    <JurisdictionContext.Provider value={value}>
      {children}
    </JurisdictionContext.Provider>
  )
}

export function useJurisdiction(): Jurisdiction {
  const shared = React.useContext(JurisdictionContext)
  // Both hooks always run (no conditional hooks); the standalone one holds
  // its fetch while the provider's value is available.
  const own = useJurisdictionValue(shared === null)
  return shared ?? own
}
