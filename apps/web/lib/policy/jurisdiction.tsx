"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { JURISDICTION_KEY } from "@/lib/policy/scope-key"

import { useAccount } from "@/lib/auth/use-account"
import { doorHref, entitled, type Reader, type Verdict } from "@/lib/entitlements"
import { DEFAULT_STATE, isJurisdiction } from "@/lib/filters"
import { type SessionRow } from "@/lib/policy/types"
import { useUrlParams, writeUrlParams } from "@/lib/policy/url-state"
import { useLocal } from "@/lib/policy/use-local"
import { usePolicy } from "@/lib/policy/use-policy"

// The scope every legislative surface reads: which jurisdiction, and which
// session inside it. The URL is the source of truth (`?state=TX`,
// `?session=2025`); localStorage remembers the last choice for a visitor who
// arrives without one; Congress is the last resort.
//
// The scope is the reader's entitlement, not a preference (Brendan,
// 2026-09-13, after a signed-out visitor found the site in Alaska): a
// remembered jurisdiction the reader may not open falls back to Congress,
// and choosing one they may not open — from the header, the Typeset rail, a
// calendar or a watch form, all of which write here — sends them to sign in
// or to the plan instead of writing anything. A jurisdiction the URL names
// stands, so a shared link explains itself under a gate rather than
// silently turning into Congress; `verdict` says whether the reader may
// open it.
//
// The session is *not* a header control. It is computed per state — the
// latest session with bills — and only rides the URL once a widget (the home
// grid's Sessions card, the rail's session picker) sets it, so a link and a
// /create config stay stable while a default keeps following the data. An
// earlier session is on the plan, so setting one goes to the door too.

export { JURISDICTION_KEY } from "@/lib/policy/scope-key"

export type Jurisdiction = {
  /** The two-letter code in scope. Always a real jurisdiction the reader may open, unless the URL asked for another — see `verdict`. */
  state: string
  /** The jurisdiction asked for by the URL or remembered by the browser, before the rule. */
  requested: string
  /** Whether the reader may open `requested`; `state` is Congress while they may not, unless the URL insists. */
  verdict: Verdict
  /** The reader as the rule sees them, and whether the account has been read yet. */
  reader: Reader
  readerReady: boolean
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
  /** Chooses a jurisdiction the reader may open; otherwise goes to the door. `force` writes it regardless — onboarding, which has just made it theirs. */
  setState: (next: string, options?: { force?: boolean }) => void
  setSession: (next: string | number | null) => void
}

const JURISDICTION_PARAMS = ["state", "session"] as const

type Stored = { state: string; recent: string[] }

const EMPTY_SESSIONS: SessionRow[] = []

