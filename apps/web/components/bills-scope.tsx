"use client"

import * as React from "react"

import { ScopeMark } from "@/components/scope-mark"
import { PathScopeContext } from "@/lib/policy/jurisdiction"
import { useUrlParams } from "@/lib/policy/url-state"

const SESSION_PARAM = ["session"] as const

// The jurisdiction a bills page names in its path (Brendan, 2026-09-11:
// /bills/ny), set over the list so every scoped hook under it reads New York
// whatever the header's flag says. The session is the jurisdiction's latest,
// which the route resolves when none is named. Who may open it is the
// layout's gate (components/scope-guard.tsx, 2026-09-13), which reads the
// jurisdiction off the path.
//
// A session can be named in the query since 2026-09-18 (Brendan): /state
// links each jurisdiction's first session year to /bills/al?session=2010. It
// is read through useUrlParams rather than the route's searchParams, so the
// page keeps its cached HTML. The gate reads sessions off the path or a mark,
// never the query, so a named session is marked for it: an earlier session
// then gets the gate's card, not a list the API refused.
export function BillsScope({ state, children }: { state: string; children: React.ReactNode }) {
  const session = Number(useUrlParams(SESSION_PARAM).session) || null
  const value = React.useMemo(() => ({ state, session, year: null, chamber: null, sessions: [] }), [state, session])
  return (
    <PathScopeContext.Provider value={value}>
      {session && <ScopeMark state={state} session={session} entity="bills" />}
      {children}
    </PathScopeContext.Provider>
  )
}
