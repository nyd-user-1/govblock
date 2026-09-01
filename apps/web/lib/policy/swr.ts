"use client"

import * as React from "react"

import { resolve } from "@/lib/policy/snapshot"

// The `useSWR(key, fetcher, options)` shape livingston-v3's FEC explorer
// calls, answered from the snapshot instead of the network.
export default function useSWR<T>(key: string | null, _fetcher?: unknown, _options?: unknown) {
  const data = React.useMemo(() => (key ? (resolve(key) as T | undefined) : undefined), [key])
  return { data, error: undefined as Error | undefined, isLoading: false }
}
