"use client"

import * as React from "react"

import { PathScopeContext } from "@/lib/policy/jurisdiction"

// The jurisdiction a bills page names in its path (Brendan, 2026-09-11:
// /bills/ny), set over the list so every scoped hook under it reads New York
// whatever the header's flag says. The session is the jurisdiction's latest,
// which the route resolves when none is named. Who may open it is the
// layout's gate (components/scope-guard.tsx, 2026-09-13), which reads the
// jurisdiction off the path.
export function BillsScope({ state, children }: { state: string; children: React.ReactNode }) {
  const value = React.useMemo(() => ({ state, session: null, year: null, chamber: null, sessions: [] }), [state])
  return <PathScopeContext.Provider value={value}>{children}</PathScopeContext.Provider>
}
