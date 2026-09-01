"use client"

import * as React from "react"

import { useJurisdiction } from "@/lib/policy/jurisdiction"

// Clears the anti-flash rule once the scope is genuinely known on the client.
//
// From this point every scoped surface renders its own jurisdiction or its own
// empty state — the committed Congress fixtures only ever stand in under
// Congress — so revealing here cannot show one legislature's rows under
// another's name. It reveals on `resolved` rather than waiting for each
// component's first row, which would hold the page blank for the slowest fetch
// on it; the cost is that a Texas reader may see loading states, never Congress.
export function ScopeReady() {
  const { resolved, state } = useJurisdiction()
  React.useEffect(() => {
    if (!resolved) return
    document.documentElement.dataset.scope = state
    document.documentElement.dataset.scopeReady = "1"
  }, [resolved, state])
  return null
}
