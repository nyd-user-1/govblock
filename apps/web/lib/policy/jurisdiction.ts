"use client"

// The jurisdiction in scope. livingston-v3 resolves this from the URL and
// localStorage after hydration; govblock's surfaces are Congress-scoped
// fixtures until the data layer lands, so the scope is a constant and
// `resolved` is always true. The boards read it exactly as they did in v3.
export type Jurisdiction = {
  state: string
  session: number | null
  isDefaultSession: boolean
  resolved: boolean
  setState: (next: string) => void
}

export const JURISDICTION: Jurisdiction = { state: "US", session: 2025, isDefaultSession: true, resolved: true, setState: () => {} }

export function useJurisdiction(): Jurisdiction {
  return JURISDICTION
}
