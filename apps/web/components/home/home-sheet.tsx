"use client"

import { CONGRESS } from "@/lib/filters"
import { PathScopeContext, type PathScope } from "@/lib/policy/jurisdiction"
import { HomeMain } from "@/components/home/home-main"
import { useReached } from "@/components/rail-toggle"

// The root's innermost sheet (Brendan, 2026-09-15): the account home's center
// container and nothing around it, under Congress whatever the header's flag
// says, the session the route's latest. /home waits for its refresh button;
// here the tiles read the API as soon as a reader has opened every sheet on
// the way in, and not before.
const SCOPE: PathScope = { state: CONGRESS, session: null, year: null, chamber: null, sessions: [] }

export function HomeSheet() {
  const reached = useReached(["right", "right-2", "right-3", "right-4"])
  if (!reached) return null
  return (
    <PathScopeContext.Provider value={SCOPE}>
      <HomeMain hotkey={false} />
    </PathScopeContext.Provider>
  )
}
