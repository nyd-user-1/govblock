"use client"

import dynamic from "next/dynamic"

import { CONGRESS } from "@/lib/filters"
import { FrozenPolicyProvider } from "@/lib/policy/frozen"
import { PathScopeContext, type PathScope } from "@/lib/policy/jurisdiction"
import { useRootSheets } from "@/lib/root-sheets"
import { useReached } from "@/components/rail-toggle"

// The root's innermost sheet (Brendan, 2026-09-15): the account home's center
// container and nothing around it, under Congress whatever the header's flag
// says, the session the route's latest.
//
// A demonstration (Brendan, 2026-09-20): the tiles draw the answers frozen in
// lib/data/root-sheets.json and ask the API nothing, and the sheet is mounted,
// its code with it, when a reader first opens their way to it. Until then it
// read the API four seconds into every load of the root, to be drawn before
// anyone arrived; that and the changelog's sheet were the root's slow start.
const SCOPE: PathScope = { state: CONGRESS, session: null, year: null, chamber: null, sessions: [] }

const HomeMain = dynamic(() => import("@/components/home/home-main").then((m) => m.HomeMain), { ssr: false })

export function HomeSheet() {
  const reached = useReached(["right", "right-2", "right-3"])
  const file = useRootSheets(reached)
  if (!file) return null
  return (
    <FrozenPolicyProvider answers={file.home}>
      <PathScopeContext.Provider value={SCOPE}>
        <HomeMain />
      </PathScopeContext.Provider>
    </FrozenPolicyProvider>
  )
}