// The whole model, computed from the URL + this browser's memory + the
// account. Callable without the provider (the /create preview iframe has no
// app layout), which is why the provider is an optimisation and not a
// requirement; `active` is false for the standalone copy under a provider,
// which then fetches nothing.
function useJurisdictionValue(active: boolean): Jurisdiction {
  const router = useRouter()
  const params = useUrlParams(JURISDICTION_PARAMS)
  const [stored, setStored] = useLocal<Stored>(JURISDICTION_KEY, {
    state: DEFAULT_STATE,
    recent: [],
  })
  const { account, signedIn, ready } = useAccount(active)
  const reader = React.useMemo<Reader>(() => ({ signedIn, home: account?.home ?? null, license: "none" }), [signedIn, account?.home])

  // localStorage can only be read after mount, so a visitor with no `?state`
  // is genuinely unknown until then. A visitor who *does* carry `?state=TX`
  // is known on the first client render — only the shared static HTML is
  // neutral for them.
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const fromUrl = params.state?.toUpperCase()
  const urlState = isJurisdiction(fromUrl) ? fromUrl : ""

  // A scope that arrives by URL becomes this browser's memory too, so a
  // shared `?state=TX` link followed by a nav click (plain hrefs) stays in
  // Texas instead of dropping back to the default. Brendan, 2026-09-01. Only
  // one the reader may open (2026-09-13): a gated link is not a preference.
  React.useEffect(() => {
    if (!urlState || !ready || entitled(reader, { state: urlState }) !== "open") return
    setStored((previous) =>
      previous.state === urlState
        ? previous
        : { state: urlState, recent: [urlState, ...(previous.recent ?? []).filter((c) => c !== urlState)].slice(0, 5) }
    )
  }, [urlState, ready, reader, setStored])

  const remembered = React.useMemo(() => {
    const code = stored.state?.toUpperCase()
    return isJurisdiction(code) ? code : DEFAULT_STATE
  }, [stored.state])
  // A remembered jurisdiction the reader may not open is forgotten once the
  // account is known (2026-09-13): it would otherwise hide the first paint
  // on every load while the pre-paint script waits for the resolution.
  React.useEffect(() => {
    if (!ready || urlState || remembered === DEFAULT_STATE || entitled(reader, { state: remembered }) === "open") return
    setStored((previous) => ({ state: DEFAULT_STATE, recent: previous.recent ?? [] }))
  }, [ready, urlState, remembered, reader, setStored])
  const requested = urlState || remembered
  const verdict = React.useMemo(() => entitled(reader, { state: requested }), [reader, requested])
  // The URL's jurisdiction stands under its gate; a remembered one the reader
  // may not open is Congress until the account says otherwise.
  const state = urlState ? urlState : verdict === "open" ? remembered : DEFAULT_STATE
  // Known once the browser's memory is read and, when that memory is not
  // Congress, once the account is — a signed-in New Yorker's remembered New
  // York must not flash into Congress while the session is still in flight.
  const resolved = (!!urlState || mounted) && (ready || requested === DEFAULT_STATE)

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
    (next: string, options?: { force?: boolean }) => {
      const code = String(next ?? "").toUpperCase()
      if (!isJurisdiction(code)) return
      // The door, not the jurisdiction (Brendan, 2026-09-13): sign in first,
      // or the plan, for anything the reader may not open.
      if (!options?.force) {
        const allowed = entitled(reader, { state: code })
        if (allowed !== "open") {
          router.push(doorHref(allowed))
          return
        }
      }
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
    [setStored, reader, router]
  )

  const setSession = React.useCallback(
    (next: string | number | null) => {
      const wanted = next === null || next === "" ? null : Number(next)
      // An earlier session is on the plan (Brendan, 2026-09-13).
      if (wanted != null && defaultSession != null) {
        const allowed = entitled(reader, { state, session: wanted, current: defaultSession })
        if (allowed !== "open") {
          router.push(doorHref(allowed))
          return
        }
      }
      writeUrlParams({ session: wanted == null ? null : String(wanted) })
    },
    [reader, state, defaultSession, router]
  )

  return React.useMemo(
    () => ({
      state,
      requested,
      verdict,
      reader,
      readerReady: ready,
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
      requested,
      verdict,
      reader,
      ready,
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

// A page whose jurisdiction is in its path (Brendan, 2026-09-07:
// /workspace/data/us/house/2025/…) sets this over its stage, and every hook
// under it reads the path's state and session rather than the URL's keys.
/** `session` is the dataset's key (the year its session began); `year` is the year the path names and the pages show. */
export type PathScope = { state: string; session: number | null; year: number | null; chamber: string | null; sessions: SessionRow[] }
export const PathScopeContext = React.createContext<PathScope | null>(null)

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
  // its fetches while the provider's value is available.
  const own = useJurisdictionValue(shared === null)
  const path = React.useContext(PathScopeContext)
  const base = shared ?? own
  return React.useMemo(() => (path ? { ...base, state: path.state, requested: path.state, session: path.session, isDefaultSession: false, resolved: true, sessions: path.sessions } : base), [base, path])
}
