"use client"

import * as React from "react"

import { resolve, resolveCongress } from "@/lib/policy/snapshot"

// livingston-v3 lib/policy/use-policy.ts: one hook for every widget,
// `usePolicy("bills", filters, { limit: 8 })`, keyed by the request URL. v3
// fetches it over SWR; this answers the same URL from lib/data/snapshot —
// but in an effect, not synchronously, because the callers were written for
// data that arrives after mount (the calendar clears its store on mount and
// expects the hearings to land afterwards). keepPreviousData holds the old
// rows while a new key resolves, as SWR did.
export type Filters = Partial<Record<"state" | "session" | "chamber" | "committee" | "member" | "party" | "status" | "subject" | "vote" | "bill" | "version", string>>

export function policyUrl(resource: string, filters: Filters = {}, extra: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries({ ...filters, ...extra })) {
    if (value !== undefined && value !== "") params.set(key, String(value))
  }
  const query = params.toString()
  return `/api/policy/${resource}${query ? `?${query}` : ""}`
}

export function useSnapshot<T>(key: string | null) {
  const [state, setState] = React.useState<{ key: string | null; data: T | undefined }>({ key: null, data: undefined })
  React.useEffect(() => {
    if (!key) {
      setState({ key: null, data: undefined })
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch(key)
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
        const data = (await response.json()) as T
        if (!cancelled) setState({ key, data })
      } catch (error) {
        // Congress alone may stand in its committed snapshot, because that is
        // the jurisdiction the snapshots hold. Under any other scope a failure
        // reads as empty: Congress's rows under Texas's name would be a lie,
        // and a quieter one than an empty board.
        const scope = new URL(key, "http://snapshot").searchParams.get("state") || "US"
        if (scope !== "US") console.error(`policy: ${key} failed`, error)
        // The congress.gov families are loaded a family at a time, and only on
        // this path — a page that never asks for one never carries its weight.
        const snapshot = scope === "US" ? ((resolve(key) as T | undefined) ?? ((await resolveCongress(key)) as T | undefined)) : undefined
        if (!cancelled) setState({ key, data: snapshot })
      }
    })()
    return () => {
      cancelled = true
    }
    // The previous key's rows stay on screen until the new ones land, which is
    // what SWR's keepPreviousData did for these callers.
  }, [key])
  return { data: state.data, error: undefined as Error | undefined, isLoading: !!key && state.key !== key }
}

export function usePolicy<T>(resource: string | null, filters: Filters = {}, extra: Record<string, string | number | undefined> = {}) {
  const key = resource && filters.state !== "" ? policyUrl(resource, filters, extra) : null
  return useSnapshot<T>(key)
}
