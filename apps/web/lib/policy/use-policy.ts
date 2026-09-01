"use client"

import * as React from "react"

import { resolve } from "@/lib/policy/snapshot"

// livingston-v3 lib/policy/use-policy.ts: one hook for every widget,
// `usePolicy("bills", filters, { limit: 8 })`, keyed by the request URL. v3
// fetches it over SWR; this answers the same URL from lib/data/snapshot.
export type Filters = Partial<Record<"state" | "session" | "chamber" | "committee" | "member" | "party" | "status" | "votes" | "bill" | "version", string>>

export function policyUrl(resource: string, filters: Filters = {}, extra: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries({ ...filters, ...extra })) {
    if (value !== undefined && value !== "") params.set(key, String(value))
  }
  const query = params.toString()
  return `/api/policy/${resource}${query ? `?${query}` : ""}`
}

export function usePolicy<T>(resource: string | null, filters: Filters = {}, extra: Record<string, string | number | undefined> = {}) {
  const key = resource && filters.state !== "" ? policyUrl(resource, filters, extra) : null
  const data = React.useMemo(() => (key ? (resolve(key) as T | undefined) : undefined), [key])
  return { data, error: undefined as Error | undefined, isLoading: false }
}
